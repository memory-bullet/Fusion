import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isProjectOwner, requireProjectMember } from "@/lib/auth";
import { removeStoredFile } from "@/lib/project-file-storage";
import { pointsForDescriptionSave, pointsForFileUpload } from "@/lib/document-contribution";
import { awardDocumentPoints } from "@/lib/document-review";

const patchSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    content: z.string().max(500_000).optional(),
    description: z.string().max(8_000).optional(),
    reviewStatus: z.enum(["APPROVED", "REJECTED"]).optional(),
    reviewComment: z.string().max(500).optional()
  })
  .refine(
    (v) =>
      v.title !== undefined ||
      v.content !== undefined ||
      v.description !== undefined ||
      v.reviewStatus !== undefined,
    {
      message: "请至少提供标题、内容、作品说明或审核结果中的一项"
    }
  );

function serializeDoc(doc: {
  id: string;
  title: string;
  content: string;
  description: string;
  originalFileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  storageKey: string | null;
  fileHash: string | null;
  reviewStatus: string;
  reviewComment: string;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  pointsAwarded: number;
  createdAt: Date;
  updatedAt: Date;
  author: { id: string; name: string };
}) {
  return {
    id: doc.id,
    title: doc.title,
    content: doc.content,
    description: doc.description ?? "",
    originalFileName: doc.originalFileName,
    mimeType: doc.mimeType,
    fileSize: doc.fileSize,
    storageKey: doc.storageKey,
    fileHash: doc.fileHash,
    reviewStatus: doc.reviewStatus,
    reviewComment: doc.reviewComment,
    reviewedBy: doc.reviewedBy,
    reviewedAt: doc.reviewedAt?.toISOString() ?? null,
    pointsAwarded: doc.pointsAwarded,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    author: doc.author
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id: projectId, docId } = await params;
    const userId = await requireProjectMember(projectId);
    const isOwner = await isProjectOwner(projectId, userId);
    const body = patchSchema.parse(await request.json());

    const existing = await prisma.projectDocument.findFirst({
      where: { id: docId, projectId },
      include: { author: { select: { id: true, name: true } } }
    });
    if (!existing) {
      return NextResponse.json({ error: "文档不存在" }, { status: 404 });
    }

    const wantsReview = body.reviewStatus !== undefined;
    if (wantsReview && !isOwner) {
      return NextResponse.json({ error: "仅组长可以审核文件" }, { status: 403 });
    }
    if (!isOwner && existing.authorId !== userId) {
      return NextResponse.json({ error: "只能修改自己上传的文件" }, { status: 403 });
    }

    const prevDesc = (existing.description ?? "").trim();
    const nextDesc = body.description !== undefined ? body.description.trim() : undefined;

    if (wantsReview) {
      if (!existing.storageKey) {
        return NextResponse.json({ error: "仅上传的文件支持审核" }, { status: 400 });
      }
      if (existing.reviewStatus !== "PENDING") {
        return NextResponse.json({ error: "该文件已完成审核，请勿重复操作" }, { status: 400 });
      }

      if (body.reviewStatus === "APPROVED") {
        const pts = existing.fileSize ? pointsForFileUpload(existing.fileSize) : 0;
        await awardDocumentPoints({
          documentId: existing.id,
          projectId,
          userId: existing.authorId,
          reviewerId: userId,
          points: pts,
          fileName: existing.originalFileName ?? existing.title
        });
      } else {
        await prisma.$transaction([
          prisma.projectDocument.update({
            where: { id: existing.id },
            data: {
              reviewStatus: "REJECTED",
              reviewComment: body.reviewComment?.trim() ?? "请按要求修改后重新提交",
              reviewedBy: userId,
              reviewedAt: new Date(),
              pointsAwarded: 0
            }
          }),
          prisma.actionLog.create({
            data: {
              projectId,
              userId,
              actionType: "DOCUMENT_REJECTED",
              description: `打回作业文件：${existing.originalFileName ?? existing.title}｜文档ID=${existing.id}`
            }
          })
        ]);
      }

      const reviewed = await prisma.projectDocument.findUnique({
        where: { id: existing.id },
        include: { author: { select: { id: true, name: true } } }
      });

      return NextResponse.json({ document: serializeDoc(reviewed!) });
    }

    const doc = await prisma.projectDocument.update({
      where: { id: docId },
      data: {
        ...(body.title !== undefined ? { title: body.title.trim() } : {}),
        ...(body.content !== undefined ? { content: body.content } : {}),
        ...(nextDesc !== undefined ? { description: nextDesc } : {}),
        ...(existing.reviewStatus === "REJECTED"
          ? { reviewStatus: "PENDING", reviewComment: "", reviewedBy: null, reviewedAt: null }
          : {})
      },
      include: { author: { select: { id: true, name: true } } }
    });

    if (nextDesc !== undefined && nextDesc !== prevDesc) {
      const windowStart = new Date(Date.now() - 3 * 60 * 1000);
      const recent = await prisma.actionLog.findFirst({
        where: {
          projectId,
          userId,
          actionType: "DOCUMENT_DESCRIPTION",
          description: { contains: `docId=${docId}` },
          createdAt: { gte: windowStart }
        }
      });
      if (!recent) {
        const pts = pointsForDescriptionSave();
        await prisma.$transaction([
          prisma.user.update({
            where: { id: userId },
            data: { accumulatedPoints: { increment: pts } }
          }),
          prisma.actionLog.create({
            data: {
              projectId,
              userId,
              actionType: "DOCUMENT_DESCRIPTION",
              description: `更新作品说明「${doc.title}」｜docId=${docId}｜积分 +${pts}`
            }
          })
        ]);
      }
    }

    return NextResponse.json({ document: serializeDoc(doc) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新文档失败" },
      { status: 400 }
    );
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  try {
    const { id: projectId, docId } = await params;
    const userId = await requireProjectMember(projectId);
    const isOwner = await isProjectOwner(projectId, userId);

    const existing = await prisma.projectDocument.findFirst({
      where: { id: docId, projectId }
    });
    if (!existing) {
      return NextResponse.json({ error: "文档不存在" }, { status: 404 });
    }
    if (!isOwner && existing.authorId !== userId) {
      return NextResponse.json({ error: "只能删除自己上传的文件" }, { status: 403 });
    }

    if (existing.storageKey) {
      await removeStoredFile(existing.storageKey);
    }

    const awardedPts = existing.pointsAwarded ?? 0;

    await prisma.$transaction(async (tx) => {
      await tx.projectDocument.delete({ where: { id: docId } });

      if (awardedPts > 0) {
        await tx.user.update({
          where: { id: existing.authorId },
          data: { accumulatedPoints: { decrement: awardedPts } }
        });

        await tx.actionLog.create({
          data: {
            projectId,
            userId,
            actionType: "DOCUMENT_UPLOAD",
            description: `删除作业文件：${existing.originalFileName ?? existing.title}｜扣除积分 -${awardedPts}`
          }
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "删除文档失败" },
      { status: 400 }
    );
  }
}

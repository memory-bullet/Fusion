import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectMember } from "@/lib/auth";
import { removeStoredFile } from "@/lib/project-file-storage";
import { pointsForDescriptionSave } from "@/lib/document-contribution";

const patchSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    content: z.string().max(500_000).optional(),
    description: z.string().max(8_000).optional()
  })
  .refine((v) => v.title !== undefined || v.content !== undefined || v.description !== undefined, {
    message: "Provide title, content and/or description"
  });

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id: projectId, docId } = await params;
    const userId = await requireProjectMember(projectId);
    const body = patchSchema.parse(await request.json());

    const existing = await prisma.projectDocument.findFirst({
      where: { id: docId, projectId }
    });
    if (!existing) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const prevDesc = (existing.description ?? "").trim();
    const nextDesc =
      body.description !== undefined ? body.description.trim() : undefined;

    const doc = await prisma.projectDocument.update({
      where: { id: docId },
      data: {
        ...(body.title !== undefined ? { title: body.title.trim() } : {}),
        ...(body.content !== undefined ? { content: body.content } : {}),
        ...(nextDesc !== undefined ? { description: nextDesc } : {})
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

    return NextResponse.json({
      document: {
        id: doc.id,
        title: doc.title,
        content: doc.content,
        description: doc.description ?? "",
        originalFileName: doc.originalFileName,
        mimeType: doc.mimeType,
        fileSize: doc.fileSize,
        storageKey: doc.storageKey,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
        author: doc.author
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update document failed" },
      { status: 400 }
    );
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  try {
    const { id: projectId, docId } = await params;
    await requireProjectMember(projectId);

    const existing = await prisma.projectDocument.findFirst({
      where: { id: docId, projectId }
    });
    if (!existing) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (existing.storageKey) {
      await removeStoredFile(existing.storageKey);
    }
    await prisma.projectDocument.delete({ where: { id: docId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Delete document failed" },
      { status: 400 }
    );
  }
}

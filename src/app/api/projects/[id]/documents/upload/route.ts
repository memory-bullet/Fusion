import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectMember } from "@/lib/auth";
import {
  assertAllowedUpload,
  extensionOf,
  safeBasename,
  saveUploadedBytes
} from "@/lib/project-file-storage";
import { pointsForFileUpload } from "@/lib/document-contribution";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 80 * 1024 * 1024;

function titleFromFilename(name: string): string {
  const base = safeBasename(name);
  const ext = extensionOf(base);
  if (!ext) return base || "上传文件";
  return base.slice(0, Math.max(1, base.length - ext.length - 1)) || base;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    const userId = await requireProjectMember(projectId);

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "请上传文件（字段名 file）" }, { status: 400 });
    }

    const description = String(form.get("description") ?? "").trim().slice(0, 8000);
    const buffer = Buffer.from(await file.arrayBuffer());
    assertAllowedUpload(file.name, buffer.length, MAX_BYTES);

    const mime = file.type?.trim() || "application/octet-stream";
    const safeName = safeBasename(file.name);
    const displayTitle = titleFromFilename(file.name);

    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.projectDocument.create({
        data: {
          projectId,
          authorId: userId,
          title: displayTitle,
          content: "",
          description,
          originalFileName: file.name,
          mimeType: mime,
          fileSize: buffer.length,
          storageKey: null
        },
        include: { author: { select: { id: true, name: true } } }
      });

      const storageKey = `${projectId}/${created.id}/${safeName}`;
      await saveUploadedBytes(storageKey, buffer);

      const doc = await tx.projectDocument.update({
        where: { id: created.id },
        data: { storageKey },
        include: { author: { select: { id: true, name: true } } }
      });

      const pts = pointsForFileUpload(buffer.length);
      await tx.user.update({
        where: { id: userId },
        data: { accumulatedPoints: { increment: pts } }
      });
      await tx.actionLog.create({
        data: {
          projectId,
          userId,
          actionType: "DOCUMENT_UPLOAD",
          description: `上传作业文件：${file.name}（${(buffer.length / 1024).toFixed(1)} KB）｜积分 +${pts}`
        }
      });

      return doc;
    });

    return NextResponse.json({
      document: {
        id: result.id,
        title: result.title,
        content: result.content,
        description: result.description ?? "",
        originalFileName: result.originalFileName,
        mimeType: result.mimeType,
        fileSize: result.fileSize,
        storageKey: result.storageKey,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
        author: result.author
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 }
    );
  }
}

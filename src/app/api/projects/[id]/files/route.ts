import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isProjectOwner, requireProjectMember } from "@/lib/auth";
import { canExtractTextFromFile, extractTextFromFile } from "@/lib/file-extract";
import { saveUploadedFile } from "@/lib/file-storage";

const summarize = (text: string) => {
  const clean = text.replace(/\s+/g, " ").trim();
  return (clean.slice(0, 90) || "文件内容已提取，可点击查看详细内容。") + (clean.length > 90 ? "…" : "");
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = await requireProjectMember(id);
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const stored = await saveUploadedFile(id, file);
    const extractedText = canExtractTextFromFile(file.type)
      ? (await extractTextFromFile(file)).trim() || "未提取到文本内容。"
      : "该文件类型暂不支持提取正文，将以原文件方式预览。";
    const summary = summarize(extractedText);
    const status = (await isProjectOwner(id, userId)) ? "APPROVED" : "PENDING";

    const saved = await prisma.projectFile.create({
      data: {
        projectId: id,
        uploaderId: userId,
        title: file.name,
        summary,
        extractedText,
        mimeType: stored.mimeType,
        relativePath: stored.relativePath,
        status
      },
      include: {
        uploader: true
      }
    });

    return NextResponse.json({
      file: {
        id: saved.id,
        title: saved.title,
        summary: saved.summary,
        content: saved.extractedText,
        mimeType: saved.mimeType,
        status: saved.status,
        time: saved.createdAt,
        author: saved.uploader.name,
        downloadUrl: `/api/projects/${id}/files/${saved.id}/download`
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload file" },
      { status: 400 }
    );
  }
}

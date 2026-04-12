import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireProjectMember } from "@/lib/auth";

const uploadsRoot = path.join(process.cwd(), "uploads");

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-\u4e00-\u9fa5]/g, "_");
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = await requireProjectMember(id);
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const projectDir = path.join(uploadsRoot, id);
    await mkdir(projectDir, { recursive: true });

    const ext = path.extname(file.name);
    const storedName = `${Date.now()}-${randomUUID()}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(projectDir, storedName), buffer);

    const saved = await prisma.projectFile.create({
      data: {
        projectId: id,
        uploaderId: userId,
        originalName: safeName(file.name),
        storedName,
        mimeType: file.type || "application/octet-stream",
        size: file.size
      },
      include: { uploader: true }
    });

    return NextResponse.json({
      file: {
        id: saved.id,
        name: saved.originalName,
        uploader: saved.uploader.name,
        uploaderId: saved.uploaderId,
        uploadedAt: saved.createdAt,
        status: saved.status,
        previewUrl: `/api/projects/${id}/files/${saved.id}/content`
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to upload file" }, { status: 400 });
  }
}

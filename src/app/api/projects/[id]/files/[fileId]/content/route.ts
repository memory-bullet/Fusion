import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { requireProjectMember } from "@/lib/auth";

const uploadsRoot = path.join(process.cwd(), "uploads");

export async function GET(_: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  try {
    const { id, fileId } = await params;
    await requireProjectMember(id);

    const file = await prisma.projectFile.findFirst({
      where: { id: fileId, projectId: id }
    });

    if (!file) {
      return new NextResponse("File not found", { status: 404 });
    }

    const absPath = path.join(uploadsRoot, id, file.storedName);
    const buffer = await readFile(absPath);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.originalName)}`
      }
    });
  } catch (error) {
    return new NextResponse(error instanceof Error ? error.message : "Failed to load file", { status: 400 });
  }
}

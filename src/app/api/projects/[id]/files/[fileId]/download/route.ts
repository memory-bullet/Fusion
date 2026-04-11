import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { NextResponse } from "next/server";
import path from "path";
import { prisma } from "@/lib/prisma";
import { requireProjectMember } from "@/lib/auth";

export async function GET(_: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  try {
    const { id, fileId } = await params;
    await requireProjectMember(id);

    const file = await prisma.projectFile.findFirst({
      where: { id: fileId, projectId: id }
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const absolutePath = path.join(process.cwd(), file.relativePath);
    await stat(absolutePath);

    const stream = createReadStream(absolutePath) as unknown as ReadableStream;
    return new NextResponse(stream, {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.title)}`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load file" },
      { status: 400 }
    );
  }
}

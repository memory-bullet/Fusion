import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectMember } from "@/lib/auth";
import { absoluteStoragePath } from "@/lib/project-file-storage";

export const runtime = "nodejs";

function encodeRFC5987(name: string): string {
  return encodeURIComponent(name).replace(/['()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id: projectId, docId } = await params;
    await requireProjectMember(projectId);

    const doc = await prisma.projectDocument.findFirst({
      where: { id: docId, projectId }
    });
    if (!doc?.storageKey) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const fullPath = absoluteStoragePath(doc.storageKey);
    const st = await stat(fullPath).catch(() => null);
    if (!st?.isFile()) {
      return NextResponse.json({ error: "File missing on disk" }, { status: 404 });
    }

    const stream = createReadStream(fullPath);
    const webStream = Readable.toWeb(stream) as unknown as ReadableStream;

    const filename = doc.originalFileName || "download";
    const disposition = `inline; filename="${filename.replace(/"/g, "")}"; filename*=UTF-8''${encodeRFC5987(filename)}`;

    return new NextResponse(webStream, {
      headers: {
        "Content-Type": doc.mimeType || "application/octet-stream",
        "Content-Disposition": disposition,
        "Content-Length": String(st.size),
        "Cache-Control": "private, max-age=3600"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read file" },
      { status: 400 }
    );
  }
}

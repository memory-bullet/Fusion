import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectMember } from "@/lib/auth";

const createSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().max(500_000).optional(),
  description: z.string().max(8_000).optional()
});

function serializeDoc(doc: {
  id: string;
  title: string;
  content: string;
  description: string;
  originalFileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  storageKey: string | null;
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
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    author: doc.author
  };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    const userId = await requireProjectMember(projectId);
    const body = createSchema.parse(await request.json());

    const count = await prisma.projectDocument.count({ where: { projectId } });
    const title = body.title?.trim() || `新文档 ${count + 1}`;
    const desc = body.description?.trim() ?? "";

    const doc = await prisma.$transaction(async (tx) => {
      const created = await tx.projectDocument.create({
        data: {
          projectId,
          authorId: userId,
          title,
          content: body.content ?? "",
          description: desc
        },
        include: { author: { select: { id: true, name: true } } }
      });

      await tx.actionLog.create({
        data: {
          projectId,
          userId,
          actionType: "DOCUMENT_CREATED",
          description: `新建协作文档：${created.title}`
        }
      });

      return created;
    });

    return NextResponse.json({ document: serializeDoc(doc) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Create document failed" },
      { status: 400 }
    );
  }
}

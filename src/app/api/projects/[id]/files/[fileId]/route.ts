import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectOwner } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  try {
    const { id, fileId } = await params;
    await requireProjectOwner(id);
    const body = (await request.json()) as { status?: "APPROVED" | "REJECTED" };

    if (body.status !== "APPROVED" && body.status !== "REJECTED") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const file = await prisma.projectFile.update({
      where: { id: fileId },
      data: { status: body.status, reviewedAt: new Date() }
    });

    return NextResponse.json({ ok: true, fileId: file.id, status: file.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update file status" }, { status: 400 });
  }
}

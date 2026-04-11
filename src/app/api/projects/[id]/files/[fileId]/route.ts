import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isProjectOwner, requireProjectMember } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  try {
    const { id, fileId } = await params;
    const userId = await requireProjectMember(id);

    if (!(await isProjectOwner(id, userId))) {
      return NextResponse.json({ error: "Only owner can approve files" }, { status: 403 });
    }

    const { status } = await request.json();
    if (status !== "APPROVED") {
      return NextResponse.json({ error: "Unsupported status" }, { status: 400 });
    }

    await prisma.projectFile.update({
      where: { id: fileId },
      data: { status: "APPROVED" }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to approve file" },
      { status: 400 }
    );
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  try {
    const { id, fileId } = await params;
    const userId = await requireProjectMember(id);

    if (!(await isProjectOwner(id, userId))) {
      return NextResponse.json({ error: "Only owner can reject files" }, { status: 403 });
    }

    await prisma.projectFile.delete({
      where: { id: fileId }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reject file" },
      { status: 400 }
    );
  }
}

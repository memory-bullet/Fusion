import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectOwner } from "@/lib/auth";

const updateSchema = z.object({
  title: z.string().min(1).max(60).optional(),
  deadline: z.string().datetime().optional()
});

/** PATCH /api/projects/[id] — 修改项目名称和截止时间（仅组长） */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    await requireProjectOwner(projectId);

    const body = updateSchema.parse(await request.json());

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: {
        ...(body.title !== undefined && { title: body.title.trim() }),
        ...(body.deadline !== undefined && { deadline: new Date(body.deadline) })
      },
      select: { id: true, title: true, deadline: true }
    });

    return NextResponse.json({ ok: true, project: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "格式错误" }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新失败" },
      { status: 400 }
    );
  }
}

/** DELETE /api/projects/[id] — 删除项目（仅组长） */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    await requireProjectOwner(projectId);

    await prisma.project.delete({ where: { id: projectId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "删除失败" },
      { status: 400 }
    );
  }
}

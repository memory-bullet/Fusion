import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";

const createPresetsSchema = z.object({
  names: z.array(z.string().min(1).max(40))
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    const currentUserId = await requireUserId();
    const body = createPresetsSchema.parse(await request.json());

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { members: true }
    });

    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    const currentMember = project.members.find((m) => m.userId === currentUserId);
    if (!currentMember || currentMember.role !== "OWNER") {
      return NextResponse.json({ error: "只有组长可以邀请成员" }, { status: 403 });
    }

    if (body.names.length === 0) {
      return NextResponse.json({ error: "至少需要一个成员名称" }, { status: 400 });
    }

    await prisma.memberPreset.createMany({
      data: body.names.map((name) => ({
        projectId,
        presetName: name.trim(),
        activated: false
      }))
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "格式错误" }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "添加失败" },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    const currentUserId = await requireUserId();
    const { searchParams } = new URL(request.url);
    const presetId = searchParams.get("presetId");

    if (!presetId) {
      return NextResponse.json({ error: "缺少 presetId" }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { members: true }
    });

    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    const currentMember = project.members.find((m) => m.userId === currentUserId);
    if (!currentMember || currentMember.role !== "OWNER") {
      return NextResponse.json({ error: "只有组长可以取消邀请" }, { status: 403 });
    }

    const preset = await prisma.memberPreset.findUnique({ where: { id: presetId } });
    if (!preset) {
      return NextResponse.json({ error: "预设成员不存在" }, { status: 404 });
    }

    if (preset.projectId !== projectId) {
      return NextResponse.json({ error: "预设成员不属于本项目" }, { status: 400 });
    }

    await prisma.memberPreset.delete({ where: { id: presetId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "取消失败" },
      { status: 400 }
    );
  }
}

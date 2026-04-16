import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { notifyUser } from "@/lib/notify-user";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const { id: projectId } = await params;
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("memberId");

    if (!memberId) {
      return NextResponse.json({ error: "缺少 memberId" }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { members: true }
    });

    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    const currentMember = project.members.find((m) => m.userId === userId);
    if (!currentMember || currentMember.role !== "OWNER") {
      return NextResponse.json({ error: "只有组长可以移出成员" }, { status: 403 });
    }

    const targetMember = project.members.find((m) => m.id === memberId);
    if (!targetMember) {
      return NextResponse.json({ error: "该成员不存在" }, { status: 404 });
    }

    if (targetMember.role === "OWNER") {
      return NextResponse.json({ error: "不能移出组长，请先转让权限" }, { status: 400 });
    }

    // 发送站内信通知
    await notifyUser({
      userId: targetMember.userId,
      projectId,
      kind: "MEMBER_REMOVED",
      title: "你已被移出项目",
      body: `你已被移出项目「${project.title}」`,
      actionUrl: "/"
    });

    await prisma.projectMember.delete({ where: { id: memberId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "移出成员失败" },
      { status: 400 }
    );
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        members: {
          include: { user: true }
        }
      }
    });

    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    const isMember = project.members.some((m) => m.userId === userId);
    if (!isMember) {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const members = project.members.map((m) => ({
      id: m.id,
      name: m.user.name,
      projectNickname: m.projectNickname,
      role: m.role,
      joinedStatus: m.joinedStatus
    }));

    const presets = await prisma.memberPreset.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "asc" }
    });

    return NextResponse.json({
      members,
      presets: presets.map((p) => ({
        id: p.id,
        presetName: p.presetName
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "加载成员失败" },
      { status: 400 }
    );
  }
}

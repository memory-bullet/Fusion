import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { notifyUser } from "@/lib/notify-user";

const transferSchema = z.object({
  newOwnerId: z.string()
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    const currentUserId = await requireUserId();
    const body = transferSchema.parse(await request.json());

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          include: { user: { select: { name: true } } }
        }
      }
    });

    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    const currentMember = project.members.find((m) => m.userId === currentUserId);
    if (!currentMember || currentMember.role !== "OWNER") {
      return NextResponse.json({ error: "只有组长可以转让权限" }, { status: 403 });
    }

    const newOwnerMember = project.members.find((m) => m.userId === body.newOwnerId);
    if (!newOwnerMember) {
      return NextResponse.json({ error: "目标成员不存在" }, { status: 404 });
    }

    if (newOwnerMember.joinedStatus !== "ACTIVATED") {
      return NextResponse.json({ error: "只能转让给已入驻的成员" }, { status: 400 });
    }

    if (newOwnerMember.userId === currentUserId) {
      return NextResponse.json({ error: "不能转让给自己" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      // 将当前组长降为普通成员
      await tx.projectMember.update({
        where: { id: currentMember.id },
        data: { role: "MEMBER" }
      });

      // 将目标成员提升为组长
      await tx.projectMember.update({
        where: { id: newOwnerMember.id },
        data: { role: "OWNER" }
      });

      // 记录日志
      await tx.actionLog.create({
        data: {
          projectId,
          userId: currentUserId,
          actionType: "OWNER_TRANSFERRED",
          description: `组长权限已转让给 ${newOwnerMember.projectNickname || newOwnerMember.user?.name || "新组长"}`
        }
      });
    });

    // 获取项目信息
    const projectInfo = await prisma.project.findUnique({
      where: { id: projectId },
      select: { title: true }
    });

    const newOwnerName = newOwnerMember.projectNickname || newOwnerMember.user?.name || "新组长";
    const oldOwnerName = currentMember.projectNickname || currentMember.user?.name || "原组长";

    // 通知新组长
    await notifyUser({
      userId: newOwnerMember.userId,
      projectId,
      kind: "BECAME_OWNER",
      title: "你已成为项目组长",
      body: `你已成为项目「${projectInfo?.title || "未命名项目"}」的组长，现在可以管理任务、邀请成员等`,
      actionUrl: `/project/${projectId}/manage`
    });

    // 通知所有其他成员（除了新组长和原组长）
    const allMembers = await prisma.projectMember.findMany({
      where: {
        projectId,
        userId: {
          notIn: [currentUserId, newOwnerMember.userId]
        }
      },
      select: { userId: true }
    });

    await Promise.all(
      allMembers.map((member) =>
        notifyUser({
          userId: member.userId,
          projectId,
          kind: "OWNER_CHANGED",
          title: "项目组长已变更",
          body: `项目「${projectInfo?.title || "未命名项目"}」的组长已从「${oldOwnerName}」变更为「${newOwnerName}」`,
          actionUrl: `/project/${projectId}`
        })
      )
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "格式错误" }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "转让失败" },
      { status: 400 }
    );
  }
}

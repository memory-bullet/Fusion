import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { USER_COOKIE } from "@/lib/auth";
import { sessionCookieOptions } from "@/lib/session-cookie";
import { getRegisteredUserId } from "@/lib/require-registered-user";
import { resolveProjectByInviteCode } from "@/lib/project-join";

/**
 * POST /api/join-by-invite
 * 处理从邀请链接（含 inviteCode + presetId）直接加入并激活预设的流程。
 * 用于登录/注册后由前端调用，完成「加入项目 + 代入预设昵称」的联合操作。
 */
const JoinByInviteSchema = z.object({
  inviteCode: z.string().min(1),
  presetId: z.string().optional()
});

export async function POST(request: NextRequest) {
  try {
    const body = JoinByInviteSchema.parse(await request.json());

    // 解析项目
    const project = await resolveProjectByInviteCode(body.inviteCode);
    if (!project) {
      return NextResponse.json({ error: "邀请码无效或项目不存在" }, { status: 404 });
    }
    const projectId = project.id;

    // 验证已登录
    const reg = await getRegisteredUserId();
    if (reg.ok === false) {
      if (reg.reason === "no_session") {
        return NextResponse.json({ error: "请先登录" }, { status: 401 });
      }
      return NextResponse.json({ error: "请使用已注册账号" }, { status: 403 });
    }
    const userId = reg.userId;

    const cookieStore = await cookies();

    // 检查是否已有成员关系
    const existingMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } }
    });

    let presetActivated = false;

    await prisma.$transaction(async (tx) => {
      // 激活预设（如果提供了 presetId）：设置项目内显示昵称，不覆盖全局 User.name
      if (body.presetId) {
        const preset = await tx.memberPreset.findUnique({ where: { id: body.presetId } });
        if (preset && preset.projectId === projectId && !preset.activated) {
          await tx.memberPreset.update({
            where: { id: body.presetId },
            data: { activated: true, activatedBy: userId }
          });
          // 仅设置项目内显示昵称，保留全局用户名
          await tx.projectMember.updateMany({
            where: { projectId, userId },
            data: { displayName: preset.presetName }
          });
          presetActivated = true;
        }
      }

      // 创建/确认成员关系
      if (!existingMember) {
        await tx.projectMember.create({
          data: {
            projectId,
            userId,
            role: "MEMBER",
            joinedStatus: "ACTIVATED",
            displayName: body.presetId
              ? (await tx.memberPreset.findUnique({ where: { id: body.presetId } }))?.presetName ?? null
              : null
          }
        });
        await tx.actionLog.create({
          data: {
            projectId,
            userId,
            actionType: "MEMBER_JOINED",
            description: `${body.presetId ? "通过邀请链接" : "成员"} 加入项目`
          }
        });
      } else if (presetActivated) {
        await tx.projectMember.update({
          where: { projectId_userId: { projectId, userId } },
          data: { joinedStatus: "ACTIVATED" }
        });
        await tx.actionLog.create({
          data: {
            projectId,
            userId,
            actionType: "MEMBER_ACTIVATED",
            description: "激活预设并加入项目"
          }
        });
      }
    });

    cookieStore.set(USER_COOKIE, userId, sessionCookieOptions());
    return NextResponse.json({ projectId, presetActivated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "格式错误" }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "加入失败" },
      { status: 400 }
    );
  }
}

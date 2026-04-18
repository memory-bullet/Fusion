import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { USER_COOKIE } from "@/lib/auth";
import { sessionCookieOptions } from "@/lib/session-cookie";
import { getRegisteredUserId } from "@/lib/require-registered-user";
import { linkExistingUserToProject, resolveProjectByInviteCode } from "@/lib/project-join";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify-user";

const joinBodySchema = z
  .object({
    projectId: z.string().min(1).optional(),
    inviteCode: z.string().min(1).optional()
  })
  .refine((b) => {
    const hasId = Boolean(b.projectId?.trim());
    const hasCode = Boolean(b.inviteCode?.trim());
    return hasId !== hasCode;
  }, {
    message: "请只填「项目 ID」或「邀请码」其中一项"
  });

export async function POST(request: NextRequest) {
  try {
    const body = joinBodySchema.parse(await request.json());

    let projectId: string;
    let presetName: string | null = null;

    if (body.projectId?.trim()) {
      projectId = body.projectId.trim();
    } else {
      const inviteCode = body.inviteCode!.trim();

      // 尝试解析邀请码：可能是 "FUSION-1975" 或 "FUSION-1975 张三"
      const parts = inviteCode.split(/\s+/); // 按空格分割
      const projectInviteCode = parts[0]; // 第一部分是项目邀请码
      const memberNickname = parts.slice(1).join(" ").trim(); // 剩余部分是成员昵称

      // 查找项目
      const project = await resolveProjectByInviteCode(projectInviteCode);
      if (!project) {
        return NextResponse.json({ error: "邀请码无效或项目不存在" }, { status: 404 });
      }
      projectId = project.id;

      // 如果提供了成员昵称，查找对应的预设成员
      if (memberNickname) {
        const preset = await prisma.memberPreset.findFirst({
          where: {
            projectId,
            presetName: memberNickname
          }
        });

        if (preset) {
          presetName = preset.presetName;
          console.log('[join] Found preset by nickname:', { presetName, projectId });
        } else {
          console.log('[join] Preset not found for nickname:', memberNickname);
        }
      }
    }

    const reg = await getRegisteredUserId();
    if (reg.ok === false) {
      if (reg.reason === "no_session") {
        return NextResponse.json({ error: "请先登录或注册后再加入项目" }, { status: 401 });
      }
      return NextResponse.json({ error: "请使用已注册账号登录后再加入项目" }, { status: 403 });
    }

    const cookieStore = await cookies();

    // 如果找到预设成员，使用预设昵称加入
    if (presetName) {
      // 检查是否已有成员关系
      const existingMember = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: reg.userId } }
      });

      await prisma.$transaction(async (tx) => {
        // 删除预设记录
        await tx.memberPreset.deleteMany({
          where: {
            projectId,
            presetName
          }
        });

        // 创建/更新成员关系
        if (!existingMember) {
          await tx.projectMember.create({
            data: {
              projectId,
              userId: reg.userId,
              role: "MEMBER",
              joinedStatus: "ACTIVATED",
              projectNickname: presetName
            }
          });
        } else {
          await tx.projectMember.update({
            where: { projectId_userId: { projectId, userId: reg.userId } },
            data: {
              joinedStatus: "ACTIVATED",
              projectNickname: presetName
            }
          });
        }

        // 记录日志
        await tx.actionLog.create({
          data: {
            projectId,
            userId: reg.userId,
            actionType: "MEMBER_ACTIVATED",
            description: `通过专属邀请加入项目，昵称：${presetName}`
          }
        });
      });

      console.log('[join] Member joined with preset:', { userId: reg.userId, presetName });

      // 发送站内信通知
      await notifyUser({
        userId: reg.userId,
        projectId,
        kind: "PROJECT_JOINED",
        title: "成功加入项目",
        body: `你已成功加入项目，项目内昵称为「${presetName}」`,
        actionUrl: `/project/${projectId}`
      });

      cookieStore.set(USER_COOKIE, reg.userId, sessionCookieOptions());
      return NextResponse.json({
        projectId,
        userId: reg.userId,
        alreadyMember: Boolean(existingMember),
        presetActivated: true
      });
    }

    // 普通加入（没有预设）
    const result = await linkExistingUserToProject(reg.userId, projectId);

    // 发送站内信通知
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { title: true }
    });

    await notifyUser({
      userId: reg.userId,
      projectId,
      kind: "PROJECT_JOINED",
      title: "成功加入项目",
      body: `你已成功加入项目「${project?.title || "未命名项目"}」`,
      actionUrl: `/project/${projectId}`
    });

    cookieStore.set(USER_COOKIE, result.userId, sessionCookieOptions());
    return NextResponse.json({
      projectId: result.projectId,
      userId: result.userId,
      alreadyMember: result.alreadyMember
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const msg = error.issues[0]?.message ?? "请求格式错误";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "??????";
    const status = message === "?????" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

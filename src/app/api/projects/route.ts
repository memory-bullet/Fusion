import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { USER_COOKIE, getCurrentUserId } from "@/lib/auth";
import { sessionCookieOptions } from "@/lib/session-cookie";

const createProjectSchema = z.object({
  title: z.string().min(2),
  deadline: z.string().datetime(),
  ownerName: z.string().min(1),
  memberNames: z.array(z.string().min(1)).default([])
});

function inviteCode(): string {
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `FUSION-${rand}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = createProjectSchema.parse(await request.json());
    const sessionUserId = await getCurrentUserId();
    if (!sessionUserId) {
      return NextResponse.json({ error: "请先登录后再创建项目" }, { status: 401 });
    }

    const account = await prisma.user.findUnique({ where: { id: sessionUserId } });
    if (!account?.email?.trim() || !account.passwordHash) {
      return NextResponse.json(
        {
          error:
            "创建项目需使用已注册账号。请先注册或登录；若当前仅为匿名加入身份，请先退出匿名会话后再登录。"
        },
        { status: 403 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const owner = await tx.user.update({
        where: { id: sessionUserId },
        data: { name: body.ownerName.trim() }
      });

      const project = await tx.project.create({
        data: {
          title: body.title,
          deadline: new Date(body.deadline),
          inviteCode: inviteCode()
        }
      });

      await tx.projectMember.create({
        data: {
          projectId: project.id,
          userId: owner.id,
          role: "OWNER"
        }
      });

      for (const name of body.memberNames) {
        // 创建预设成员（仅 MemberPreset，不创建占位 User）
        // 用户入驻后 join 接口会创建对应的 ProjectMember
        await tx.memberPreset.create({
          data: {
            projectId: project.id,
            presetName: name.trim()
          }
        });
      }

      await tx.actionLog.create({
        data: {
          projectId: project.id,
          userId: owner.id,
          actionType: "PROJECT_CREATED",
          description: `${owner.name} 创建了项目`
        }
      });

      return { owner, project };
    });

    const cookieStore = await cookies();
    cookieStore.set(USER_COOKIE, result.owner.id, sessionCookieOptions());

    return NextResponse.json({
      projectId: result.project.id,
      inviteCode: result.project.inviteCode,
      ownerId: result.owner.id
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create project" },
      { status: 400 }
    );
  }
}

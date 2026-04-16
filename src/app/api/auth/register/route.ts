import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { USER_COOKIE } from "@/lib/auth";
import { sessionCookieOptions } from "@/lib/session-cookie";

const registerSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(8, "密码至少 8 位").max(72),
  name: z.string().min(1, "请填写昵称").max(40)
});

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function generateInviteCode(): string {
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `FUSION-${rand}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = registerSchema.parse(await request.json());
    const email = normalizeEmail(body.email);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "该邮箱已注册，请直接登录" }, { status: 409 });
    }

    const passwordHash = await hashPassword(body.password);

    // 创建用户并自动创建个人草稿空间
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: body.name.trim(),
          email,
          passwordHash
        }
      });

      // 创建个人草稿空间（默认项目）
      const draftProject = await tx.project.create({
        data: {
          title: "我的任务草稿",
          deadline: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1年后
          inviteCode: generateInviteCode()
        }
      });

      // 将用户设为草稿空间的 OWNER
      await tx.projectMember.create({
        data: {
          projectId: draftProject.id,
          userId: user.id,
          role: "OWNER"
        }
      });

      await tx.actionLog.create({
        data: {
          projectId: draftProject.id,
          userId: user.id,
          actionType: "PROJECT_CREATED",
          description: `${user.name} created personal draft space`
        }
      });

      return { user, draftProject };
    });

    const cookieStore = await cookies();
    cookieStore.set(USER_COOKIE, result.user.id, sessionCookieOptions());

    return NextResponse.json({
      user: { id: result.user.id, name: result.user.name, email: result.user.email }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "格式错误" }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "注册失败" },
      { status: 400 }
    );
  }
}

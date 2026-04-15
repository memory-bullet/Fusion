import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { USER_COOKIE } from "@/lib/auth";
import { sessionCookieOptions } from "@/lib/session-cookie";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    const body = loginSchema.parse(await request.json());
    const email = normalizeEmail(body.email);

    const user = await prisma.user.findUnique({ where: { email } });
    const fail = () => NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });

    if (!user?.passwordHash) {
      return fail();
    }

    const ok = await verifyPassword(body.password, user.passwordHash);
    if (!ok) {
      return fail();
    }

    const cookieStore = await cookies();
    cookieStore.set(USER_COOKIE, user.id, sessionCookieOptions());

    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "格式错误" }, { status: 400 });
    }
    return NextResponse.json({ error: "登录失败" }, { status: 400 });
  }
}

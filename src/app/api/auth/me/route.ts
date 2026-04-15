import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { getRegisteredUserId } from "@/lib/require-registered-user";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ user: null });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true }
  });

  if (!user) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email
    }
  });
}

const patchSchema = z.object({
  name: z.string().min(1, "昵称至少 1 个字符").max(40, "昵称过长")
});

export async function PATCH(request: NextRequest) {
  try {
    const reg = await getRegisteredUserId();
    if (reg.ok === false) {
      if (reg.reason === "no_session") {
        return NextResponse.json({ error: "请先登录" }, { status: 401 });
      }
      return NextResponse.json({ error: "请使用已注册账号" }, { status: 403 });
    }

    const body = patchSchema.parse(await request.json());
    const user = await prisma.user.update({
      where: { id: reg.userId },
      data: { name: body.name.trim() },
      select: { id: true, name: true, email: true }
    });

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
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

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

const patchSchema = z.object({
  projectNickname: z.string().max(40, "昵称过长")
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const { id: projectId } = await params;

    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId
        }
      }
    });

    if (!membership) {
      return NextResponse.json({ error: "你不是该项目成员" }, { status: 403 });
    }

    const body = patchSchema.parse(await request.json());
    const trimmed = body.projectNickname.trim();

    const updated = await prisma.projectMember.update({
      where: { id: membership.id },
      data: { projectNickname: trimmed || null },
      select: { id: true, projectNickname: true }
    });

    return NextResponse.json({
      ok: true,
      projectNickname: updated.projectNickname
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "格式错误" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新失败" },
      { status: 400 }
    );
  }
}

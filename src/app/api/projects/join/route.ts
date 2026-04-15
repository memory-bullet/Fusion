import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { USER_COOKIE } from "@/lib/auth";
import { sessionCookieOptions } from "@/lib/session-cookie";
import { getRegisteredUserId } from "@/lib/require-registered-user";
import { linkExistingUserToProject, resolveProjectByInviteCode } from "@/lib/project-join";

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
    if (body.projectId?.trim()) {
      projectId = body.projectId.trim();
    } else {
      const project = await resolveProjectByInviteCode(body.inviteCode!);
      if (!project) {
        return NextResponse.json({ error: "邀请码无效或项目不存在" }, { status: 404 });
      }
      projectId = project.id;
    }

    const reg = await getRegisteredUserId();
    if (reg.ok === false) {
      if (reg.reason === "no_session") {
        return NextResponse.json({ error: "请先登录或注册后再加入项目" }, { status: 401 });
      }
      return NextResponse.json({ error: "请使用已注册账号登录后再加入项目" }, { status: 403 });
    }

    const cookieStore = await cookies();
    const result = await linkExistingUserToProject(reg.userId, projectId);
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
    const message = error instanceof Error ? error.message : "Join failed";
    const status = message === "Project not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

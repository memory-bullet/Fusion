import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { USER_COOKIE } from "@/lib/auth";
import { sessionCookieOptions } from "@/lib/session-cookie";
import { getRegisteredUserId } from "@/lib/require-registered-user";
import { linkExistingUserToProject } from "@/lib/project-join";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const reg = await getRegisteredUserId();
    if (reg.ok === false) {
      if (reg.reason === "no_session") {
        return NextResponse.json({ error: "请先登录或注册后再加入项目" }, { status: 401 });
      }
      return NextResponse.json({ error: "请使用已注册账号登录后再加入项目" }, { status: 403 });
    }

    const cookieStore = await cookies();
    const result = await linkExistingUserToProject(reg.userId, id);
    cookieStore.set(USER_COOKIE, result.userId, sessionCookieOptions());
    return NextResponse.json({
      projectId: result.projectId,
      userId: result.userId,
      alreadyMember: result.alreadyMember
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Join failed";
    const status = message === "Project not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

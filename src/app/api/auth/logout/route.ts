import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { USER_COOKIE } from "@/lib/auth";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.set(USER_COOKIE, "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax" });
  return NextResponse.json({ ok: true });
}

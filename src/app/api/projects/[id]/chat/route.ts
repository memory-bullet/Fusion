import { NextRequest, NextResponse } from "next/server";
import { requireProjectMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLlmMissingConfigMessage, isLlmConfigured, streamProjectChat } from "@/lib/llm-router";
import { buildProjectSnapshotForAi } from "@/lib/project-ai-context";
import { humanizeRelayError } from "@/lib/relay-error-message";

export const maxDuration = 120;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_USER_CHARS = 8_000;
const HISTORY_WINDOW = 48;

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    await requireProjectMember(projectId);

    const rows = await prisma.projectChatMessage.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
      take: 200
    });

    // 获取项目成员信息以获取项目内昵称
    const members = await prisma.projectMember.findMany({
      where: { projectId },
      select: { userId: true, projectNickname: true }
    });
    const memberMap = new Map(members.map(m => [m.userId, m.projectNickname]));

    return NextResponse.json({
      messages: rows.map((m) => {
        if (!m.user) return {
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
          user: null
        };

        const projectNickname = memberMap.get(m.user.id);
        const displayName = projectNickname?.trim() || m.user.name;

        return {
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
          user: { id: m.user.id, name: displayName }
        };
      })
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "加载失败";
    const status = /Not a project member|Missing user|需要登录/.test(msg) ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    const userId = await requireProjectMember(projectId);

    if (!isLlmConfigured()) {
      return NextResponse.json({ error: getLlmMissingConfigMessage() }, { status: 503 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
    }
    const content =
      typeof body === "object" && body !== null && "content" in body && typeof (body as { content: unknown }).content === "string"
        ? (body as { content: string }).content.trim()
        : "";
    if (!content) {
      return NextResponse.json({ error: "消息不能为空" }, { status: 400 });
    }
    if (content.length > MAX_USER_CHARS) {
      return NextResponse.json({ error: `消息过长（上限 ${MAX_USER_CHARS} 字）` }, { status: 400 });
    }

    await prisma.projectChatMessage.create({
      data: {
        projectId,
        userId,
        role: "USER",
        content
      }
    });

    const history = await prisma.projectChatMessage.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: HISTORY_WINDOW
    });
    history.reverse();

    const snapshot = await buildProjectSnapshotForAi(projectId);
    const system =
      "你是高校团队作业辅助助手。下面「项目快照」在每次提问时都会从数据库重新生成，请基于快照与对话历史回答。\n\n" +
      "规则：使用简体中文，条理清晰，给出可执行建议；若快照未包含某项信息，如实说明，不要编造成绩、截止日期或老师要求；可引用快照中的任务名与成员名。\n\n" +
      "【项目快照】\n" +
      snapshot;

    const turns = history
      .filter((m) => m.role === "USER" || m.role === "ASSISTANT")
      .map((m) => ({
        role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
        content: m.content
      }));

    const encoder = new TextEncoder();
    let fullAssistant = "";

    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const piece of streamProjectChat(system, turns)) {
            fullAssistant += piece;
            controller.enqueue(encoder.encode(piece));
          }
        } catch (err) {
          console.error("project chat stream", err);
          const hint = humanizeRelayError(err);
          const fallback = `\n\n[回复中断：${hint}]`;
          fullAssistant += fallback;
          controller.enqueue(encoder.encode(fallback));
        } finally {
          const trimmed = fullAssistant.trim();
          if (trimmed.length > 0) {
            await prisma.projectChatMessage.create({
              data: {
                projectId,
                role: "ASSISTANT",
                content: trimmed
              }
            });
          }
          controller.close();
        }
      }
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "发送失败";
    const status = /Not a project member|Missing user|需要登录/.test(msg) ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

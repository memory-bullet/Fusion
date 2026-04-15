import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireProjectMember } from "@/lib/auth";
import { generateAndStoreProgressDigest } from "@/lib/progress-digest-ai";

export const maxDuration = 120;

const bodySchema = z
  .object({
    scope: z.enum(["day", "week"]).optional()
  })
  .optional();

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireProjectMember(id);

    let scope: "day" | "week" = "week";
    try {
      const raw = await request.json();
      const parsed = bodySchema.parse(raw);
      if (parsed?.scope) scope = parsed.scope;
    } catch {
      /* empty body */
    }

    const digest = await generateAndStoreProgressDigest(id, scope);

    return NextResponse.json({
      digest,
      generatedAt: new Date().toISOString(),
      scope
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成失败";
    const status =
      /GEMINI|OPENAI_API_KEY|未配置|not configured|API key missing|OpenAI-compatible API key missing/i.test(message)
        ? 503
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

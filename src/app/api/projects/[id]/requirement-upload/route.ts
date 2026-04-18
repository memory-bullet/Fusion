import { NextRequest, NextResponse } from "next/server";
import { parseRequirementWithAI } from "@/lib/ai";
import { extractDocumentTextFromFile } from "@/lib/extract-document-text";
import { prisma } from "@/lib/prisma";
import { requireProjectOwner } from "@/lib/auth";

/** 单次请求完成「读文件 + AI 解析」。上限尽量与 OpenAI 长超时一致（见 openai-client）。 */
/** Vercel Pro 等最高约 900s；本地 next dev 通常不限制。 */
export const maxDuration = 900;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function timeoutHint(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (!/timed?\s*out|timeout|ETIMEDOUT|aborted/i.test(msg)) return "";
  return "（提示：本地请检查网络到 API 是否稳定；.env 可设 OPENAI_LONG_TIMEOUT_MS=1800000；部署端路由 maxDuration 需 ≥ 本次请求耗时，Vercel Pro 等可配到 800s 以上。）";
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    const userId = await requireProjectOwner(projectId);

    const formData = await request.formData();
    const file = formData.get("file");
    const textInput = formData.get("text");

    let requirementText: string;

    // 支持文本输入或文件上传（互斥）
    if (textInput && typeof textInput === "string") {
      if (textInput.trim().length === 0) {
        return NextResponse.json({ error: "文本内容不能为空" }, { status: 400 });
      }
      if (textInput.length > 8000) {
        return NextResponse.json({ error: "文本内容超过 8000 字符限制" }, { status: 400 });
      }
      requirementText = textInput.trim();
    } else if (file instanceof File) {
      try {
        requirementText = await extractDocumentTextFromFile(file);
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "文档读取失败" },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json({ error: "请上传文件或输入文本" }, { status: 400 });
    }

    const ai = await parseRequirementWithAI(requirementText);

    await prisma.project.update({
      where: { id: projectId },
      data: {
        contextSummary: ai.contextSummary,
        keyDeliverables: JSON.stringify(ai.keyDeliverables),
        assignmentMilestones: JSON.stringify(ai.milestones)
      }
    });

    await prisma.actionLog.create({
      data: {
        projectId,
        userId,
        actionType: "AI_PARSED_CONTEXT",
        description: "AI generated shared context summary (requirement-upload)"
      }
    });

    return NextResponse.json({
      contextSummary: ai.contextSummary,
      keyDeliverables: ai.keyDeliverables,
      milestones: ai.milestones,
      suggestedTasks: ai.tasks
    });
  } catch (error) {
    const base = error instanceof Error ? error.message : "作业要求解析失败";
    return NextResponse.json({ error: base + timeoutHint(error) }, { status: 400 });
  }
}

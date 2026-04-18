import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectMember } from "@/lib/auth";

type AppealPayload = {
  scoreType: "TOTAL" | "DIMENSION";
  expectedScore?: number;
  dimensionName?: string;
  reason: string;
  evidence?: string;
};

const APPEAL_ACTION_TYPE = "ANALYTICS_APPEAL_SUBMITTED";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    const userId = await requireProjectMember(projectId);
    const body = (await req.json()) as AppealPayload;

    if (!body || (body.scoreType !== "TOTAL" && body.scoreType !== "DIMENSION")) {
      return badRequest("评分类型无效");
    }

    const reason = (body.reason ?? "").trim();
    const evidence = (body.evidence ?? "").trim();
    if (reason.length < 8) {
      return badRequest("申诉理由至少需要 8 个字符");
    }
    if (reason.length > 500 || evidence.length > 500) {
      return badRequest("申诉理由或补充说明过长");
    }

    if (body.scoreType === "DIMENSION" && !(body.dimensionName ?? "").trim()) {
      return badRequest("维度申诉必须填写维度名称");
    }

    if (body.expectedScore != null && (body.expectedScore < 0 || body.expectedScore > 100)) {
      return badRequest("期望分数必须在 0 到 100 之间");
    }

    const payload = {
      scoreType: body.scoreType,
      expectedScore: body.expectedScore ?? null,
      dimensionName: body.dimensionName?.trim() || null,
      reason,
      evidence: evidence || null
    };

    await prisma.$transaction(async (tx) => {
      await tx.actionLog.create({
        data: {
          projectId,
          userId,
          actionType: APPEAL_ACTION_TYPE,
          description: JSON.stringify(payload)
        }
      });

      const owners = await tx.projectMember.findMany({
        where: { projectId, role: "OWNER" },
        select: { userId: true }
      });

      if (owners.length) {
        await tx.userNotification.createMany({
          data: owners.map((owner) => ({
            userId: owner.userId,
            projectId,
            kind: "APPEAL",
            title: "收到新的贡献度评分申诉",
            body: `成员提交了${body.scoreType === "TOTAL" ? "总分" : "维度"}申诉，请尽快处理。`,
            actionUrl: `/project/${projectId}/analytics`
          }))
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "提交申诉失败" },
      { status: 400 }
    );
  }
}

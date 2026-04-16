import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

import { prisma } from "@/lib/prisma";
import { getWarningLevel } from "@/lib/warning";
import { requireProjectMember } from "@/lib/auth";
import { toPublicUser } from "@/lib/user-serialize";
import { buildAnalyticsProfiles, type AnalyticsProfile } from "@/lib/analytics-metrics";

const METRIC_LABELS = ["任务质量", "工作量达成", "过程投入", "协作贡献", "时效责任", "信用记录"] as const;
const METRIC_WEIGHTS = ["25%", "20%", "15%", "15%", "15%", "10%"] as const;

const SCORE_RULES = [
  "总分公式：最终总分 = 加权基础分 × 责任系数 - 违规惩罚 P",
  "六维基础分（0-100）按权重加权：任务质量25%、工作量达成20%、过程投入15%、协作贡献15%、时效责任15%、信用记录10%",
  "时效责任按“逾期时长 / 任务总时长”分档：0%=100；(0,10%]=80；(10%,25%]=65；(25%,50%]=45；(50%,100%]=30；>100%=20",
  "自动接管规则：任务逾期占比达到 50% 且仍未完成，进入自动再分配候选",
  "zero-shot 行为降权：单轮 AI 生成 + 极低人工修改 + 无二次约束；命中后“过程投入”维度上限降至 60",
  "违规惩罚 P：每次逾期未处理 +8；每次被催告后仍无响应 +12；每次被接管 +20；每次明确拒绝任务 +25"
];

const SHOWCASE_PROFILE_PRESET: Array<{
  name: string;
  role: string;
  trendPct: number;
  dimensions: number[];
}> = [
  { name: "队长", role: "项目协调", trendPct: 2.2, dimensions: [96, 95, 92, 94, 100, 98] },
  { name: "小明", role: "后端开发", trendPct: 1.8, dimensions: [92, 93, 88, 90, 100, 96] },
  { name: "小红", role: "前端开发", trendPct: 1.5, dimensions: [90, 91, 85, 88, 100, 95] },
  { name: "李华", role: "产品与文档", trendPct: 1.1, dimensions: [88, 90, 82, 86, 100, 94] }
];

function normalizeName(rawName: string, index: number) {
  const normalized = (rawName || "").trim();
  if (!normalized || /^\?+$/.test(normalized) || normalized.includes("锟")) {
    return ["队长", "小明", "小红", "李华", "成员E", "成员F"][index] ?? `成员${index + 1}`;
  }
  return normalized;
}

function weightedBaseScore(dimensions: number[]) {
  const weights = [0.25, 0.2, 0.15, 0.15, 0.15, 0.1];
  return dimensions.reduce((sum, score, idx) => sum + score * weights[idx], 0);
}

function buildShowcaseProfiles(base: AnalyticsProfile[]): AnalyticsProfile[] {
  return SHOWCASE_PROFILE_PRESET.map((preset, index) => {
    const baseId = base[index]?.id ?? `showcase-${index + 1}`;
    const score = Math.round(weightedBaseScore(preset.dimensions));
    return {
      id: baseId,
      name: preset.name,
      role: preset.role,
      totalScore: score,
      trendPct: preset.trendPct,
      dimensions: preset.dimensions,
      weightedBaseScore: Number(weightedBaseScore(preset.dimensions).toFixed(1)),
      riskCoefficient: 1,
      penalty: 0,
      riskGrade: "NORMAL"
    };
  });
}

function wrapLine(text: string, maxWidth: number, font: any, fontSize: number) {
  const lines: string[] = [];
  let current = "";
  for (const ch of text) {
    const next = current + ch;
    if (font.widthOfTextAtSize(next, fontSize) <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = ch;
  }
  if (current) lines.push(current);
  return lines;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    try {
      await requireProjectMember(id);
    } catch (err) {
      if (id !== "demo") {
        throw err;
      }
    }

    const [project, members, tasks, logs] = await Promise.all([
      prisma.project.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          deadline: true
        }
      }),
      prisma.projectMember.findMany({
        where: { projectId: id },
        include: {
          user: {
            select: { id: true, name: true, accumulatedPoints: true, creditScore: true }
          }
        }
      }),
      prisma.task.findMany({
        where: { projectId: id },
        select: {
          id: true,
          title: true,
          status: true,
          workloadPoints: true,
          createdAt: true,
          deadline: true,
          assignee: {
            select: { id: true, name: true, accumulatedPoints: true, creditScore: true }
          }
        }
      }),
      prisma.actionLog.findMany({
        where: { projectId: id },
        include: {
          user: { select: { id: true, name: true, accumulatedPoints: true, creditScore: true } }
        },
        orderBy: { createdAt: "desc" }
      })
    ]);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const membersForAnalytics = members.map((m, index) => ({
      ...toPublicUser(m.user),
      name: normalizeName(m.user.name, index),
      projectRole: m.role
    }));

    const publicTasks = tasks.map((task: any) => ({
      ...task,
      sourceLabel: null,
      warningLevel: getWarningLevel(task.deadline),
      isReallocated: task.isReallocated ?? false,
      createdAt: task.createdAt ? task.createdAt.toISOString() : undefined,
      deadline: task.deadline.toISOString(),
      assignee: task.assignee ? toPublicUser(task.assignee) : null
    }));

    const publicLogs = logs.map((log) => ({
      actionType: log.actionType,
      description: log.description,
      createdAt: log.createdAt.toISOString(),
      user: toPublicUser(log.user)
    }));

    const computedProfiles = buildAnalyticsProfiles(membersForAnalytics, publicTasks, publicLogs).sort(
      (a, b) => b.totalScore - a.totalScore
    );
    const profiles = id === "demo" ? buildShowcaseProfiles(computedProfiles) : computedProfiles;

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    const fontBytes = await readFile("C:\\Windows\\Fonts\\simhei.ttf");
    const font = await pdfDoc.embedFont(fontBytes, { subset: true });

    let page = pdfDoc.addPage([595, 842]);
    const { width, height } = page.getSize();
    let cursorY = height - 48;
    const marginX = 40;
    const maxTextWidth = width - marginX * 2;

    const ensureSpace = (space: number) => {
      if (cursorY - space < 50) {
        page = pdfDoc.addPage([595, 842]);
        cursorY = height - 48;
      }
    };

    const drawText = (text: string, size = 11, color = rgb(0.1, 0.15, 0.23), lineGap = 6) => {
      const lines = wrapLine(text, maxTextWidth, font, size);
      for (const line of lines) {
        ensureSpace(size + lineGap);
        page.drawText(line, { x: marginX, y: cursorY, size, font, color });
        cursorY -= size + lineGap;
      }
    };

    page.drawText("Fusion Space 贡献度导出报告", {
      x: marginX,
      y: cursorY,
      size: 18,
      font,
      color: rgb(0.05, 0.08, 0.15)
    });
    cursorY -= 28;
    drawText(`项目：${project.title}`);
    drawText(`截止时间：${project.deadline.toISOString().replace("T", " ").slice(0, 19)}`);
    drawText(`导出时间：${new Date().toISOString().replace("T", " ").slice(0, 19)}`);
    cursorY -= 8;

    drawText("一、成员贡献度总分与细分维度", 13, rgb(0.03, 0.1, 0.24));
    cursorY -= 2;

    profiles.forEach((profile, idx) => {
      ensureSpace(96);
      drawText(`${idx + 1}. ${profile.name}｜${profile.role}｜总分 ${profile.totalScore}｜趋势 ${profile.trendPct >= 0 ? "+" : ""}${profile.trendPct}%`, 11);
      const line1 = `${METRIC_LABELS[0]}(${METRIC_WEIGHTS[0]}): ${profile.dimensions[0]}   ${METRIC_LABELS[1]}(${METRIC_WEIGHTS[1]}): ${profile.dimensions[1]}   ${METRIC_LABELS[2]}(${METRIC_WEIGHTS[2]}): ${profile.dimensions[2]}`;
      const line2 = `${METRIC_LABELS[3]}(${METRIC_WEIGHTS[3]}): ${profile.dimensions[3]}   ${METRIC_LABELS[4]}(${METRIC_WEIGHTS[4]}): ${profile.dimensions[4]}   ${METRIC_LABELS[5]}(${METRIC_WEIGHTS[5]}): ${profile.dimensions[5]}`;
      drawText(line1, 10, rgb(0.25, 0.3, 0.4));
      drawText(line2, 10, rgb(0.25, 0.3, 0.4));
      cursorY -= 2;
    });

    cursorY -= 8;
    drawText("二、贡献度评分规则（公开透明）", 13, rgb(0.03, 0.1, 0.24));
    SCORE_RULES.forEach((rule, index) => drawText(`${index + 1}. ${rule}`, 10.5, rgb(0.24, 0.28, 0.37)));

    const pdfBytes = await pdfDoc.save();
    const filename = `fusion-analytics-${project.id}-${new Date().toISOString().slice(0, 10)}.pdf`;

    return new Response(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=\"${filename}\"`
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to export analytics PDF" },
      { status: 400 }
    );
  }
}

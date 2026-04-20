import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { NextResponse } from "next/server";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import sharp from "sharp";

import { prisma } from "@/lib/prisma";
import { getWarningLevel } from "@/lib/warning";
import { requireProjectMember } from "@/lib/auth";
import { toPublicUser } from "@/lib/user-serialize";
import { buildAnalyticsProfiles, type AnalyticsProfile } from "@/lib/analytics-metrics";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 42;
const MARGIN_TOP = 52;
const MARGIN_BOTTOM = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const METRIC_LABELS = ["任务质量", "工作量达成", "过程投入", "协作贡献", "时效责任", "信用记录"] as const;
const METRIC_WEIGHTS = ["25%", "20%", "15%", "15%", "15%", "10%"] as const;
const APPENDIX_RULES = [
  "最终分 = 加权基础分 × 责任系数 - 违规惩罚",
  "六个维度共同构成基础分，重点反映质量、达成、投入、协作、时效与信用。",
  "逾期、拒绝任务或被接管会影响责任系数、惩罚项和信用记录。"
] as const;

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

function formatDateTime(value: Date | string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

function wrapLine(text: string, maxWidth: number, font: PDFFont, fontSize: number) {
  const lines: string[] = [];
  const rawLines = text.split("\n");

  for (const rawLine of rawLines) {
    if (!rawLine.trim()) {
      lines.push("");
      continue;
    }

    let current = "";
    for (const ch of rawLine) {
      const next = current + ch;
      if (font.widthOfTextAtSize(next, fontSize) <= maxWidth) {
        current = next;
        continue;
      }

      if (current) {
        lines.push(current);
      }
      current = ch;
    }

    if (current) {
      lines.push(current);
    }
  }

  return lines;
}

function fileSafe(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "-").trim();
}

function radarPoints(values: number[], centerX: number, centerY: number, radius: number) {
  return values.map((value, index) => {
    const angle = (Math.PI * 2 * index) / values.length - Math.PI / 2;
    const normalizedRadius = (Math.max(0, Math.min(100, value)) / 100) * radius;
    return {
      x: centerX + normalizedRadius * Math.cos(angle),
      y: centerY + normalizedRadius * Math.sin(angle)
    };
  });
}

function polygonPath(points: Array<{ x: number; y: number }>) {
  if (!points.length) return "";
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ") + " Z";
}

function axisPoints(count: number, radius: number, centerX: number, centerY: number) {
  return Array.from({ length: count }).map((_, index) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle)
    };
  });
}

function createRadarSvg(values: number[], average: number[] | null) {
  const size = 420;
  const center = 210;
  const chartRadius = 118;
  const labelRadius = 156;
  const rings = [30, 50, 70, 90];
  const axis = axisPoints(values.length, chartRadius, center, center);
  const labels = axisPoints(values.length, labelRadius, center, center);
  const personalPath = polygonPath(radarPoints(values, center, center, chartRadius));
  const averagePath = average ? polygonPath(radarPoints(average, center, center, chartRadius)) : null;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" fill="#fcfdff"/>
      ${rings
        .map(
          (ring) =>
            `<path d="${polygonPath(radarPoints(Array(values.length).fill(ring), center, center, chartRadius))}" fill="none" stroke="#d9dee8" stroke-width="1" stroke-dasharray="3 5" />`
        )
        .join("")}
      ${axis
        .map(
          (point) =>
            `<line x1="${center}" y1="${center}" x2="${point.x}" y2="${point.y}" stroke="#e5e7eb" stroke-width="1" />`
        )
        .join("")}
      ${
        averagePath
          ? `<path d="${averagePath}" fill="rgba(148,163,184,0.14)" stroke="#94a3b8" stroke-width="2" stroke-dasharray="5 4" />`
          : ""
      }
      <path d="${personalPath}" fill="rgba(29,78,216,0.18)" stroke="#1d4ed8" stroke-width="2.5" />
      ${labels
        .map((point, index) => {
          const text = METRIC_LABELS[index];
          return `<text x="${point.x}" y="${point.y}" fill="#475569" font-size="16" text-anchor="middle" dominant-baseline="middle">${text}</text>`;
        })
        .join("")}
      <rect x="22" y="22" width="16" height="16" fill="rgba(29,78,216,0.35)" stroke="#1d4ed8" stroke-width="1" />
      <text x="48" y="35" fill="#1d4ed8" font-size="16">个人</text>
      ${
        average
          ? `<rect x="116" y="22" width="16" height="16" fill="rgba(148,163,184,0.2)" stroke="#94a3b8" stroke-width="1" />
      <text x="142" y="35" fill="#64748b" font-size="16">团队平均</text>`
          : ""
      }
    </svg>
  `;
}

function riskLabel(risk: string) {
  switch (risk) {
    case "REFUSED":
      return "拒绝任务";
    case "REALLOCATED":
      return "任务被接管";
    case "CRITICAL":
      return "风险提醒";
    case "LATE":
      return "轻微逾期";
    default:
      return "正常";
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
          deadline: true,
          inviteCode: true
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
          sourceLabel: true,
          isReallocated: true,
          ultimatumLevel: true,
          createdById: true,
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
        orderBy: { createdAt: "desc" },
        take: 30
      })
    ]);

    if (!project) {
      return NextResponse.json({ error: "项目不存在。" }, { status: 404 });
    }

    const membersForAnalytics = members.map((m, index) => ({
      ...toPublicUser(m.user),
      id: m.id,
      userId: m.userId,
      role: m.role,
      joinedStatus: m.joinedStatus,
      projectNickname: m.projectNickname,
      name: normalizeName(m.user.name, index),
      projectRole: m.role
    }));

    const memberNicknameMap = new Map(members.map((m) => [m.userId, m.projectNickname?.trim() || m.user.name]));

    const publicTasks = tasks.map((task: any) => ({
      ...task,
      sourceLabel: task.sourceLabel ?? null,
      warningLevel: getWarningLevel(task.deadline),
      isReallocated: task.isReallocated ?? false,
      createdAt: task.createdAt ? task.createdAt.toISOString() : undefined,
      deadline: task.deadline.toISOString(),
      assignee: task.assignee
        ? {
            id: task.assignee.id,
            name: memberNicknameMap.get(task.assignee.id) || task.assignee.name
          }
        : null,
      createdById: task.createdById
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

    const teamOutput = publicTasks.reduce((sum, task) => sum + task.workloadPoints, 0);
    const completed = publicTasks.filter((task) => task.status === "DONE").length;
    const averageScore = Math.round(
      profiles.reduce((sum, profile) => sum + profile.totalScore, 0) / Math.max(profiles.length, 1)
    );
    const overallTrend = Number(
      (profiles.reduce((sum, profile) => sum + profile.trendPct, 0) / Math.max(profiles.length, 1)).toFixed(1)
    );
    const teamAverage =
      profiles.length > 0
        ? METRIC_LABELS.map((_, index) =>
            Math.round(profiles.reduce((sum, profile) => sum + profile.dimensions[index], 0) / profiles.length)
          )
        : null;

    const selectedMemberId = new URL(request.url).searchParams.get("member");
    const highlightedProfile = profiles.find((profile) => profile.id === selectedMemberId) ?? profiles[0] ?? null;

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    pdfDoc.setTitle(`成员贡献度报告-${project.inviteCode}`);
    pdfDoc.setAuthor("Fusion Space");
    pdfDoc.setCreator("Fusion Space");
    pdfDoc.setSubject("成员贡献度报告");

    const fontBytes = await readFile(join(process.cwd(), "src/assets/fonts/ArialUnicode.ttf"));
    const font = await pdfDoc.embedFont(fontBytes, { subset: true });

    const pages: PDFPage[] = [];
    let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);
    let cursorY = PAGE_HEIGHT - MARGIN_TOP;

    const addPage = () => {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      pages.push(page);
      cursorY = PAGE_HEIGHT - MARGIN_TOP;
    };

    const ensureSpace = (needed: number) => {
      if (cursorY - needed < MARGIN_BOTTOM) {
        addPage();
      }
    };

    const drawParagraph = ({
      text,
      x = MARGIN_X,
      size = 11,
      color = rgb(0.2, 0.25, 0.33),
      maxWidth = CONTENT_WIDTH,
      lineGap = 5
    }: {
      text: string;
      x?: number;
      size?: number;
      color?: ReturnType<typeof rgb>;
      maxWidth?: number;
      lineGap?: number;
    }) => {
      const lines = wrapLine(text, maxWidth, font, size);
      const lineHeight = size + lineGap;
      ensureSpace(Math.max(lineHeight, lines.length * lineHeight));

      for (const line of lines) {
        page.drawText(line, { x, y: cursorY, size, font, color });
        cursorY -= lineHeight;
      }
    };

    const drawSectionTitle = (title: string) => {
      ensureSpace(28);
      page.drawText(title, {
        x: MARGIN_X,
        y: cursorY,
        size: 15,
        font,
        color: rgb(0.07, 0.11, 0.19)
      });
      cursorY -= 18;
      page.drawLine({
        start: { x: MARGIN_X, y: cursorY },
        end: { x: PAGE_WIDTH - MARGIN_X, y: cursorY },
        thickness: 1,
        color: rgb(0.9, 0.92, 0.95)
      });
      cursorY -= 14;
    };

    const drawKeyValue = (label: string, value: string, x: number, width: number) => {
      page.drawText(label, {
        x,
        y: cursorY,
        size: 10,
        font,
        color: rgb(0.45, 0.5, 0.58)
      });
      const lines = wrapLine(value, width, font, 11);
      let localY = cursorY - 16;
      for (const line of lines) {
        page.drawText(line, {
          x,
          y: localY,
          size: 11,
          font,
          color: rgb(0.1, 0.14, 0.2)
        });
        localY -= 15;
      }
    };

    page.drawText("成员贡献度报告", {
      x: MARGIN_X,
      y: cursorY,
      size: 22,
      font,
      color: rgb(0.05, 0.08, 0.15)
    });
    cursorY -= 20;
    drawParagraph({
      text: "协作平台成员贡献统计",
      size: 11,
      color: rgb(0.4, 0.46, 0.54),
      lineGap: 4
    });
    cursorY -= 4;
    drawParagraph({
      text: `当前任务：${project.title || "-"}`,
      size: 12,
      color: rgb(0.1, 0.14, 0.2),
      lineGap: 4
    });
    cursorY -= 8;

    const headerBoxHeight = 72;
    ensureSpace(headerBoxHeight + 12);
    page.drawRectangle({
      x: MARGIN_X,
      y: cursorY - headerBoxHeight + 8,
      width: CONTENT_WIDTH,
      height: headerBoxHeight,
      color: rgb(0.97, 0.98, 0.99),
      borderColor: rgb(0.9, 0.93, 0.96),
      borderWidth: 1
    });
    const colWidth = (CONTENT_WIDTH - 24) / 2;
    drawKeyValue("项目编号", project.inviteCode, MARGIN_X + 16, colWidth);
    drawKeyValue("项目截止时间", formatDateTime(project.deadline), MARGIN_X + 16 + colWidth + 24, colWidth);
    cursorY -= 36;
    drawKeyValue("导出时间", formatDateTime(new Date()), MARGIN_X + 16, colWidth);
    drawKeyValue("报告范围", `共 ${profiles.length} 名成员`, MARGIN_X + 16 + colWidth + 24, colWidth);
    cursorY -= 54;

    drawSectionTitle("核心指标摘要");
    const summaryItems = [
      { label: "任务总工作量", value: `${teamOutput} pts` },
      { label: "已完成任务", value: `${completed}` },
      { label: "成员均分", value: `${averageScore}` },
      {
        label: "平均活跃趋势",
        value: Number.isFinite(overallTrend) ? `${overallTrend >= 0 ? "+" : "-"}${Math.abs(overallTrend)}%` : "暂无"
      }
    ];
    const summaryGap = 12;
    const summaryWidth = (CONTENT_WIDTH - summaryGap) / 2;
    const summaryHeight = 58;
    for (let index = 0; index < summaryItems.length; index += 1) {
      if (index % 2 === 0) {
        ensureSpace(summaryHeight + 12);
      }
      const row = Math.floor(index / 2);
      const col = index % 2;
      const x = MARGIN_X + col * (summaryWidth + summaryGap);
      const y = cursorY - row * (summaryHeight + summaryGap);
      page.drawRectangle({
        x,
        y: y - summaryHeight + 8,
        width: summaryWidth,
        height: summaryHeight,
        color: rgb(0.98, 0.99, 1),
        borderColor: rgb(0.9, 0.93, 0.97),
        borderWidth: 1
      });
      page.drawText(summaryItems[index].label, {
        x: x + 14,
        y,
        size: 10,
        font,
        color: rgb(0.45, 0.5, 0.58)
      });
      page.drawText(summaryItems[index].value, {
        x: x + 14,
        y: y - 20,
        size: 17,
        font,
        color: rgb(0.08, 0.11, 0.18)
      });
    }
    cursorY -= 2 * (summaryHeight + summaryGap) + 4;

    drawSectionTitle("核心贡献排行榜");

    const tableColumns = [
      { label: "排名", width: 42 },
      { label: "成员名", width: 116 },
      { label: "角色", width: 120 },
      { label: "最终分", width: 72 },
      { label: "趋势", width: 70 }
    ];
    const tableRowHeight = 21;
    const drawLeaderboardHeader = () => {
      page.drawRectangle({
        x: MARGIN_X,
        y: cursorY - tableRowHeight + 8,
        width: CONTENT_WIDTH,
        height: tableRowHeight,
        color: rgb(0.95, 0.97, 0.99)
      });
      let currentX = MARGIN_X + 10;
      for (const column of tableColumns) {
        page.drawText(column.label, {
          x: currentX,
          y: cursorY - 8,
          size: 10,
          font,
          color: rgb(0.42, 0.47, 0.55)
        });
        currentX += column.width;
      }
      cursorY -= tableRowHeight + 3;
    };

    drawLeaderboardHeader();
    profiles.forEach((profile, index) => {
      ensureSpace(tableRowHeight + 6);
      if (cursorY - (tableRowHeight + 6) < MARGIN_BOTTOM) {
        addPage();
        drawSectionTitle("核心贡献排行榜");
        drawLeaderboardHeader();
      }

      page.drawRectangle({
        x: MARGIN_X,
        y: cursorY - tableRowHeight + 8,
        width: CONTENT_WIDTH,
        height: tableRowHeight,
        color: index === 0 ? rgb(0.96, 0.98, 1) : index % 2 === 0 ? rgb(1, 1, 1) : rgb(0.99, 0.99, 1)
      });

      const cells = [
        `${index + 1}`,
        profile.name,
        profile.role || "-",
        `${profile.totalScore}`,
        `${profile.trendPct >= 0 ? "+" : "-"}${Math.abs(profile.trendPct)}%`
      ];
      let currentX = MARGIN_X + 10;
      cells.forEach((cell, cellIndex) => {
        page.drawText(cell, {
          x: currentX,
          y: cursorY - 8,
          size: 10.5,
          font,
          color:
            cellIndex === 4
              ? profile.trendPct >= 0
                ? rgb(0.12, 0.35, 0.73)
                : rgb(0.8, 0.22, 0.18)
              : rgb(0.15, 0.19, 0.25)
        });
        currentX += tableColumns[cellIndex].width;
      });
      cursorY -= tableRowHeight + 3;
    });

    if (highlightedProfile) {
      const memberSectionHeight = 338;
      if (cursorY - memberSectionHeight < MARGIN_BOTTOM) {
        addPage();
      }

      cursorY -= 8;
      drawSectionTitle("主要成员详情");
      drawParagraph({
        text: `${highlightedProfile.name} · ${highlightedProfile.role || "成员"}`,
        size: 12,
        color: rgb(0.08, 0.11, 0.18),
        lineGap: 4
      });
      const summaryCardHeight = 56;
      page.drawRectangle({
        x: MARGIN_X,
        y: cursorY - summaryCardHeight + 8,
        width: CONTENT_WIDTH,
        height: summaryCardHeight,
        color: rgb(0.98, 0.99, 1),
        borderColor: rgb(0.9, 0.93, 0.97),
        borderWidth: 1
      });
      const detailColWidth = (CONTENT_WIDTH - 36) / 3;
      drawKeyValue("最终分", `${highlightedProfile.totalScore}`, MARGIN_X + 12, detailColWidth);
      drawKeyValue("状态", riskLabel(highlightedProfile.riskGrade), MARGIN_X + 12 + detailColWidth + 12, detailColWidth);
      drawKeyValue("趋势", `${highlightedProfile.trendPct >= 0 ? "+" : "-"}${Math.abs(highlightedProfile.trendPct)}%`, MARGIN_X + 12 + (detailColWidth + 12) * 2, detailColWidth);
      cursorY -= 64;

      const radarBoxHeight = 222;
      const radarBoxWidth = 212;
      const tableBoxX = MARGIN_X + radarBoxWidth + 18;
      const tableBoxWidth = CONTENT_WIDTH - radarBoxWidth - 18;

      page.drawText("成员雷达图", {
        x: MARGIN_X,
        y: cursorY,
        size: 11,
        font,
        color: rgb(0.42, 0.47, 0.55)
      });
      page.drawText("六维分数表", {
        x: tableBoxX,
        y: cursorY,
        size: 11,
        font,
        color: rgb(0.42, 0.47, 0.55)
      });
      cursorY -= 14;

      const radarSvg = createRadarSvg(highlightedProfile.dimensions, teamAverage);
      const radarPng = await sharp(Buffer.from(radarSvg)).png().toBuffer();
      const radarImage = await pdfDoc.embedPng(radarPng);
      page.drawImage(radarImage, {
        x: MARGIN_X,
        y: cursorY - radarBoxHeight + 8,
        width: radarBoxWidth,
        height: radarBoxWidth
      });

      const memberRowHeight = 23;
      page.drawRectangle({
        x: tableBoxX,
        y: cursorY - memberRowHeight + 8,
        width: tableBoxWidth,
        height: memberRowHeight,
        color: rgb(0.95, 0.97, 0.99)
      });
      const dimensionColumns = [
        { label: "维度", width: 78 },
        { label: "权重", width: 40 },
        { label: "分数", width: 34 },
        { label: "表现", width: 70 }
      ];
      let currentX = tableBoxX + 10;
      for (const column of dimensionColumns) {
        page.drawText(column.label, {
          x: currentX,
          y: cursorY - 8,
          size: 9.5,
          font,
          color: rgb(0.42, 0.47, 0.55)
        });
        currentX += column.width;
      }
      let tableY = cursorY - memberRowHeight - 2;

      METRIC_LABELS.forEach((label, index) => {
        page.drawRectangle({
          x: tableBoxX,
          y: tableY - memberRowHeight + 8,
          width: tableBoxWidth,
          height: memberRowHeight,
          color: index % 2 === 0 ? rgb(1, 1, 1) : rgb(0.99, 0.99, 1)
        });
        const score = highlightedProfile.dimensions[index];
        const rowCells = [label, METRIC_WEIGHTS[index], `${score}`];
        let rowX = tableBoxX + 10;
        rowCells.forEach((cell, cellIndex) => {
          page.drawText(cell, {
            x: rowX,
            y: tableY - 8,
            size: 9.5,
            font,
            color: rgb(0.15, 0.19, 0.25)
          });
          rowX += dimensionColumns[cellIndex].width;
        });
        const barX = rowX + 2;
        const barY = tableY - 12;
        const barWidth = 38;
        page.drawRectangle({
          x: barX,
          y: barY,
          width: barWidth,
          height: 7,
          color: rgb(0.92, 0.94, 0.97)
        });
        page.drawRectangle({
          x: barX,
          y: barY,
          width: (barWidth * score) / 100,
          height: 7,
          color: rgb(0.29, 0.49, 0.91)
        });
        page.drawText(score >= 85 ? "稳定" : score >= 70 ? "跟进" : "关注", {
          x: barX + barWidth + 6,
          y: tableY - 8,
          size: 8.5,
          font,
          color: rgb(0.42, 0.47, 0.55)
        });
        tableY -= memberRowHeight + 2;
      });

      cursorY -= radarBoxHeight + 6;
    }

    addPage();
    drawSectionTitle("附录");
    APPENDIX_RULES.forEach((rule) => {
      drawParagraph({
        text: `• ${rule}`,
        size: 10.5,
        color: rgb(0.28, 0.33, 0.4)
      });
    });

    pages.forEach((item, index) => {
      item.drawLine({
        start: { x: MARGIN_X, y: 34 },
        end: { x: PAGE_WIDTH - MARGIN_X, y: 34 },
        thickness: 1,
        color: rgb(0.9, 0.92, 0.95)
      });
      item.drawText(`成员贡献度报告 · ${project.inviteCode}`, {
        x: MARGIN_X,
        y: 20,
        size: 9,
        font,
        color: rgb(0.5, 0.55, 0.62)
      });
      item.drawText(`${index + 1} / ${pages.length}`, {
        x: PAGE_WIDTH - MARGIN_X - 30,
        y: 20,
        size: 9,
        font,
        color: rgb(0.5, 0.55, 0.62)
      });
    });

    const pdfBytes = await pdfDoc.save();
    const dateLabel = formatDate(new Date()).replace(/\//g, "-");
    const humanFilename = `成员贡献度报告-${project.inviteCode}-${dateLabel}.pdf`;
    const asciiFilename = fileSafe(`member-contribution-report-${project.inviteCode}-${dateLabel}.pdf`);

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(humanFilename)}`,
        "Cache-Control": "no-store"
      }
    });
  } catch {
    return NextResponse.json({ error: "PDF 导出失败，请稍后重试。" }, { status: 500 });
  }
}

import { z, ZodError } from "zod";
import { assertLlmConfigured } from "@/lib/llm-config";
import { generateAssignmentJson } from "@/lib/llm-router";
import { applyHundredPointWorkload } from "@/lib/workload-scale";

const aiTaskSchema = z.object({
  title: z.string().min(1),
  workloadPoints: z.coerce.number().int().positive(),
  deadlineOffsetHours: z.coerce.number().int().min(1).max(240)
});

const milestoneSchema = z.object({
  label: z.string().min(1).max(200),
  dueAt: z.union([z.string().max(48), z.null()]).optional(),
  note: z.union([z.string().max(400), z.null()]).optional()
});

const aiResultSchema = z.object({
  contextSummary: z.string().min(5),
  keyDeliverables: z.array(z.string().min(1)).max(20).optional(),
  milestones: z.array(milestoneSchema).max(15).optional(),
  tasks: z.array(aiTaskSchema).min(1).max(20)
});

export type ParsedAiResult = Omit<z.infer<typeof aiResultSchema>, "milestones"> & {
  milestones: z.infer<typeof milestoneSchema>[];
};

function parseJsonFromModelContent(raw: string): unknown {
  const trimmed = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(trimmed);
  const body = fence ? fence[1].trim() : trimmed;
  return JSON.parse(body);
}

/**
 * 硅基流动 / DeepSeek 等模型常把任务名写在 name、task 等字段，或漏掉 title，导致 Zod 报 Required。
 * 在 Zod 校验前统一拉平字段并丢弃无效项。
 */
function normalizeAiParsedJson(input: unknown): unknown {
  if (input == null || typeof input !== "object" || Array.isArray(input)) return input;
  const root = input as Record<string, unknown>;
  const tasksRaw = root.tasks;
  if (!Array.isArray(tasksRaw)) return input;

  const tasks = tasksRaw
    .map((item) => {
      if (item == null || typeof item !== "object" || Array.isArray(item)) return null;
      const t = item as Record<string, unknown>;
      const titleRaw =
        t.title ??
        t.name ??
        t.task ??
        t.taskTitle ??
        t.label ??
        t["任务"] ??
        t["任务名称"] ??
        t["子任务"];
      const title = titleRaw != null ? String(titleRaw).trim() : "";
      if (!title) return null;
      const wp = t.workloadPoints ?? t.points ?? t.weight ?? t.workload ?? t["工作量"];
      const dh = t.deadlineOffsetHours ?? t.deadlineHours ?? t.hours ?? t.offsetHours ?? t["截止偏移小时"];
      const wn = typeof wp === "number" ? wp : Number(wp);
      const hn = typeof dh === "number" ? dh : Number(dh);
      return {
        title,
        workloadPoints: Number.isFinite(wn) && wn > 0 ? Math.floor(wn) : 1,
        deadlineOffsetHours: Number.isFinite(hn) && hn >= 1 ? Math.min(240, Math.floor(hn)) : 48
      };
    })
    .filter((x): x is { title: string; workloadPoints: number; deadlineOffsetHours: number } => x !== null);

  return { ...root, tasks };
}

function isLikelyTimeoutError(err: unknown): boolean {
  const s = err instanceof Error ? err.message : String(err);
  return /timed?\s*out|timeout|ETIMEDOUT|aborted|ECONNRESET|socket hang up/i.test(s);
}

const MAX_REQUIREMENT_CHARS = Math.min(
  Math.max(Number(process.env.AI_REQUIREMENT_MAX_CHARS) || 14_000, 4_000),
  20_000
);

export async function parseRequirementWithAI(rawInput: string): Promise<ParsedAiResult> {
  assertLlmConfigured();

  const clipped =
    rawInput.length > MAX_REQUIREMENT_CHARS
      ? `${rawInput.slice(0, MAX_REQUIREMENT_CHARS)}\n\n[…原文过长已截断，请从已提取部分解析。]`
      : rawInput;

  const system =
    "You are a PM assistant. Output a single JSON object with keys: contextSummary (string), keyDeliverables (string[]), milestones (array), tasks (array). " +
    "contextSummary: concise shared consensus in zh-CN (goals, scope, grading hints if any). " +
    "keyDeliverables: distinct deliverable names only, zh-CN, at least 1 item when the doc mentions outputs; if the doc is vague, infer 2-6 concrete deliverables from sections or typical course work. " +
    "milestones: 0-15 items for explicit or implied deadlines from the assignment; each item: label (zh-CN, short), optional dueAt (ISO 8601 date or datetime string if the doc states a concrete date; else null), optional note (zh-CN vague timing e.g. 第4教学周、期末前). Omit milestones array only if truly none; use empty array if no dates found. " +
    "tasks: 4-12 concrete subtasks in zh-CN matching the assignment (e.g. 文献与资料调研、撰写大纲、制作PPT、排版与校对). " +
    "Each task object MUST include string field \"title\" (non-empty task name in zh-CN). Do not use only \"name\" or \"task\" — always set \"title\". " +
    "workloadPoints: positive integers that sum to EXACTLY 100 across all tasks — relative team effort / weight (可视化占比). " +
    "deadlineOffsetHours: integer 1-240 for each task. No markdown, no extra text.";

  const userPrompt = `Analyze this assignment. Extract milestones/deadlines; propose a task breakdown whose workloadPoints sum to 100.\n\n${clipped}`;

  let outputText: string;
  try {
    outputText = await generateAssignmentJson(system, userPrompt);
  } catch (first) {
    if (isLikelyTimeoutError(first)) {
      await new Promise((r) => setTimeout(r, 1500));
      outputText = await generateAssignmentJson(system, userPrompt);
    } else {
      throw first;
    }
  }
  if (!outputText) {
    throw new Error("AI response is empty");
  }

  const parsed = normalizeAiParsedJson(parseJsonFromModelContent(outputText));
  let raw: z.infer<typeof aiResultSchema>;
  try {
    raw = aiResultSchema.parse(parsed);
  } catch (e) {
    if (e instanceof ZodError) {
      const detail = e.issues
        .slice(0, 5)
        .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
        .join("；");
      throw new Error(
        `AI 返回结果校验未通过（${detail}）。可重试上传，或把作业要求整理成条理更清晰的纯文本后再解析。`
      );
    }
    throw e;
  }

  let keyDeliverables = raw.keyDeliverables ?? [];
  if (keyDeliverables.length === 0 && raw.tasks.length > 0) {
    const seen = new Set<string>();
    for (const t of raw.tasks) {
      const line = t.title.trim();
      if (line && !seen.has(line)) {
        seen.add(line);
        keyDeliverables.push(line);
      }
      if (keyDeliverables.length >= 12) break;
    }
  }
  if (keyDeliverables.length === 0) {
    keyDeliverables = ["综合作业与说明文档"];
  }

  const tasksScaled = applyHundredPointWorkload(
    raw.tasks as Array<{ title: string; workloadPoints: number; deadlineOffsetHours: number }>
  );
  return {
    ...raw,
    keyDeliverables,
    milestones: raw.milestones ?? [],
    tasks: tasksScaled
  };
}

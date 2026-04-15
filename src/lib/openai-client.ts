import OpenAI from "openai";
import { getOpenAiCompatApiKey, getOpenAiCompatBaseUrl } from "@/lib/llm-config";

const THIRTY_MIN_MS = 30 * 60 * 1000;

/** 默认与 OpenAI SDK 一致（约 10 分钟）。也可通过 OPENAI_TIMEOUT_MS 覆盖。 */
function resolveTimeoutMs(): number | undefined {
  const raw = process.env.OPENAI_TIMEOUT_MS;
  if (raw === undefined || raw === "") return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(Math.floor(n), THIRTY_MIN_MS);
}

/**
 * 文档提取（视觉）+ 作业解析等长耗时调用：默认 30 分钟，与 Vercel `maxDuration` 尽量对齐。
 * OPENAI_LONG_TIMEOUT_MS：毫秒，范围 [120000, 1800000]（最长 30 分钟）。
 */
function resolveLongTimeoutMs(): number {
  const raw = process.env.OPENAI_LONG_TIMEOUT_MS;
  if (raw === undefined || raw === "") return THIRTY_MIN_MS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 120_000) return THIRTY_MIN_MS;
  return Math.min(Math.floor(n), THIRTY_MIN_MS);
}

function compatKeyOrThrow(): string {
  const key = getOpenAiCompatApiKey();
  if (!key) {
    throw new Error("OpenAI-compatible API key missing (GEMINI_API_KEY+GEMINI_OPENAI_BASE_URL or OPENAI_API_KEY)");
  }
  return key;
}

export function createOpenAIClient(): OpenAI {
  const timeout = resolveTimeoutMs();
  const baseURL = getOpenAiCompatBaseUrl();
  return new OpenAI({
    apiKey: compatKeyOrThrow(),
    ...(baseURL ? { baseURL } : {}),
    ...(timeout !== undefined ? { timeout } : {})
  });
}

export function createOpenAILongRunningClient(): OpenAI {
  const baseURL = getOpenAiCompatBaseUrl();
  return new OpenAI({
    apiKey: compatKeyOrThrow(),
    ...(baseURL ? { baseURL } : {}),
    timeout: resolveLongTimeoutMs()
  });
}

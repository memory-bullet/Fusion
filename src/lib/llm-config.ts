/**
 * LLM 配置：优先 Gemini（GEMINI_*），否则回退 OpenAI 兼容（OPENAI_*）。
 * - GEMINI_RELAY_BASE_URL：第三方「原生 Gemini」代理（/v1beta/models/...:generateContent）。
 * - 官方 Google AI Studio 密钥多为 AIza 开头 → 走 @google/generative-ai。
 * - sk- + OpenAI 兼容中转 → GEMINI_OPENAI_BASE_URL 或 OPENAI_BASE_URL。
 */

export type LlmBackend = "gemini-relay" | "gemini-native" | "openai-compat" | "unset";

export function getGeminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY?.trim() || undefined;
}

/** 原生 Gemini 代理根地址，勿带尾斜杠，例如 https://api.xxx.com */
export function getGeminiRelayBaseUrl(): string | undefined {
  return process.env.GEMINI_RELAY_BASE_URL?.trim().replace(/\/$/, "") || undefined;
}

export function getOpenAiCompatBaseUrl(): string | undefined {
  const gk = getGeminiApiKey();
  const gBase = process.env.GEMINI_OPENAI_BASE_URL?.trim();
  const oBase = process.env.OPENAI_BASE_URL?.trim();
  if (gk) return gBase || oBase || undefined;
  return oBase || undefined;
}

export function getOpenAiCompatApiKey(): string | undefined {
  const gk = getGeminiApiKey();
  const gBase = process.env.GEMINI_OPENAI_BASE_URL?.trim();
  const oBase = process.env.OPENAI_BASE_URL?.trim();
  if (gk && (gBase || oBase)) return gk;
  return process.env.OPENAI_API_KEY?.trim() || undefined;
}

/** 用于 OpenAI SDK（兼容模式）的模型名 */
export function getCompatModel(): string {
  return (
    process.env.GEMINI_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    "gemini-2.0-flash"
  );
}

/** 用于原生 Gemini 的模型 id */
export function getGeminiNativeModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
}

export function getGeminiVisionModel(): string {
  return (
    process.env.GEMINI_VISION_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    process.env.OPENAI_VISION_MODEL?.trim() ||
    "gemini-2.0-flash"
  );
}

/** OpenAI 兼容（硅基流动等）：图片 OCR 专用模型，优先 OPENAI_VISION_MODEL */
export function getOpenAiCompatVisionModel(): string {
  const v = process.env.OPENAI_VISION_MODEL?.trim() || process.env.GEMINI_VISION_MODEL?.trim();
  if (v) return v;
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

function preferNativeGemini(key: string): boolean {
  if (process.env.GEMINI_NATIVE === "1") return true;
  if (key.startsWith("AIza")) return true;
  if (key.startsWith("sk-")) return false;
  return true;
}

export function getLlmBackend(): LlmBackend {
  const gk = getGeminiApiKey();
  const relay = getGeminiRelayBaseUrl();
  const gBase = process.env.GEMINI_OPENAI_BASE_URL?.trim();
  const oBase = process.env.OPENAI_BASE_URL?.trim();
  const ok = process.env.OPENAI_API_KEY?.trim();

  if (gk) {
    if (relay) return "gemini-relay";
    if (gBase || oBase) return "openai-compat";
    if (preferNativeGemini(gk)) return "gemini-native";
    return "unset";
  }
  if (ok) return "openai-compat";
  return "unset";
}

export function getLlmMissingConfigMessage(): string {
  const gk = getGeminiApiKey();
  const relay = getGeminiRelayBaseUrl();
  const gBase = process.env.GEMINI_OPENAI_BASE_URL?.trim();
  const oBase = process.env.OPENAI_BASE_URL?.trim();
  if (gk?.startsWith("sk-") && !relay && !gBase && !oBase) {
    return "sk- 密钥请配置其一：GEMINI_RELAY_BASE_URL（原生 Gemini 代理根地址，文档里的 /v1beta/models/... 前缀）或 GEMINI_OPENAI_BASE_URL / OPENAI_BASE_URL（OpenAI 兼容地址）。官方 AIza 密钥可只配 GEMINI_API_KEY。";
  }
  return "请配置 GEMINI_API_KEY（推荐）或 OPENAI_API_KEY。";
}

export function assertLlmConfigured(): void {
  if (getLlmBackend() === "unset") {
    throw new Error(getLlmMissingConfigMessage());
  }
}

export function isLlmConfigured(): boolean {
  return getLlmBackend() !== "unset";
}

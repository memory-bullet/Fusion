/**
 * 第三方「原生 Gemini」代理：POST /v1beta/models/{model}:generateContent
 * 流式：POST .../streamGenerateContent?alt=sse
 * 与 OpenAI Chat Completions 路径不同，需单独配置 GEMINI_RELAY_BASE_URL。
 */
import { getGeminiApiKey, getGeminiNativeModel, getGeminiRelayBaseUrl, getGeminiVisionModel } from "@/lib/llm-config";

function modelPathId(): string {
  return getGeminiNativeModel().replace(/^models\//, "").trim() || "gemini-2.5-flash";
}

function relayAuthHeaders(apiKey: string): Record<string, string> {
  const mode = (process.env.GEMINI_RELAY_AUTH?.trim().toLowerCase() || "bearer") as string;
  if (mode === "goog-api-key" || mode === "x-goog-api-key") {
    return { "x-goog-api-key": apiKey };
  }
  if (mode === "x-api-key") {
    return { "x-api-key": apiKey };
  }
  return { Authorization: `Bearer ${apiKey}` };
}

function appendKeyQuery(url: string, apiKey: string): string {
  if (process.env.GEMINI_RELAY_KEY_QUERY !== "1") return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}key=${encodeURIComponent(apiKey)}`;
}

function relayTimeoutMs(): number {
  const raw = process.env.GEMINI_RELAY_TIMEOUT_MS?.trim();
  if (!raw) return 900_000;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 1_800_000) : 900_000;
}

async function relayPost(path: string, body: Record<string, unknown>, stream: boolean): Promise<Response> {
  const base = getGeminiRelayBaseUrl()!.replace(/\/$/, "");
  const key = getGeminiApiKey()!;
  let url = `${base}${path}`;
  url = appendKeyQuery(url, key);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: stream ? "text/event-stream" : "application/json",
    ...relayAuthHeaders(key)
  };
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), relayTimeoutMs());
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: ac.signal
    });
    return res;
  } finally {
    clearTimeout(t);
  }
}

function parseSseJsonPayload(payload: string): unknown {
  const o = JSON.parse(payload);
  if (Array.isArray(o) && o.length > 0) return o[0];
  return o;
}

function textFromCandidatePayload(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const d = data as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    error?: { message?: string };
  };
  if (d.error?.message) {
    throw new Error(d.error.message);
  }
  const parts = d.candidates?.[0]?.content?.parts;
  if (!parts?.length) return "";
  return parts.map((p) => p.text ?? "").join("");
}

/** 同一次对话的非流式 generateContent（流式失败时回退） */
export async function generateChatNonStream(
  system: string,
  turns: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  if (turns.length === 0) return "";
  const last = turns[turns.length - 1];
  if (last.role !== "user") throw new Error("Last chat turn must be user");
  const prior = turns.slice(0, -1);
  const model = modelPathId();
  const path = `/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [...contentsFromChatTurns(prior), { role: "user", parts: [{ text: last.content }] }],
    generationConfig: {
      temperature: 0.45,
      maxOutputTokens: 4096
    }
  };
  const res = await relayPost(path, body, false);
  return readJsonResponse(res);
}

async function readJsonResponse(res: Response): Promise<string> {
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(raw.slice(0, 500) || `Gemini relay HTTP ${res.status}`);
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`Gemini relay 返回非 JSON：${raw.slice(0, 200)}`);
  }
  const text = textFromCandidatePayload(data);
  if (!text.trim()) {
    throw new Error("AI response is empty");
  }
  return text.trim();
}

function contentsFromChatTurns(
  turns: { role: "user" | "assistant"; content: string }[]
): Array<{ role: string; parts: Array<{ text: string }> }> {
  return turns.map((t) => ({
    role: t.role === "user" ? "user" : "model",
    parts: [{ text: t.content }]
  }));
}

export async function generateJsonWithSystem(system: string, user: string): Promise<string> {
  const model = modelPathId();
  const path = `/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 8192,
      responseMimeType: "application/json"
    }
  };
  const res = await relayPost(path, body, false);
  return readJsonResponse(res);
}

export async function generateTextWithSystem(
  system: string,
  user: string,
  maxOut = 1024,
  temperature = 0.35
): Promise<string> {
  const model = modelPathId();
  const path = `/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: {
      temperature,
      maxOutputTokens: maxOut
    }
  };
  const res = await relayPost(path, body, false);
  const text = await readJsonResponse(res);
  if (!text) throw new Error("AI digest is empty");
  return text;
}

export async function generateShortLine(system: string, user: string): Promise<string> {
  const text = await generateTextWithSystem(system, user, 200, 0.85);
  return text.trim();
}

export async function extractTextFromImageBase64(mimeType: string, base64: string): Promise<string> {
  const model = getGeminiVisionModel().replace(/^models\//, "").trim() || modelPathId();
  const path = `/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: "Extract all meaningful text from this image. Return plain text only." },
          { inlineData: { mimeType: mimeType || "image/png", data: base64 } }
        ]
      }
    ],
    generationConfig: { temperature: 0.2, maxOutputTokens: 8192 }
  };
  const res = await relayPost(path, body, false);
  return readJsonResponse(res);
}

function emitSseTextDelta(streamAcc: string, piece: string): { delta: string; nextAcc: string } {
  if (!piece) return { delta: "", nextAcc: streamAcc };
  if (piece.startsWith(streamAcc)) {
    return { delta: piece.slice(streamAcc.length), nextAcc: piece };
  }
  return { delta: piece, nextAcc: streamAcc + piece };
}

async function* streamSseRelayLines(
  res: Response
): AsyncGenerator<{ line: string }> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let carry = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    carry += decoder.decode(value, { stream: true });
    const parts = carry.split(/\r?\n/);
    carry = parts.pop() ?? "";
    for (const line of parts) {
      yield { line };
    }
  }
  if (carry.trim()) yield { line: carry };
}

export async function* streamChatWithSystem(
  system: string,
  turns: { role: "user" | "assistant"; content: string }[]
): AsyncGenerator<string> {
  if (turns.length === 0) return;
  const last = turns[turns.length - 1];
  if (last.role !== "user") throw new Error("Last chat turn must be user");
  const prior = turns.slice(0, -1);

  const model = modelPathId();
  const path = `/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [...contentsFromChatTurns(prior), { role: "user", parts: [{ text: last.content }] }],
    generationConfig: {
      temperature: 0.45,
      maxOutputTokens: 4096
    }
  };

  const base = getGeminiRelayBaseUrl()!.replace(/\/$/, "");
  const key = getGeminiApiKey()!;
  let url = `${base}${path}`;
  url = appendKeyQuery(url, key);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream, application/json",
    ...relayAuthHeaders(key)
  };
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), relayTimeoutMs());
  let yielded = false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: ac.signal
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText.slice(0, 400) || `stream HTTP ${res.status}`);
    }

    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json") && res.body) {
      const raw = await res.text();
      let data: unknown;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(`流式接口返回非 SSE JSON：${raw.slice(0, 200)}`);
      }
      const text = textFromCandidatePayload(data);
      if (text) {
        yielded = true;
        yield text;
      }
      return;
    }

    if (!res.body) {
      throw new Error("stream body missing");
    }

    let streamAcc = "";
    for await (const { line } of streamSseRelayLines(res)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(":")) continue;
      let payload = "";
      if (trimmed.startsWith("data:")) {
        payload = trimmed.slice(5).trim();
      } else if (trimmed.startsWith("{")) {
        payload = trimmed;
      }
      if (!payload || payload === "[DONE]") continue;
      try {
        const parsed = parseSseJsonPayload(payload) as { error?: { message?: string } };
        if (parsed && typeof parsed === "object" && "error" in parsed && parsed.error?.message) {
          throw new Error(parsed.error.message);
        }
        const full = textFromCandidatePayload(parsed);
        if (!full) continue;
        const { delta, nextAcc } = emitSseTextDelta(streamAcc, full);
        streamAcc = nextAcc;
        if (delta) {
          yielded = true;
          yield delta;
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  } catch (err) {
    console.error("gemini-relay streamChatWithSystem", err);
    try {
      const fallback = await generateChatNonStream(system, turns);
      if (fallback.trim()) {
        yielded = true;
        yield fallback.trim();
        return;
      }
    } catch (fallbackErr) {
      console.error("gemini-relay generateChatNonStream fallback", fallbackErr);
    }
    throw err;
  } finally {
    clearTimeout(t);
  }

  if (!yielded) {
    try {
      const fallback = await generateChatNonStream(system, turns);
      if (fallback.trim()) yield fallback.trim();
    } catch (e) {
      console.error("gemini-relay empty stream fallback", e);
      throw new Error("上游未返回任何文本（流式为空且非流式失败）");
    }
  }
}

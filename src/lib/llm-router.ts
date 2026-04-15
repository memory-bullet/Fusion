import { createOpenAIClient, createOpenAILongRunningClient } from "@/lib/openai-client";
import {
  assertLlmConfigured,
  getCompatModel,
  getLlmBackend,
  getLlmMissingConfigMessage,
  getOpenAiCompatVisionModel,
  isLlmConfigured
} from "@/lib/llm-config";
import * as gemini from "@/lib/gemini-native-llm";
import * as relay from "@/lib/gemini-relay-llm";

export { isLlmConfigured, getLlmMissingConfigMessage };

export async function generateAssignmentJson(system: string, user: string): Promise<string> {
  assertLlmConfigured();
  const backend = getLlmBackend();
  if (backend === "gemini-native") {
    return gemini.generateJsonWithSystem(system, user);
  }
  if (backend === "gemini-relay") {
    return relay.generateJsonWithSystem(system, user);
  }
  const client = createOpenAILongRunningClient();
  const model = getCompatModel();
  const res = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    temperature: 0.3,
    max_tokens: 4096,
    response_format: { type: "json_object" }
  });
  const text = res.choices[0]?.message?.content;
  if (!text) throw new Error("AI response is empty");
  return text;
}

export async function generateProgressDigestText(system: string, user: string): Promise<string> {
  assertLlmConfigured();
  const backend = getLlmBackend();
  if (backend === "gemini-native") {
    return gemini.generateTextWithSystem(system, user, 1024, 0.35);
  }
  if (backend === "gemini-relay") {
    return relay.generateTextWithSystem(system, user, 1024, 0.35);
  }
  const client = createOpenAIClient();
  const model = getCompatModel();
  const res = await client.chat.completions.create({
    model,
    temperature: 0.35,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ]
  });
  const text = res.choices[0]?.message?.content?.trim();
  if (!text) throw new Error("AI digest is empty");
  return text;
}

export async function generateUltimatumLine(system: string, user: string): Promise<string> {
  assertLlmConfigured();
  const backend = getLlmBackend();
  if (backend === "gemini-native") {
    return gemini.generateShortLine(system, user);
  }
  if (backend === "gemini-relay") {
    return relay.generateShortLine(system, user);
  }
  const client = createOpenAIClient();
  const model = getCompatModel();
  const res = await client.chat.completions.create({
    model,
    max_tokens: 120,
    temperature: 0.85,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ]
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}

export async function visionExtractPlainText(mimeType: string, base64: string): Promise<string> {
  assertLlmConfigured();
  const backend = getLlmBackend();
  if (backend === "gemini-native") {
    return gemini.extractTextFromImageBase64(mimeType, base64);
  }
  if (backend === "gemini-relay") {
    return relay.extractTextFromImageBase64(mimeType, base64);
  }
  const client = createOpenAILongRunningClient();
  const model = getOpenAiCompatVisionModel();
  const res = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "请识别图中所有可读文字，按阅读顺序输出为纯文本。不要描述画面，不要 Markdown。"
          },
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${base64}`, detail: "high" }
          }
        ]
      }
    ],
    temperature: 0.2,
    max_tokens: 4096
  });
  return res.choices[0]?.message?.content?.trim() || "";
}

type ChatTurn = { role: "user" | "assistant"; content: string };

function mergeAdjacentSameRole(turns: ChatTurn[]): ChatTurn[] {
  const out: ChatTurn[] = [];
  for (const t of turns) {
    const prev = out[out.length - 1];
    if (prev && prev.role === t.role) {
      prev.content = `${prev.content}\n\n${t.content}`;
    } else {
      out.push({ ...t });
    }
  }
  return out;
}

export async function* streamProjectChat(system: string, turns: ChatTurn[]): AsyncGenerator<string> {
  assertLlmConfigured();
  const merged = mergeAdjacentSameRole(turns);
  const backend = getLlmBackend();
  if (backend === "gemini-native") {
    yield* gemini.streamChatWithSystem(system, merged);
    return;
  }
  if (backend === "gemini-relay") {
    yield* relay.streamChatWithSystem(system, merged);
    return;
  }
  const client = createOpenAIClient();
  const model = getCompatModel();
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: system },
    ...merged.map((t) => ({
      role: t.role === "user" ? ("user" as const) : ("assistant" as const),
      content: t.content
    }))
  ];
  const stream = await client.chat.completions.create({
    model,
    messages,
    temperature: 0.45,
    max_tokens: 2048,
    stream: true
  });
  for await (const chunk of stream) {
    const piece = chunk.choices[0]?.delta?.content ?? "";
    if (piece) yield piece;
  }
}

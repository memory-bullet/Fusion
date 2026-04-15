import { GoogleGenerativeAI } from "@google/generative-ai";
import { getGeminiApiKey, getGeminiNativeModel, getGeminiVisionModel } from "@/lib/llm-config";

function client() {
  const key = getGeminiApiKey();
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  return new GoogleGenerativeAI(key);
}

export async function generateJsonWithSystem(system: string, user: string): Promise<string> {
  const model = client().getGenerativeModel({
    model: getGeminiNativeModel(),
    systemInstruction: system,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 8192,
      responseMimeType: "application/json"
    }
  });
  const res = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: user }] }]
  });
  const text = res.response.text();
  if (!text?.trim()) throw new Error("AI response is empty");
  return text.trim();
}

export async function generateTextWithSystem(system: string, user: string, maxOut = 1024, temperature = 0.35): Promise<string> {
  const model = client().getGenerativeModel({
    model: getGeminiNativeModel(),
    systemInstruction: system,
    generationConfig: {
      temperature,
      maxOutputTokens: maxOut
    }
  });
  const res = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: user }] }]
  });
  const text = res.response.text()?.trim();
  if (!text) throw new Error("AI digest is empty");
  return text;
}

export async function generateShortLine(system: string, user: string): Promise<string> {
  const model = client().getGenerativeModel({
    model: getGeminiNativeModel(),
    systemInstruction: system,
    generationConfig: {
      temperature: 0.85,
      maxOutputTokens: 200
    }
  });
  const res = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: user }] }]
  });
  return res.response.text()?.trim() ?? "";
}

export async function extractTextFromImageBase64(mimeType: string, base64: string): Promise<string> {
  const model = client().getGenerativeModel({
    model: getGeminiVisionModel(),
    generationConfig: { temperature: 0.2, maxOutputTokens: 8192 }
  });
  const res = await model.generateContent([
    { text: "Extract all meaningful text from this image. Return plain text only." },
    { inlineData: { mimeType: mimeType || "image/png", data: base64 } }
  ]);
  return res.response.text()?.trim() ?? "";
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

export async function* streamChatWithSystem(
  system: string,
  turns: ChatTurn[]
): AsyncGenerator<string> {
  const merged = mergeAdjacentSameRole(turns);
  if (merged.length === 0) return;
  const last = merged[merged.length - 1];
  if (last.role !== "user") {
    throw new Error("Last chat turn must be user");
  }
  const prior = merged.slice(0, -1);

  const history = prior.map((t) => ({
    role: t.role === "user" ? ("user" as const) : ("model" as const),
    parts: [{ text: t.content }]
  }));

  const model = client().getGenerativeModel({
    model: getGeminiNativeModel(),
    systemInstruction: system,
    generationConfig: {
      temperature: 0.45,
      maxOutputTokens: 2048
    }
  });

  const chat = model.startChat({ history });
  const stream = await chat.sendMessageStream(last.content);
  for await (const chunk of stream.stream) {
    const t = chunk.text();
    if (t) yield t;
  }
}

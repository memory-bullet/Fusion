import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { assertLlmConfigured } from "@/lib/llm-config";
import { visionExtractPlainText } from "@/lib/llm-router";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isMarkdownName(lowerName: string): boolean {
  return /\.(md|markdown|mdown|mkd)$/i.test(lowerName);
}

function tooShortMessage(kind: "pdf" | "docx" | "image" | "other"): string {
  if (kind === "pdf") {
    return (
      "从 PDF 中几乎读不到文字。多为扫描版/图片型 PDF（没有可选中文字）。请改用「可复制文字」的 PDF，或导出为 Word（.docx）、Markdown/纯文本后再上传。"
    );
  }
  if (kind === "docx") {
    return "从 Word 文档中读到的文字过少。请确认文件内容非空白，或尝试另存为 .docx 后重试。";
  }
  if (kind === "image") {
    return (
      "从图片中识别到的文字过少。请换更清晰、正对光线的照片，或改用电子版 PDF/Word；若使用硅基流动等 OpenAI 兼容接口，请在 .env 配置 OPENAI_VISION_MODEL（如 Qwen2-VL-7B）。"
    );
  }
  return "从文件中读到的文字过少，无法交给 AI 解析。请换用含可复制文字的格式。";
}

async function extractFromImage(file: File): Promise<string> {
  assertLlmConfigured();

  const bytes = Buffer.from(await file.arrayBuffer());
  const base64 = bytes.toString("base64");
  const mime = file.type || "image/png";

  return visionExtractPlainText(mime, base64);
}

/**
 * 从上传文件提取纯文本（作业要求解析用）。失败时抛出带说明的 Error。
 * 返回已 trim 且长度 ≥10 的文本，最长 20000 字。
 */
export async function extractDocumentTextFromFile(file: File): Promise<string> {
  const type = file.type || "";
  const lowerName = file.name.toLowerCase();

  if ((lowerName.endsWith(".doc") && !lowerName.endsWith(".docx")) || type === "application/msword") {
    throw new Error(
      "不支持旧版 Word（.doc）。请在 Word 中使用「另存为」选择「Word 文档（*.docx）」后再上传。"
    );
  }

  let text = "";
  let extractKind: "pdf" | "docx" | "image" | "other" = "other";

  const markdownMime =
    type === "text/markdown" ||
    type === "text/x-markdown" ||
    type.startsWith("text/markdown;") ||
    type.startsWith("text/x-markdown;");

  if (type.startsWith("image/")) {
    extractKind = "image";
    text = await extractFromImage(file);
  } else if (type === "application/pdf") {
    extractKind = "pdf";
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await pdfParse(buffer);
    text = parsed.text;
  } else if (type === DOCX_MIME || lowerName.endsWith(".docx")) {
    extractKind = "docx";
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  } else if (type === "text/plain" || markdownMime || isMarkdownName(lowerName)) {
    text = await file.text();
  } else if (type === "text/html" || lowerName.endsWith(".html") || lowerName.endsWith(".htm")) {
    const raw = await file.text();
    text = stripHtml(raw);
  } else if (!type || type === "application/octet-stream") {
    if (lowerName.endsWith(".txt") || isMarkdownName(lowerName)) {
      text = await file.text();
    } else if (lowerName.endsWith(".html") || lowerName.endsWith(".htm")) {
      text = stripHtml(await file.text());
    } else if (lowerName.endsWith(".pdf")) {
      extractKind = "pdf";
      const buffer = Buffer.from(await file.arrayBuffer());
      const parsed = await pdfParse(buffer);
      text = parsed.text;
    } else if (lowerName.endsWith(".docx")) {
      extractKind = "docx";
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else {
      throw new Error("不支持的文件类型。请使用 PDF、Word（.docx）、Markdown、HTML、纯文本或常见图片。");
    }
  } else {
    throw new Error("不支持的文件类型。请使用 PDF、Word（.docx）、Markdown、HTML、纯文本或常见图片。");
  }

  const trimmed = text.trim();
  if (trimmed.length < 10) {
    throw new Error(tooShortMessage(extractKind));
  }

  return trimmed.slice(0, 20000);
}

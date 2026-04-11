import OpenAI from "openai";
import pdfParse from "pdf-parse";

const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

async function extractFromImage(file: File): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const base64 = bytes.toString("base64");
  const mime = file.type || "image/png";

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const res = await client.responses.create({
    model,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: "Extract all meaningful text from this image. Return plain text only."
          },
          {
            type: "input_image",
            image_url: `data:${mime};base64,${base64}`,
            detail: "auto"
          }
        ]
      }
    ]
  });

  return res.output_text || "";
}

export function canExtractTextFromFile(type: string): boolean {
  return type === "text/plain" || type === "text/markdown" || type === "application/pdf" || type.startsWith("image/");
}

export async function extractTextFromFile(file: File): Promise<string> {
  const type = file.type;

  if (type === "text/plain" || type === "text/markdown") {
    return file.text();
  }

  if (type === "application/pdf") {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await pdfParse(buffer);
    return parsed.text;
  }

  if (type.startsWith("image/")) {
    return extractFromImage(file);
  }

  throw new Error("Unsupported file type");
}

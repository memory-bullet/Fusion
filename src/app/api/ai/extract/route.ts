import { NextResponse } from "next/server";
import { extractDocumentTextFromFile } from "@/lib/extract-document-text";

export const maxDuration = 900;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const text = await extractDocumentTextFromFile(file);
    return NextResponse.json({ text });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Text extraction failed" },
      { status: 400 }
    );
  }
}

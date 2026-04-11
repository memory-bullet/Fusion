import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const uploadsRoot = path.join(process.cwd(), "uploads");

function safeName(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function saveUploadedFile(projectId: string, file: File) {
  const projectDir = path.join(uploadsRoot, projectId);
  await mkdir(projectDir, { recursive: true });

  const filename = `${Date.now()}-${randomUUID()}-${safeName(file.name)}`;
  const absolutePath = path.join(projectDir, filename);
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, bytes);

  return {
    filename: file.name,
    storedName: filename,
    absolutePath,
    relativePath: path.posix.join("uploads", projectId, filename),
    mimeType: file.type || "application/octet-stream",
    size: bytes.length
  };
}

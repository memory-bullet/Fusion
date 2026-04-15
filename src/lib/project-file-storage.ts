import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

const UPLOAD_ROOT = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(process.cwd(), "uploads");

export function uploadsRoot() {
  return UPLOAD_ROOT;
}

export function absoluteStoragePath(storageKey: string): string {
  const normalized = storageKey.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.includes("..")) {
    throw new Error("Invalid storage key");
  }
  return path.join(UPLOAD_ROOT, ...normalized.split("/"));
}

export async function saveUploadedBytes(storageKey: string, data: Buffer): Promise<void> {
  const full = absoluteStoragePath(storageKey);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
}

export async function removeStoredFile(storageKey: string): Promise<void> {
  try {
    await unlink(absoluteStoragePath(storageKey));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
}

/** 仅保留安全文件名片段 */
export function safeBasename(name: string): string {
  const base = path.basename(name).replace(/[^\w.\-()\u4e00-\u9fff]+/g, "_");
  return base.length > 180 ? base.slice(0, 180) : base || "file";
}

const ALLOWED_EXT = new Set([
  "pdf",
  "doc",
  "docx",
  "md",
  "txt",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "bmp",
  "mp4",
  "webm",
  "mov",
  "mkv",
  "mp3",
  "wav",
  "m4a",
  "aac",
  "ogg",
  "flac",
  "glb",
  "gltf",
  "obj",
  "fbx",
  "stl",
  "zip",
  "rar",
  "7z",
  "ppt",
  "pptx",
  "xls",
  "xlsx",
  "csv",
  "json"
]);

export function extensionOf(filename: string): string {
  const m = /\.([a-zA-Z0-9]{1,8})$/.exec(filename.trim());
  return m ? m[1].toLowerCase() : "";
}

export function assertAllowedUpload(filename: string, byteLength: number, maxBytes: number): void {
  if (byteLength <= 0) throw new Error("空文件");
  if (byteLength > maxBytes) throw new Error(`文件过大（上限 ${Math.round(maxBytes / (1024 * 1024))}MB）`);
  const ext = extensionOf(filename);
  if (!ext || !ALLOWED_EXT.has(ext)) {
    throw new Error("不支持的文件类型，请使用 Word/PDF/Markdown/图片/音视频/常见建模与压缩包等格式");
  }
}

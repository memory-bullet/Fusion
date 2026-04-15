/** 把上游返回的 JSON 错误转成更易读的中文提示 */
export function humanizeRelayError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const j = JSON.parse(raw) as { error?: { message?: string } };
    if (j?.error?.message) {
      return `${j.error.message}（请核对：GEMINI_API_KEY 与 GEMINI_RELAY_BASE_URL 须为同一购买平台；Key 未过期；鉴权方式见 .env 里 GEMINI_RELAY_AUTH 说明。）`;
    }
  } catch {
    /* 非纯 JSON */
  }
  const inner = raw.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (inner) {
    const msg = inner[1].replace(/\\"/g, '"').replace(/\\n/g, " ");
    return `${msg}（请核对 API Key 与中转地址是否同属一个平台。）`;
  }
  return raw.slice(0, 280);
}

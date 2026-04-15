/**
 * 从扫码结果解析邀请码和预设ID：支持完整首页链接（含 ?invite=&preset=）、或纯邀请码文本。
 */
export function parseInviteFromScan(raw: string): { inviteCode: string | null; presetId: string | null } {
  const t = raw.trim();
  if (!t) return { inviteCode: null, presetId: null };

  try {
    const base = typeof window !== "undefined" ? window.location.origin : "http://localhost";
    const u = t.includes("://") ? new URL(t) : new URL(t, base);
    const inv = u.searchParams.get("invite")?.trim();
    const preset = u.searchParams.get("preset")?.trim();
    if (inv) return { inviteCode: inv, presetId: preset ?? null };
  } catch {
    /* 非 URL */
  }

  if (/^FUSION-\d{4}$/i.test(t)) return { inviteCode: t.toUpperCase(), presetId: null };
  if (/^[A-Za-z0-9_-]{4,40}$/.test(t)) return { inviteCode: t, presetId: null };
  return { inviteCode: null, presetId: null };
}

export type AssignmentMilestone = {
  label: string;
  dueAt?: string | null;
  note?: string | null;
};

export function parseAssignmentMilestones(raw: string | null | undefined): AssignmentMilestone[] | null {
  if (!raw?.trim()) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return null;
    const out: AssignmentMilestone[] = [];
    for (const item of v) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const label = typeof o.label === "string" ? o.label.trim() : "";
      if (!label) continue;
      const dueAt = o.dueAt == null || o.dueAt === "" ? null : typeof o.dueAt === "string" ? o.dueAt.trim() : null;
      const note = o.note == null || o.note === "" ? null : typeof o.note === "string" ? o.note.trim() : null;
      out.push({ label, dueAt, note });
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}

export function sortMilestonesByDue(list: AssignmentMilestone[]): AssignmentMilestone[] {
  return [...list].sort((a, b) => {
    const ta = a.dueAt ? Date.parse(a.dueAt) : NaN;
    const tb = b.dueAt ? Date.parse(b.dueAt) : NaN;
    const na = Number.isNaN(ta) ? Infinity : ta;
    const nb = Number.isNaN(tb) ? Infinity : tb;
    return na - nb;
  });
}

export function formatMilestoneDueDisplay(m: AssignmentMilestone, locale = "zh-CN"): string {
  if (m.dueAt) {
    const t = Date.parse(m.dueAt);
    if (!Number.isNaN(t)) {
      return new Date(t).toLocaleString(locale);
    }
    return m.dueAt;
  }
  if (m.note) return m.note;
  return "日期待定";
}

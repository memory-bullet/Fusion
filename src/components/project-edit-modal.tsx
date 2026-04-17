"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, Copy, Check, X } from "lucide-react";

type Props = {
  projectId: string;
  projectTitle: string;
  projectDeadline: string;
  inviteCode: string;
  isOwner: boolean;
  open: boolean;
  onClose: () => void;
  onUpdated: (newTitle: string, newDeadline?: string) => void;
};

export function ProjectEditModal({
  projectId,
  projectTitle,
  projectDeadline,
  inviteCode,
  isOwner,
  open,
  onClose,
  onUpdated
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(projectTitle);
  const [deadline, setDeadline] = useState("");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 每次打开时同步最新项目名和截止时间
  useEffect(() => {
    if (open) {
      setTitle(projectTitle);
      // 转换为 datetime-local 格式 (YYYY-MM-DDTHH:mm)
      const d = new Date(projectDeadline);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      setDeadline(`${year}-${month}-${day}T${hours}:${minutes}`);
      setError(null);
      setCopied(false);
    }
  }, [open, projectTitle, projectDeadline]);

  const copyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [inviteCode]);

  async function handleSave() {
    const trimmed = title.trim();
    if (!trimmed) { setError("项目名称不能为空"); return; }
    if (!deadline) { setError("截止时间不能为空"); return; }

    const newDeadlineISO = new Date(deadline).toISOString();
    const hasChanges = trimmed !== projectTitle || newDeadlineISO !== projectDeadline;
    if (!hasChanges) { onClose(); return; }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmed,
          deadline: newDeadlineISO
        })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "保存失败"); return; }
      onUpdated(trimmed, newDeadlineISO);
      onClose();
    } catch {
      setError("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("确定要删除整个项目吗？此操作不可恢复。")) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "删除失败"); return; }
      router.push("/");
    } catch {
      setError("删除失败，请重试");
      setDeleting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">项目设置</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 项目名称 */}
        {isOwner && (
          <div className="mb-5">
            <label className="mb-1.5 block text-xs font-medium text-slate-500">项目名称</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={60}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
            />
          </div>
        )}

        {/* 项目截止时间 */}
        {isOwner && (
          <div className="mb-5">
            <label className="mb-1.5 block text-xs font-medium text-slate-500">项目截止时间</label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
            />
          </div>
        )}

        {/* 只读展示（非组长） */}
        {!isOwner && (
          <div className="mb-5">
            <label className="mb-1.5 block text-xs font-medium text-slate-500">项目名称</label>
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
              {projectTitle}
            </div>
          </div>
        )}

        {/* 邀请码 */}
        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-medium text-slate-500">邀请码</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
              <span className="font-mono text-sm font-semibold text-slate-800">{inviteCode}</span>
            </div>
            <button
              type="button"
              onClick={copyCode}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "已复制" : "复制"}
            </button>
          </div>
        </div>

        {/* 错误提示 */}
        {error ? (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-600">
            {error}
          </div>
        ) : null}

        {/* 操作按钮 */}
        <div className="flex flex-col gap-2">
          {isOwner && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-900 bg-slate-900 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "保存中…" : "保存"}
            </button>
          )}

          {isOwner && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center justify-center gap-2 rounded-xl border border-red-200 py-2.5 text-sm font-medium text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {deleting ? "删除中…" : "删除项目"}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

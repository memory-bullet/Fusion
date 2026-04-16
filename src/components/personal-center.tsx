"use client";

import { useState } from "react";
import { Edit2, Check, X } from "lucide-react";

type PersonalCenterProps = {
  email: string;
  globalNickname: string;
  onNicknameUpdate: (newName: string) => Promise<void>;
};

const ui = {
  card: "rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm",
  field:
    "w-full rounded-xl border-0 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 ring-1 ring-inset ring-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900",
  btnIcon:
    "inline-flex items-center justify-center rounded-lg p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600"
};

export function PersonalCenter({ email, globalNickname, onNicknameUpdate }: PersonalCenterProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(globalNickname);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const trimmed = editValue.trim();
    if (!trimmed) {
      setError("昵称不能为空");
      return;
    }
    if (trimmed === globalNickname) {
      setIsEditing(false);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onNicknameUpdate(trimmed);
      setIsEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新失败");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setEditValue(globalNickname);
    setIsEditing(false);
    setError(null);
  }

  return (
    <div className={ui.card}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-xs font-medium text-neutral-500 uppercase tracking-wider">
            个人中心
          </div>

          {isEditing ? (
            <div className="space-y-2">
              <input
                className={ui.field}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="输入全局昵称"
                maxLength={40}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                  if (e.key === "Escape") handleCancel();
                }}
              />
              {error && (
                <p className="text-xs text-red-500">{error}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-neutral-800 disabled:opacity-40"
                >
                  <Check className="h-3.5 w-3.5" />
                  {saving ? "保存中…" : "保存"}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-40"
                >
                  <X className="h-3.5 w-3.5" />
                  取消
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-neutral-900">{globalNickname}</span>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className={ui.btnIcon}
                  title="编辑全局昵称"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-1 text-sm text-neutral-500">{email}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

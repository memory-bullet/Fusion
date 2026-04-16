"use client";

import { useState, useRef, useEffect } from "react";
import { MoreVertical, Edit2, Copy, Trash2, GripVertical } from "lucide-react";

type ProjectCardMenuProps = {
  projectId: string;
  projectTitle: string;
  inviteCode: string;
  isDraftSpace?: boolean;
  onRename: (newTitle: string) => Promise<void>;
  onDelete: () => Promise<void>;
  dragHandleProps?: any;
};

export function ProjectCardMenu({
  projectId,
  projectTitle,
  inviteCode,
  isDraftSpace = false,
  onRename,
  onDelete,
  dragHandleProps
}: ProjectCardMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(projectTitle);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuOpen]);

  async function handleRename() {
    const trimmed = newTitle.trim();
    if (!trimmed || trimmed === projectTitle) {
      setRenaming(false);
      return;
    }
    try {
      await onRename(trimmed);
      setRenaming(false);
      setMenuOpen(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "重命名失败");
    }
  }

  function handleCopyInviteCode() {
    navigator.clipboard.writeText(inviteCode);
    alert(`邀请码已复制：${inviteCode}`);
    setMenuOpen(false);
  }

  async function handleDelete() {
    if (isDraftSpace) {
      alert("个人草稿空间不能删除");
      return;
    }
    if (!window.confirm(`确定删除项目「${projectTitle}」？此操作不可恢复。`)) {
      return;
    }
    try {
      await onDelete();
      setMenuOpen(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除失败");
    }
  }

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {/* 拖动手柄 - 仅在提供 dragHandleProps 时显示 */}
      {dragHandleProps && (
        <button
          type="button"
          {...dragHandleProps}
          className="cursor-grab rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 active:cursor-grabbing"
          title="拖动调整顺序"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}

      {/* 菜单按钮 */}
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          title="更多操作"
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-xl border border-neutral-200 bg-white py-1 shadow-lg">
            {renaming ? (
              <div className="px-3 py-2">
                <input
                  className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename();
                    if (e.key === "Escape") setRenaming(false);
                  }}
                  autoFocus
                  maxLength={60}
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={handleRename}
                    className="flex-1 rounded-lg bg-neutral-900 px-2 py-1 text-xs text-white hover:bg-neutral-800"
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenaming(false)}
                    className="flex-1 rounded-lg border border-neutral-200 px-2 py-1 text-xs hover:bg-neutral-50"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setRenaming(true)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                  disabled={isDraftSpace}
                >
                  <Edit2 className="h-4 w-4" />
                  <span>{isDraftSpace ? "改名（草稿空间不可改名）" : "改名"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyInviteCode}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                >
                  <Copy className="h-4 w-4" />
                  <span>复制邀请码</span>
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  disabled={isDraftSpace}
                >
                  <Trash2 className="h-4 w-4" />
                  <span>{isDraftSpace ? "删除（草稿空间不可删除）" : "删除项目"}</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

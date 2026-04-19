"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle, XCircle, Loader2, X, FileUp } from "lucide-react";
import { uploadFileWithProgress, formatFileSize, type UploadQueueItem } from "@/lib/upload-queue";
import { buildDraftFromSuggested, type TaskDraftRow } from "@/lib/task-draft";

type UploadQueuePanelProps = {
  projectId: string;
  /** 用于根据 offset 计算任务草稿截止日期（与 manage 页 requirement-upload 一致） */
  projectDeadline: string | Date;
  isOwner: boolean;
  members: Array<{ id: string }>;
  onTasksGenerated: (tasks: TaskDraftRow[] | null) => void;
  onRefresh: () => Promise<void>;
};

const ACCEPT_UPLOAD =
  ".pdf,.docx,.html,.htm,.txt,.md,.markdown,.mdown,.mkd,text/plain,text/markdown,text/x-markdown,text/html,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif";

const MAX_CONCURRENT_UPLOADS = 2;

export function UploadQueuePanel({
  projectId,
  projectDeadline,
  isOwner,
  members,
  onTasksGenerated,
  onRefresh
}: UploadQueuePanelProps) {
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeUploadsRef = useRef(0);

  // 添加文件到上传队列
  const addFilesToQueue = useCallback((files: FileList | File[]) => {
    if (!isOwner) return;

    const newItems: UploadQueueItem[] = Array.from(files).map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      progress: 0,
      status: "pending"
    }));

    setUploadQueue((prev) => [...prev, ...newItems]);
  }, [isOwner]);

  // 处理单个文件上传
  const processUpload = useCallback(
    (item: UploadQueueItem) => {
      const url = `/api/projects/${projectId}/requirement-upload`;

      const xhr = uploadFileWithProgress(
        item.file,
        url,
        (progress) => {
          setUploadQueue((prev) =>
            prev.map((i) =>
              i.id === item.id ? { ...i, progress, status: "uploading" } : i
            )
          );
        },
        async (response: unknown) => {
          activeUploadsRef.current -= 1;
          setUploadQueue((prev) =>
            prev.map((i) =>
              i.id === item.id ? { ...i, progress: 100, status: "success" } : i
            )
          );

          // 处理响应数据
          const parsePayload = response as {
            suggestedTasks?: Array<{
              title?: unknown;
              workloadPoints?: unknown;
              deadlineOffsetHours?: unknown;
            }>;
          };

          await onRefresh();

          const suggested = parsePayload.suggestedTasks;
          if (Array.isArray(suggested) && suggested.length > 0 && members.length > 0) {
            const normalized = suggested
              .map((t) => ({
                title: String(t.title ?? "").trim(),
                workloadPoints: Number(t.workloadPoints),
                deadlineOffsetHours: Number(t.deadlineOffsetHours)
              }))
              .filter(
                (t) =>
                  t.title.length > 0 &&
                  Number.isInteger(t.workloadPoints) &&
                  t.workloadPoints > 0 &&
                  Number.isInteger(t.deadlineOffsetHours) &&
                  t.deadlineOffsetHours >= 1 &&
                  t.deadlineOffsetHours <= 240
              );
            const rows = buildDraftFromSuggested(normalized, members, projectDeadline);
            onTasksGenerated(rows.length > 0 ? rows : null);
          }
        },
        (error) => {
          activeUploadsRef.current -= 1;
          setUploadQueue((prev) =>
            prev.map((i) =>
              i.id === item.id ? { ...i, status: "error", error } : i
            )
          );
        }
      );

      setUploadQueue((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, xhr, status: "uploading" } : i))
      );
    },
    [projectId, projectDeadline, members, onRefresh, onTasksGenerated]
  );

  // 处理队列中的下一个待上传文件
  const processNextInQueue = useCallback(() => {
    const pending = uploadQueue.find((item) => item.status === "pending");
    if (pending && activeUploadsRef.current < MAX_CONCURRENT_UPLOADS) {
      activeUploadsRef.current += 1;
      processUpload(pending);
    }
  }, [uploadQueue, processUpload]);

  // 监听队列变化，自动处理待上传文件
  useEffect(() => {
    processNextInQueue();
  }, [processNextInQueue]);

  // 取消单个上传
  const cancelUpload = useCallback((id: string) => {
    setUploadQueue((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item?.xhr && item.status === "uploading") {
        item.xhr.abort();
        activeUploadsRef.current -= 1;
      }
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  // 清除已完成或失败的上传
  const clearCompletedUploads = useCallback(() => {
    setUploadQueue((prev) =>
      prev.filter((item) => item.status === "pending" || item.status === "uploading")
    );
  }, []);

  const hasActiveUploads = uploadQueue.some(
    (item) => item.status === "uploading" || item.status === "pending"
  );

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="sr-only"
        accept={ACCEPT_UPLOAD}
        disabled={!isOwner}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            addFilesToQueue(e.target.files);
          }
          e.target.value = "";
        }}
      />

      <button
        type="button"
        disabled={!isOwner}
        onClick={() => fileInputRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (isOwner) setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragActive(false);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragActive(false);
          if (!isOwner) return;
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            addFilesToQueue(e.dataTransfer.files);
          }
        }}
        className={`w-full rounded-[28px] border border-dashed bg-white p-10 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-60 ${
          dragActive ? "border-blue-400 bg-blue-50/40" : "border-slate-200"
        }`}
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-line bg-slate-50">
          <FileUp className="h-7 w-7 text-slate-500" />
        </div>
        <div className="mt-6 text-3xl font-semibold tracking-tight">上传作业要求文档</div>
        <p className="mt-3 text-sm text-muted">
          支持 PDF、Word（.docx）、Markdown、HTML、纯文本与常见图片（含 HEIC）；点击或拖拽到此处，支持批量上传，将自动提取文本并由 AI 解析。
        </p>
        {!isOwner ? (
          <p className="mt-4 text-sm font-medium text-amber-700">仅组长可在此上传并生成任务草稿。</p>
        ) : null}
      </button>

      {uploadQueue.length > 0 && (
        <div className="rounded-2xl border border-line bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">
              上传队列 ({uploadQueue.length})
            </h3>
            {!hasActiveUploads && uploadQueue.length > 0 && (
              <button
                type="button"
                onClick={clearCompletedUploads}
                className="text-xs text-slate-400 underline underline-offset-2 hover:text-slate-600"
              >
                清除已完成
              </button>
            )}
          </div>
          <div className="space-y-2">
            {uploadQueue.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-100 bg-slate-50/50 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-slate-700">
                        {item.file.name}
                      </span>
                      <span className="shrink-0 text-xs text-slate-400">
                        {formatFileSize(item.file.size)}
                      </span>
                    </div>

                    {item.status === "uploading" && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>上传中...</span>
                          <span>{item.progress}%</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {item.status === "success" && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                        <CheckCircle className="h-3.5 w-3.5" />
                        <span>上传成功</span>
                      </div>
                    )}

                    {item.status === "error" && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-red-600">
                        <XCircle className="h-3.5 w-3.5" />
                        <span>{item.error || "上传失败"}</span>
                      </div>
                    )}

                    {item.status === "pending" && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>等待上传...</span>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => cancelUpload(item.id)}
                    className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    title={item.status === "uploading" ? "取消上传" : "移除"}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

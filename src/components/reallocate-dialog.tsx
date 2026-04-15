"use client";

import { CalendarDays, Loader2, SplitSquareVertical } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DashboardData, DashboardTask } from "@/lib/types";

type ReallocatePayload = {
  newDeadline: string;
  allocations: Array<{
    assigneeId: string;
    workloadPoints: number;
  }>;
};

type Props = {
  open: boolean;
  task: DashboardTask | null;
  members: DashboardData["members"];
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (payload: ReallocatePayload) => Promise<void>;
};

type AllocationMode = "single" | "multi";

function creditPenalty(workloadPoints: number): number {
  return Math.max(1, Math.min(20, Math.ceil(workloadPoints / 5)));
}

function toLocalInputValue(isoString: string): string {
  const date = new Date(isoString);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function formatDeadline(deadline: string): string {
  return new Date(deadline).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function taskUrgencyText(deadline: string): string {
  const diffMs = new Date(deadline).getTime() - Date.now();

  if (diffMs <= 0) {
    const overdueDays = Math.max(1, Math.ceil(Math.abs(diffMs) / (1000 * 60 * 60 * 24)));
    return `已逾期 ${overdueDays} 天`;
  }

  const hoursLeft = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
  return `距离截止 ${hoursLeft} 小时`;
}

function safeDeadlineIso(localValue: string, fallback: string): string {
  if (!localValue) return fallback;
  const parsed = new Date(localValue);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

function avatarToken(name: string): string {
  return name.slice(0, 1).toUpperCase();
}

function buildEvenSplit(
  assigneeIds: string[],
  totalWorkload: number
): Array<{ assigneeId: string; workloadPoints: number }> {
  if (assigneeIds.length === 0) return [];
  const base = Math.floor(totalWorkload / assigneeIds.length);
  let remainder = totalWorkload % assigneeIds.length;

  return assigneeIds.map((assigneeId) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return {
      assigneeId,
      workloadPoints: base + extra
    };
  });
}

export function ReallocateDialog({
  open,
  task,
  members,
  submitting,
  error,
  onClose,
  onConfirm
}: Props) {
  const candidateMembers = useMemo(() => {
    if (!task) return [];
    return members
      .filter((member) => member.id !== task.assignee?.id)
      .sort((a, b) => a.accumulatedPoints - b.accumulatedPoints);
  }, [members, task]);

  const recommendedMember = candidateMembers[0] ?? null;
  const [mode, setMode] = useState<AllocationMode>("single");
  const [deadlineInput, setDeadlineInput] = useState("");
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("");
  const [multiAssigneeIds, setMultiAssigneeIds] = useState<string[]>([]);
  const [allocations, setAllocations] = useState<Array<{ assigneeId: string; workloadPoints: number }>>([]);

  useEffect(() => {
    if (!open || !task) {
      setMode("single");
      setDeadlineInput("");
      setSelectedAssigneeId("");
      setMultiAssigneeIds([]);
      setAllocations([]);
      return;
    }

    const nextDeadline = toLocalInputValue(task.deadline);
    const primary = recommendedMember?.id ?? "";
    const initialMulti = candidateMembers.slice(0, Math.min(2, candidateMembers.length)).map((member) => member.id);

    setMode("single");
    setDeadlineInput(nextDeadline);
    setSelectedAssigneeId(primary);
    setMultiAssigneeIds(initialMulti);
    setAllocations(buildEvenSplit(initialMulti, task.workloadPoints));
  }, [open, task, recommendedMember, candidateMembers]);

  if (!open || !task) {
    return null;
  }

  const penalty = creditPenalty(task.workloadPoints);
  const previewDeadline = safeDeadlineIso(deadlineInput, task.deadline);
  const hasOverdue = new Date(previewDeadline).getTime() <= Date.now();
  const totalAllocated = allocations.reduce((sum, item) => sum + item.workloadPoints, 0);
  const multiValid = multiAssigneeIds.length >= 2 && totalAllocated === task.workloadPoints;
  const canConfirm =
    !submitting &&
    deadlineInput.length > 0 &&
    (mode === "single" ? Boolean(selectedAssigneeId) : multiValid);

  function toggleMultiAssignee(assigneeId: string) {
    setMultiAssigneeIds((prev) => {
      const exists = prev.includes(assigneeId);
      const next = exists ? prev.filter((id) => id !== assigneeId) : [...prev, assigneeId];
      setAllocations(buildEvenSplit(next, task.workloadPoints));
      return next;
    });
  }

  function updateAllocation(assigneeId: string, workloadPoints: number) {
    setAllocations((prev) =>
      prev.map((item) =>
        item.assigneeId === assigneeId
          ? { ...item, workloadPoints: Math.max(1, Math.floor(workloadPoints) || 1) }
          : item
      )
    );
  }

  async function handleConfirm() {
    const payload: ReallocatePayload =
      mode === "single"
        ? {
            newDeadline: new Date(deadlineInput).toISOString(),
            allocations: [{ assigneeId: selectedAssigneeId, workloadPoints: task.workloadPoints }]
          }
        : {
            newDeadline: new Date(deadlineInput).toISOString(),
            allocations
          };

    await onConfirm(payload);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/30 p-3">
      <div className="my-auto w-full max-w-[440px] overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-base font-semibold tracking-tight text-slate-900">任务重新分配</h3>
          <p className="mt-1.5 text-[12px] leading-5 text-slate-500">
            {hasOverdue ? "该任务已逾期，正在触发系统流转机制。" : "该任务已进入 CRITICAL 预警，当前满足重新分配条件。"}
          </p>
        </div>

        <div className="max-h-[calc(100vh-8rem)] space-y-3 overflow-y-auto px-4 py-3.5">
          <section className="rounded-[16px] border border-red-100 bg-red-50/60 p-3">
            <div className="text-[13px] font-semibold leading-5 text-slate-800">
              原负责人：{task.assignee?.name ?? "未分配"}（{taskUrgencyText(previewDeadline)}）
            </div>
            <p className="mt-2 text-[13px] font-semibold leading-5 text-red-600">
              动作：将扣除其信用分 -{penalty} 分。
            </p>
            <p className="mt-1.5 text-[12px] leading-5 text-slate-500">当前规则下不会回收任务积分，可改为新的任务 DDL。</p>
          </section>

          <section>
            <div className="text-[13px] font-semibold text-slate-800">分配方式</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("single")}
                className={`rounded-[12px] border px-3 py-2 text-[12px] font-medium transition ${
                  mode === "single"
                    ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                分配给 1 人
              </button>
              <button
                type="button"
                onClick={() => setMode("multi")}
                className={`inline-flex items-center justify-center gap-1.5 rounded-[12px] border px-3 py-2 text-[12px] font-medium transition ${
                  mode === "multi"
                    ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <SplitSquareVertical className="h-3.5 w-3.5" />
                分配给多人
              </button>
            </div>
          </section>

          {mode === "single" ? (
            <section>
              <div className="text-[13px] font-semibold text-slate-800">选择新接手人</div>
              <div className="mt-2 space-y-2">
                {candidateMembers.map((member) => {
                  const selected = member.id === selectedAssigneeId;
                  const recommended = member.id === recommendedMember?.id;

                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => setSelectedAssigneeId(member.id)}
                      className={`flex w-full items-center gap-2.5 rounded-[14px] border px-3 py-2.5 text-left transition ${
                        selected
                          ? "border-emerald-400 bg-emerald-50/40 shadow-[0_0_0_1px_rgba(16,185,129,0.2)]"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
                        {avatarToken(member.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate text-[13px] font-semibold text-slate-800">{member.name}</div>
                          {recommended ? (
                            <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                              推荐
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-0.5 text-[11px] leading-4 text-slate-500">
                          贡献分 {member.accumulatedPoints} · 信用分 {member.creditScore}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : (
            <section className="space-y-3">
              <div>
                <div className="text-[13px] font-semibold text-slate-800">选择参与拆分的人</div>
                <p className="mt-1 text-[11px] leading-4 text-slate-500">先勾选多人，再调整每个人接手的工作量。</p>
              </div>
              <div className="space-y-2">
                {candidateMembers.map((member) => {
                  const selected = multiAssigneeIds.includes(member.id);
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => toggleMultiAssignee(member.id)}
                      className={`flex w-full items-center justify-between rounded-[12px] border px-3 py-2 text-left transition ${
                        selected
                          ? "border-emerald-400 bg-emerald-50/40"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-semibold text-emerald-700">
                          {avatarToken(member.name)}
                        </span>
                        <span className="text-[12px] font-medium text-slate-800">{member.name}</span>
                      </div>
                      <span className="text-[11px] text-slate-500">{selected ? "已加入" : "点击加入"}</span>
                    </button>
                  );
                })}
              </div>

              {multiAssigneeIds.length > 0 ? (
                <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 text-[12px] font-semibold text-slate-700">拆分工作量</div>
                  <div className="space-y-2">
                    {allocations.map((item) => {
                      const member = candidateMembers.find((candidate) => candidate.id === item.assigneeId);
                      return (
                        <div key={item.assigneeId} className="flex items-center gap-2">
                          <div className="min-w-0 flex-1 text-[12px] text-slate-700">{member?.name ?? "成员"}</div>
                          <input
                            type="number"
                            min={1}
                            value={item.workloadPoints}
                            onChange={(e) => updateAllocation(item.assigneeId, Number(e.target.value))}
                            className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[12px] outline-none focus:ring-2 focus:ring-emerald-100"
                          />
                          <span className="text-[11px] text-slate-500">pts</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className={`mt-2 text-[11px] ${totalAllocated === task.workloadPoints ? "text-emerald-600" : "text-red-600"}`}>
                    当前合计 {totalAllocated} / 原任务 {task.workloadPoints}
                  </div>
                  {multiAssigneeIds.length < 2 ? (
                    <div className="mt-1 text-[11px] text-red-600">多人分配至少需要选择 2 人。</div>
                  ) : null}
                </div>
              ) : null}
            </section>
          )}

          <section>
            <div className="text-[13px] font-semibold text-slate-800">新的任务 DDL</div>
            <div className="mt-2 rounded-[12px] border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <label className="flex items-center gap-2">
                <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                <input
                  type="datetime-local"
                  value={deadlineInput}
                  onChange={(e) => setDeadlineInput(e.target.value)}
                  className="w-full bg-transparent text-[12px] leading-5 text-slate-700 outline-none"
                />
              </label>
              <div className="mt-1 text-[11px] text-slate-500">
                当前预览：{formatDeadline(previewDeadline)}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-400">原 DDL：{formatDeadline(task.deadline)}</div>
            </div>
          </section>

          {error ? <p className="text-[12px] leading-5 text-red-600">{error}</p> : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3">
          <button
            type="button"
            className="rounded-full px-3 py-1.5 text-[12px] font-medium text-slate-500 transition hover:text-slate-800"
            onClick={onClose}
            disabled={submitting}
          >
            取消
          </button>
          <button
            type="button"
            className="inline-flex min-w-[112px] items-center justify-center rounded-[10px] bg-emerald-500 px-3.5 py-2 text-[12px] font-semibold text-white shadow-lg transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => void handleConfirm()}
            disabled={!canConfirm}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "确认执行流转"}
          </button>
        </div>
      </div>
    </div>
  );
}

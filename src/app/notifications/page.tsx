"use client";

import { useCallback, useEffect, useState } from "react";
import { TopNav } from "@/components/top-nav";

type Row = {
  id: string;
  projectId: string | null;
  kind: string;
  title: string;
  body: string;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

export default function NotificationsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetch("/api/me/notifications?limit=80", { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 401) {
          setRows(null);
          setError("请先登录后查看站内信。");
          return;
        }
        const text = await r.text();
        let d: { error?: string; notifications?: Row[] } = {};
        try {
          d = text ? (JSON.parse(text) as typeof d) : {};
        } catch {
          setError(
            r.ok
              ? "服务器返回了非 JSON 数据，请检查接口或稍后重试。"
              : `请求失败（HTTP ${r.status}），可能是服务异常或未执行数据库迁移。`
          );
          return;
        }
        if (!r.ok) {
          setError(typeof d.error === "string" ? d.error : "加载失败");
          return;
        }
        setRows(Array.isArray(d.notifications) ? d.notifications : []);
      })
      .catch((e) =>
        setError(
          e instanceof TypeError && e.message === "Failed to fetch"
            ? "无法连接服务器（请确认本页与站点同源、开发服务已启动）。"
            : e instanceof Error
              ? e.message
              : "网络异常"
        )
      );
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function markRead(id: string) {
    const res = await fetch(`/api/me/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true })
    });
    if (res.ok) {
      setRows((prev) =>
        prev ? prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)) : prev
      );
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7fb] text-slate-900">
      <TopNav />
      <div className="shell max-w-2xl py-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">站内信</h1>
          <button
            type="button"
            onClick={() => void load()}
            className="text-sm text-slate-600 underline decoration-line hover:text-slate-900"
          >
            刷新
          </button>
        </div>

        {error ? <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</p> : null}

        {rows && rows.length === 0 ? (
          <p className="text-sm text-slate-500">暂无通知。</p>
        ) : null}

        {rows && rows.length > 0 ? (
          <ul className="space-y-3">
            {rows.map((n) => (
              <li
                key={n.id}
                className={`rounded-2xl border p-4 shadow-sm ${n.readAt ? "border-slate-200 bg-white" : "border-slate-900/15 bg-white ring-1 ring-slate-900/10"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="font-medium text-slate-900">{n.title}</div>
                  <time className="text-xs text-slate-500" dateTime={n.createdAt}>
                    {new Date(n.createdAt).toLocaleString("zh-CN")}
                  </time>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{n.body}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {n.actionUrl ? (
                    <a
                      href={n.actionUrl}
                      onClick={() => void markRead(n.id)}
                      className="inline-flex rounded-full border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                    >
                      前往
                    </a>
                  ) : null}
                  {!n.readAt ? (
                    <button
                      type="button"
                      onClick={() => void markRead(n.id)}
                      className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      标为已读
                    </button>
                  ) : null}
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-500">
                    {n.kind}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </main>
  );
}

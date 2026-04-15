"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { TopNav } from "@/components/top-nav";

type Me = { id: string; name: string; email: string | null };

type OverviewTask = {
  id: string;
  title: string;
  status: string;
  deadline: string;
  ultimatumLevel: string;
  projectId: string;
  projectTitle: string;
};

export default function MePage() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [tasks, setTasks] = useState<OverviewTask[]>([]);
  const [projects, setProjects] = useState<{ id: string; title: string; role: string }[]>([]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const u = d.user as Me | null;
        setMe(u ?? null);
        if (u?.name) setName(u.name);
      })
      .catch(() => setMe(null));

    fetch("/api/me/overview", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) {
          setTasks([]);
          setProjects([]);
          return;
        }
        setTasks(Array.isArray(d.tasks) ? d.tasks : []);
        setProjects(Array.isArray(d.projects) ? d.projects : []);
      })
      .catch(() => {
        setTasks([]);
        setProjects([]);
      });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveName() {
    setMessage(null);
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() })
      });
      const d = await res.json();
      if (!res.ok) {
        setError(typeof d.error === "string" ? d.error : "保存失败");
        return;
      }
      setMe(d.user);
      setMessage("已保存");
    } finally {
      setSaving(false);
    }
  }

  if (me === undefined) {
    return (
      <main className="min-h-screen bg-neutral-50">
        <TopNav />
        <p className="py-16 text-center text-sm text-neutral-500">加载中…</p>
      </main>
    );
  }

  if (!me || !me.email) {
    return (
      <main className="min-h-screen bg-neutral-50">
        <TopNav />
        <div className="mx-auto max-w-md px-5 py-16 text-center">
          <p className="text-sm text-neutral-600">请先使用已注册账号登录后查看个人页。</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/login" className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium">
              登录
            </Link>
            <Link href="/register" className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white">
              注册
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <TopNav />
      <div className="mx-auto max-w-2xl px-5 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">个人中心</h1>
        <p className="mt-1 text-sm text-neutral-500">昵称、跨项目任务与站内信入口</p>

        <section className="mt-8 rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-900">显示昵称</h2>
          <p className="mt-1 text-xs text-neutral-500">在各项目中成员列表、任务指派等处展示。</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <input
              className="flex-1 rounded-xl border-0 bg-neutral-50 px-4 py-3 text-sm ring-1 ring-inset ring-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-900"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
            />
            <button
              type="button"
              disabled={saving || !name.trim()}
              onClick={() => void saveName()}
              className="rounded-xl bg-neutral-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-40"
            >
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
          <p className="mt-2 text-xs text-neutral-500">登录邮箱（不可在此修改）：{me.email}</p>
          {message ? <p className="mt-2 text-sm text-emerald-700">{message}</p> : null}
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        </section>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/notifications"
            className="inline-flex rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium hover:bg-neutral-50"
          >
            站内消息
          </Link>
          <Link href="/" className="inline-flex rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium hover:bg-neutral-50">
            返回首页
          </Link>
        </div>

        <section className="mt-10 rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-900">我的项目</h2>
          <p className="mt-1 text-xs text-neutral-500">共 {projects.length} 个</p>
          <ul className="mt-4 space-y-2 text-sm">
            {projects.map((p) => (
              <li key={p.id}>
                <Link href={`/project/${p.id}`} className="font-medium text-neutral-900 underline-offset-2 hover:underline">
                  {p.title}
                </Link>
                <span className="text-neutral-400"> · {p.role === "OWNER" ? "队长" : "成员"}</span>
              </li>
            ))}
            {projects.length === 0 ? <li className="text-neutral-500">暂无，请从首页加入或创建项目。</li> : null}
          </ul>
        </section>

        <section className="mt-6 rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-900">待办任务（跨项目）</h2>
          <p className="mt-1 text-xs text-neutral-500">指派给你且未完成，按截止时间排序。</p>
          <ul className="mt-4 space-y-3">
            {tasks.map((t) => (
              <li key={t.id} className="rounded-xl border border-neutral-100 bg-neutral-50/80 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/project/${t.projectId}/manage`} className="font-medium text-neutral-900 hover:underline">
                    {t.title}
                  </Link>
                  {t.ultimatumLevel === "RED_24H" ? (
                    <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-semibold text-white">阻塞</span>
                  ) : t.ultimatumLevel === "WARN_3D" ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">临期</span>
                  ) : null}
                </div>
                <div className="mt-1 text-xs text-neutral-500">
                  {t.projectTitle} · {new Date(t.deadline).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
              </li>
            ))}
            {tasks.length === 0 ? <li className="text-neutral-500">暂无待办。</li> : null}
          </ul>
        </section>
      </div>
    </main>
  );
}

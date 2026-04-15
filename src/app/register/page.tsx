"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TopNav } from "@/components/top-nav";
import { replaceInternalPath } from "@/lib/safe-navigate";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") || "/";
  const inviteCode = searchParams.get("invite");
  const presetId = searchParams.get("preset");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "注册失败");
        return;
      }

      // S3: 如果从邀请链接来（带 presetId），执行加入+激活联合流程
      if (presetId && inviteCode) {
        const joinRes = await fetch("/api/join-by-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inviteCode, presetId })
        });
        const joinData = await joinRes.json();
        if (!joinRes.ok) {
          setError(joinData.error || "加入项目失败");
          return;
        }
        router.push(`/project/${joinData.projectId}`);
        router.refresh();
        return;
      }

      replaceInternalPath(router, nextUrl);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-bg">
      <TopNav />
      <div className="shell mx-auto max-w-md py-10">
        <div className="line-card p-8">
          <h1 className="text-2xl font-semibold tracking-tight">注册</h1>
          {presetId ? (
            <p className="mt-2 text-sm text-muted">
              注册后将自动代入预设昵称并加入项目。显示昵称可后续在「个人中心」修改。
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted">
              注册后使用同一账号加入多个项目。请先设好<strong className="font-medium text-ink">显示昵称</strong>
              ，成员与队长将在任务、看板等处看到此名称（可与真实姓名不同）。
            </p>
          )}

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">显示昵称（必填）</label>
              <input
                className="w-full rounded-xl border border-line px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：张三、组长小李、设计-Amy"
                required
                maxLength={40}
                autoComplete="nickname"
              />
              <p className="mt-1 text-xs text-muted">1～40 字，注册后可在「个人中心」修改。</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">邮箱</label>
              <input
                type="email"
                autoComplete="email"
                className="w-full rounded-xl border border-line px-3 py-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">密码（至少 8 位）</label>
              <input
                type="password"
                autoComplete="new-password"
                className="w-full rounded-xl border border-line px-3 py-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            {error ? <p className="text-sm text-critical">{error}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full border border-ink bg-ink py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {loading ? "注册中…" : "注册并登录"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            已有账号？{" "}
            <Link href="/login" className="font-medium text-ink underline">
              登录
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-bg">
        <TopNav />
        <div className="shell py-10 text-center text-muted">加载中…</div>
      </main>
    }>
      <RegisterForm />
    </Suspense>
  );
}

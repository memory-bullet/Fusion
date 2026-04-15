"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TopNav } from "@/components/top-nav";
import { replaceInternalPath } from "@/lib/safe-navigate";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "登录失败");
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
          <h1 className="text-2xl font-semibold tracking-tight">登录</h1>
          <p className="mt-2 text-sm text-muted">使用注册时的邮箱与密码。登录后加入项目会绑定到同一账号。</p>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
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
              <label className="mb-1 block text-sm font-medium text-ink">密码</label>
              <input
                type="password"
                autoComplete="current-password"
                className="w-full rounded-xl border border-line px-3 py-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error ? <p className="text-sm text-critical">{error}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full border border-ink bg-ink py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {loading ? "登录中…" : "登录"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            还没有账号？{" "}
            <Link href="/register" className="font-medium text-ink underline">
              注册
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-bg">
        <TopNav />
        <div className="shell py-10 text-center text-muted">加载中…</div>
      </main>
    }>
      <LoginForm />
    </Suspense>
  );
}

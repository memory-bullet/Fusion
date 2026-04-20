"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, User, UserCircle } from "lucide-react";

type Me = { id: string; name: string; email: string | null };

export function NavTrailing() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [unread, setUnread] = useState<number | null>(null);

  const refresh = useCallback(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setMe(d.user ?? null))
      .catch(() => setMe(null));
  }, []);

  const refreshUnread = useCallback(() => {
    fetch("/api/me/notifications/unread-count", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.resolve(null)))
      .then((d) => {
        if (d && typeof d.count === "number") setUnread(d.count);
        else setUnread(null);
      })
      .catch(() => setUnread(null));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!me) {
      setUnread(null);
      return;
    }
    void refreshUnread();
    const t = window.setInterval(() => void refreshUnread(), 60000);
    return () => window.clearInterval(t);
  }, [me, refreshUnread]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setMe(null);
    window.location.href = "/";
  }

  return (
    <div className="flex min-h-10 items-center gap-4 text-neutral-400">
      {me ? (
        <Link
          href="/me"
          className="inline-flex h-9 w-9 items-center justify-center transition hover:text-neutral-900"
          title="个人中心"
          aria-label="个人中心"
        >
          <User className="h-5 w-5" />
        </Link>
      ) : null}
      {me ? (
        <Link
          href="/notifications"
          className="relative inline-flex h-9 w-9 items-center justify-center transition hover:text-neutral-900"
          title="站内信"
          aria-label="站内信"
        >
          <Bell className="h-5 w-5" />
          {unread !== null && unread > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-0.5 text-[10px] font-semibold text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </Link>
      ) : null}
      {me === undefined ? (
        <span className="inline-flex h-9 w-9 items-center justify-center">
          <UserCircle className="h-7 w-7 opacity-40" aria-hidden />
        </span>
      ) : me ? (
        <div className="flex min-h-9 items-center gap-2 text-sm leading-none text-neutral-900">
          <span className="max-w-[120px] truncate font-medium leading-none" title={me.email ?? me.name}>
            {me.name}
          </span>
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex h-8 items-center text-xs leading-none text-neutral-500 underline decoration-neutral-300 underline-offset-2 hover:text-neutral-900"
          >
            退出
          </button>
        </div>
      ) : (
        <Link
          href="/login"
          className="inline-flex h-9 w-9 items-center justify-center transition hover:text-neutral-900"
          aria-label="Log in"
          title="Log in"
        >
          <UserCircle className="h-7 w-7" />
        </Link>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { NavTrailing } from "@/components/nav-trailing";

export function TopNav() {
  const pathname = usePathname() ?? "";
  const isHome = pathname === "/";

  // 智能判断返回路径
  const getBackHref = () => {
    // 匹配 /project/[projectId]/xxx 格式
    const projectSubPageMatch = pathname.match(/^\/project\/([^/]+)\/(.+)$/);
    if (projectSubPageMatch) {
      const projectId = projectSubPageMatch[1];
      return `/project/${projectId}`;
    }

    // 匹配 /project/[projectId] 格式
    if (pathname.match(/^\/project\/[^/]+$/)) {
      return "/";
    }

    // 默认返回首页
    return "/";
  };

  return (
    <header className="min-h-16 border-b border-neutral-200 bg-white">
      <div className="mx-auto flex min-h-16 w-full max-w-[1400px] items-center justify-between gap-3 px-8 py-0">
        <div className="flex min-w-0 flex-1 items-center gap-3 text-neutral-900">
          {!isHome ? (
            <Link
              href={getBackHref() as "/" | `/project/${string}`}
              className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-medium leading-none text-neutral-800 transition hover:bg-neutral-50 hover:text-neutral-900"
              aria-label="返回上一层"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              返回
            </Link>
          ) : null}
          <Link
            href="/"
            className="inline-flex h-10 items-center truncate text-xl font-semibold leading-none tracking-tight text-neutral-900 hover:opacity-80 sm:text-2xl"
          >
            Fusion Space
          </Link>
        </div>
        <NavTrailing />
      </div>
    </header>
  );
}

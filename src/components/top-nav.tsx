﻿"use client";

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
    <header className="h-14 border-b border-neutral-200 bg-white">
      <div className="shell flex h-full items-center justify-between gap-3 py-0">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-neutral-900 sm:gap-3">
          {!isHome ? (
            <Link
              href={getBackHref()}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-neutral-200 bg-white px-2.5 py-1.5 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50 hover:text-neutral-900"
              aria-label="返回上一层"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              返回
            </Link>
          ) : null}
          <Link href="/" className="truncate text-xl font-semibold tracking-tight text-neutral-900 hover:opacity-80 sm:text-2xl">
            Fusion Space
          </Link>
        </div>
        <NavTrailing />
      </div>
    </header>
  );
}

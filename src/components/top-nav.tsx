﻿"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavTrailing } from "@/components/nav-trailing";
import { BackNavButton } from "@/components/back-nav-button";

export function TopNav() {
  const pathname = usePathname() ?? "";
  const isHome = pathname === "/";

  return (
    <header className="h-14 border-b border-neutral-200 bg-white">
      <div className="shell flex h-full items-center justify-between gap-3 py-0">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-neutral-900 sm:gap-3">
          {!isHome ? <BackNavButton className="border-neutral-200" /> : null}
          <Link href="/" className="truncate text-xl font-semibold tracking-tight text-neutral-900 hover:opacity-80 sm:text-2xl">
            Fusion Space
          </Link>
        </div>
        <NavTrailing />
      </div>
    </header>
  );
}

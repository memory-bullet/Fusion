"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const tabs = [
  { label: "Workspace", href: "" },
  { label: "Project Manage", href: "/manage" },
  { label: "Contribution", href: "/analytics" }
];

export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-line pb-3">
      {tabs.map((tab) => {
        const href = `/project/${projectId}${tab.href}`;
        const active = pathname === href;

        return (
          <Link
            key={tab.label}
            href={href as Route}
            className={clsx(
              "rounded-full px-4 py-2 text-sm font-medium transition",
              active ? "bg-slate-900 text-white" : "border border-line text-muted hover:bg-slate-50"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

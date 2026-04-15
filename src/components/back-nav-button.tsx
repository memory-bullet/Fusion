"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

type Props = {
  /** 无浏览器历史时的跳转目标 */
  fallbackHref?: string;
  className?: string;
};

export function BackNavButton({ fallbackHref = "/", className = "" }: Props) {
  const router = useRouter();

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      window.location.assign(fallbackHref);
    }
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className={`inline-flex shrink-0 items-center gap-1 rounded-xl border border-neutral-200 bg-white px-2.5 py-1.5 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50 hover:text-neutral-900 ${className}`}
      aria-label="返回上一层"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      返回
    </button>
  );
}

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

/** 仅允许站内相对路径，避免开放重定向；兼容 typedRoutes 下的 replace 类型。 */
export function replaceInternalPath(router: Pick<AppRouterInstance, "replace">, raw: string | null) {
  const path = raw?.trim() || "/";
  const safe = path === "/" || (path.startsWith("/") && !path.startsWith("//")) ? path : "/";
  (router.replace as (href: string) => void)(safe);
}

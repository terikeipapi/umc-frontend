import type { QueryClient } from "@tanstack/react-query";

export function getSafeRedirect(value: unknown, fallback = "/mypage"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\s\u0000-\u001f]/.test(value)) return fallback;
  try {
    const url = new URL(value, "https://umcine.local");
    if (url.origin !== "https://umcine.local" || /^\/(login|signup)\/?$/.test(url.pathname)) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function getLoginHref(redirect: string): string {
  return `/login?${new URLSearchParams({ redirect: getSafeRedirect(redirect) })}`;
}

export function clearPrivateQueries(client: QueryClient): void {
  const filters = { predicate: (query: { queryKey: readonly unknown[] }) => ["member", "favorites", "ratings"].includes(String(query.queryKey[0])) };
  void client.cancelQueries(filters);
  client.removeQueries(filters);
}

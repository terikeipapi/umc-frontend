"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getLoginHref } from "../../lib/auth";
import { useAuthStore } from "../../store/auth-store";

export function AuthGuard({ children }: { children: ReactNode }) {
  const hydrated = useAuthStore((state) => state.hydrated);
  const accessToken = useAuthStore((state) => state.accessToken);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => {
    if (hydrated && !accessToken) {
      const href = `${pathname}${search ? `?${search}` : ""}${window.location.hash}`;
      router.replace(getLoginHref(href));
    }
  }, [hydrated, accessToken, router, pathname, search]);

  if (!hydrated || !accessToken) {
    return <main className="auth-page"><p role="status">로그인 상태를 확인하고 있어요.</p></main>;
  }
  return children;
}

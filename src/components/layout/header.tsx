"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "../../lib/cn";
import { clearPrivateQueries } from "../../lib/auth";
import { useAuthStore } from "../../store/auth-store";

const navLinkClass = "text-[15px] font-normal text-[#777] transition-colors hover:text-[#111]";

export function Header() {
  const memberId = useAuthStore((state) => state.memberId);
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();

  function navClass(href: string) {
    const active = href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
    return cn(navLinkClass, active && "font-bold text-[#111]");
  }

  function logout() {
    useAuthStore.getState().clearSession();
    clearPrivateQueries(queryClient);
    router.replace("/login");
  }

  return (
    <header className="site-header flex min-h-[72px] w-full items-center justify-between border-b border-[#eee] bg-white px-6 sm:px-10 lg:px-20">
      <Link className="text-2xl font-bold" href="/">
        영화
      </Link>
      <nav className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 py-4 sm:gap-x-8" aria-label="주요 메뉴">
        <Link
          href="/"
          className={navClass("/")}
          aria-current={pathname === "/" ? "page" : undefined}
        >
          영화 목록
        </Link>
        <Link
          href="/search"
          className={navClass("/search")}
          aria-current={pathname === "/search" ? "page" : undefined}
        >
          검색
        </Link>
        {memberId !== null ? <>
          <Link href="/mypage" className={navClass("/mypage")} aria-current={pathname.startsWith("/mypage") ? "page" : undefined}>마이페이지</Link>
          <button type="button" className={navLinkClass} onClick={() => void logout()}>로그아웃</button>
        </> : <>
          <Link href="/login" className={navClass("/login")} aria-current={pathname === "/login" ? "page" : undefined}>로그인</Link>
          <Link href="/signup" className={navClass("/signup")} aria-current={pathname === "/signup" ? "page" : undefined}>회원가입</Link>
        </>}
      </nav>
    </header>
  );
}

export default Header;

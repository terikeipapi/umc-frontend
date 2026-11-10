import { Link } from "@tanstack/react-router";
import { cn } from "../../lib/cn";

const navLinkClass = "text-[15px] font-normal text-[#777] transition-colors hover:text-[#111]";

export function Header() {
  return (
    <header className="site-header flex min-h-[72px] w-full items-center justify-between border-b border-[#eee] bg-white px-6 sm:px-10 lg:px-20">
      <Link className="text-2xl font-bold" to="/">
        영화
      </Link>
      <nav className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 py-4 sm:gap-x-8" aria-label="주요 메뉴">
        <Link
          to="/"
          className={navLinkClass}
          activeProps={{ className: cn(navLinkClass, "font-bold text-[#111]") }}
        >
          영화 목록
        </Link>
        <Link
          to="/search"
          className={navLinkClass}
          activeProps={{ className: cn(navLinkClass, "font-bold text-[#111]") }}
        >
          검색
        </Link>
        <Link to="/mypage" className={navLinkClass} activeProps={{ className: cn(navLinkClass, "font-bold text-[#111]") }}>내 정보</Link>
        <Link to="/login" className={navLinkClass} activeProps={{ className: cn(navLinkClass, "font-bold text-[#111]") }}>로그인</Link>
        <Link to="/signup" className={navLinkClass} activeProps={{ className: cn(navLinkClass, "font-bold text-[#111]") }}>회원가입</Link>
      </nav>
    </header>
  );
}

export default Header;

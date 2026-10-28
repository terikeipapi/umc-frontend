import { Link } from "@tanstack/react-router";
import { cn } from "../../lib/cn";

const navLinkClass = "text-[15px] font-normal text-[#777] transition-colors hover:text-[#111]";

export function Header() {
  return (
    <header className="flex h-[72px] w-full items-center justify-between border-b border-[#eee] bg-white px-20">
      <Link className="text-2xl font-bold" to="/">
        영화
      </Link>
      <nav className="flex items-center gap-8" aria-label="주요 메뉴">
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
      </nav>
    </header>
  );
}

export default Header;

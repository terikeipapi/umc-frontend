import { cn } from "../../lib/cn";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const lastPage = Math.min(totalPages, 500);
  if (lastPage <= 1) return null;

  const firstVisiblePage = Math.max(1, Math.min(currentPage - 2, lastPage - 4));
  const pages = Array.from({ length: Math.min(5, lastPage) }, (_, index) => firstVisiblePage + index);
  const buttonClass = "flex size-9 items-center justify-center rounded-lg text-[#555] hover:bg-[#f4f4f4] disabled:cursor-not-allowed disabled:text-[#ccc] disabled:hover:bg-transparent";

  return (
    <nav className="mt-14 flex flex-wrap items-center justify-center gap-2" aria-label="페이지 이동">
      <button className={buttonClass} type="button" aria-label="이전 페이지" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>
        &lt;
      </button>
      {pages.map((page) => (
        <button
          key={page}
          type="button"
          className={cn(buttonClass, page === currentPage && "bg-[#111] text-white hover:bg-[#111]")}
          aria-label={page + "페이지"}
          aria-current={page === currentPage ? "page" : undefined}
          onClick={() => onPageChange(page)}
        >
          {page}
        </button>
      ))}
      <button className={buttonClass} type="button" aria-label="다음 페이지" disabled={currentPage >= lastPage} onClick={() => onPageChange(currentPage + 1)}>
        &gt;
      </button>
      <span className="ml-3 text-sm text-[#777]">{currentPage} / {lastPage}</span>
    </nav>
  );
}

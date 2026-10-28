import { cn } from "../../lib/cn";
import { useBookmarkStore } from "../../store/bookmark-store";

interface BookmarkButtonProps {
  movieId: number;
  movieTitle: string;
}

export default function BookmarkButton({ movieId, movieTitle }: BookmarkButtonProps) {
  const isBookmarked = useBookmarkStore((state) => state.isBookmarked(movieId));
  const toggleBookmark = useBookmarkStore((state) => state.toggleBookmark);

  return (
    <button
      type="button"
      className={cn(
        "absolute top-2.5 right-2.5 z-10 flex size-[34px] items-center justify-center rounded-lg border border-white/90 bg-neutral-500/55 p-1.5 transition hover:scale-105 active:scale-95",
        isBookmarked && "border-[#4f6fe8] bg-[#4f6fe8]",
      )}
      onClick={() => toggleBookmark(movieId)}
      aria-label={`${movieTitle} 북마크 ${isBookmarked ? "해제" : "추가"}`}
      aria-pressed={isBookmarked}
    >
      <img
        className="block size-5 object-contain"
        src={isBookmarked ? "/icons/bookmark.svg" : "/icons/bookmark-outline.svg"}
        alt=""
      />
    </button>
  );
}

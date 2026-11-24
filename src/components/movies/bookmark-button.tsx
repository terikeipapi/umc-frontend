"use client";

import { cn } from "../../lib/cn";
import { useIsMutating, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../store/auth-store";
import { favoriteKeys, favoriteQueries, useToggleFavorite } from "../../queries/favorites";
import { getMemberErrorMessage } from "../../lib/member-session";

interface BookmarkButtonProps {
  movieId: number;
  movieTitle: string;
  statusSource?: "detail" | "list";
}

export default function BookmarkButton({ movieId, movieTitle, statusSource = "detail" }: BookmarkButtonProps) {
  const memberId = useAuthStore((state) => state.memberId);
  const router = useRouter();
  const detail = useQuery({ ...favoriteQueries.detail(memberId, movieId), enabled: memberId !== null && statusSource === "detail" });
  const list = useQuery({ ...favoriteQueries.list(memberId), staleTime: 10_000, enabled: memberId !== null && statusSource === "list" });
  const mutation = useToggleFavorite(movieId);
  const writing = useIsMutating({ mutationKey: favoriteKeys.mutation(memberId, movieId) }) > 0;
  const request = statusSource === "detail" ? detail : list;
  const isBookmarked = statusSource === "detail" ? Boolean(detail.data?.isFavorite) : Boolean(list.data?.some((item) => item.movieId === movieId));
  const busy = memberId !== null && (request.isPending || request.isFetching || writing);

  function toggle() {
    if (memberId === null) {
      router.push(`/login?${new URLSearchParams({ redirect: `/movies/${movieId}` })}`);
      return;
    }
    if (busy || request.isError) return;
    mutation.mutate(!isBookmarked);
  }

  return (
    <>
      <button
      type="button"
      className={cn(
        "absolute top-2.5 right-2.5 z-10 flex size-[34px] items-center justify-center rounded-lg border border-white/90 bg-neutral-500/55 p-1.5 transition hover:scale-105 active:scale-95",
        isBookmarked && "border-[#4f6fe8] bg-[#4f6fe8]",
      )}
      onClick={toggle}
      disabled={busy || (memberId !== null && request.isError)}
      aria-busy={busy}
      aria-label={`${movieTitle} 북마크 ${isBookmarked ? "해제" : "추가"}`}
      aria-pressed={isBookmarked}
    >
      <img
        className="block size-5 object-contain"
        src={isBookmarked ? "/icons/bookmark.svg" : "/icons/bookmark-outline.svg"}
        alt=""
      />
      </button>
      {(request.isError || mutation.isError) && memberId !== null && (
        <div className="absolute inset-x-2 bottom-2 z-20 rounded-lg bg-black/90 p-3 text-xs leading-5 text-white" role="alert">
          <p>{getMemberErrorMessage(mutation.error ?? request.error)}</p>
          <button type="button" className="mt-1 underline" disabled={request.isFetching || writing} onClick={() => { mutation.reset(); void request.refetch(); }}>찜 상태 다시 확인</button>
        </div>
      )}
    </>
  );
}

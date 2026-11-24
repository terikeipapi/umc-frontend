import type { UseQueryResult } from "@tanstack/react-query";
import { getMovieErrorMessage } from "../../lib/movie-error";

// Cached content stays visible while a stale query refreshes in the background.
export function QueryActivity({ query }: { query: UseQueryResult<unknown, Error> }) {
  if (query.fetchStatus === "paused") {
    return <p className="mb-4 text-sm" role="status">인터넷 연결을 기다리고 있어요. 연결되면 자동으로 다시 요청해요.</p>;
  }
  if (query.data === undefined) return null;
  if (query.isFetching) {
    return <p className="mb-4 text-sm" role="status">최신 영화 정보를 확인하고 있어요.</p>;
  }
  if (query.isError) {
    return (
      <div className="mb-4 text-sm" role="alert">
        <p>최신 정보를 가져오지 못해 저장된 정보를 표시하고 있어요. {getMovieErrorMessage(query.error)}</p>
        <button className="mt-2 underline" type="button" onClick={() => void query.refetch()}>다시 시도</button>
      </div>
    );
  }
  return null;
}

interface RequestStateProps {
  title: string;
  description?: string;
  onRetry?: () => void;
  loading?: boolean;
}

export function RequestState({ title, description, onRetry, loading = false }: RequestStateProps) {
  return (
    <div
      className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-[#eee] bg-[#fafafa] px-6 py-16 text-center"
      role={onRetry ? "alert" : "status"}
      aria-live="polite"
      aria-busy={loading}
    >
      {loading && <span className="mb-5 size-8 animate-spin rounded-full border-[3px] border-[#ddd] border-t-[#111] motion-reduce:animate-none" aria-hidden="true" />}
      <p className="text-lg font-semibold text-[#333]">{title}</p>
      {description && <p className="mt-3 max-w-[560px] text-sm leading-6 text-[#777]">{description}</p>}
      {onRetry && (
        <button className="mt-6 rounded-lg bg-[#111] px-5 py-3 text-sm font-medium text-white hover:bg-[#333]" type="button" onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  );
}

import { QueryClient } from "@tanstack/react-query";
import { shouldRetryMovieQuery } from "./movie-error";

export const QUERY_STALE_TIME = 5 * 60 * 1000;
export const QUERY_GC_TIME = 30 * 60 * 1000;

// Each provider gets its own client; server requests never share member caches.
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY_STALE_TIME,
        // SSR must not retain a completed request through a cache GC timer.
        gcTime: typeof window === "undefined" ? Infinity : QUERY_GC_TIME,
        retry: shouldRetryMovieQuery,
      },
    },
  });
}

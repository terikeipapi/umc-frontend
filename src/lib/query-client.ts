import { QueryClient } from "@tanstack/react-query";
import { shouldRetryMovieQuery } from "./movie-error";

export const QUERY_STALE_TIME = 5 * 60 * 1000;
export const QUERY_GC_TIME = 30 * 60 * 1000;

// Keep one client for the whole app so navigating between routes reuses cached data.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY_STALE_TIME,
      gcTime: QUERY_GC_TIME,
      retry: shouldRetryMovieQuery,
    },
  },
});

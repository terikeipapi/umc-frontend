import { queryOptions } from "@tanstack/react-query";
import { getMovieDetails, getPopularMovies, searchMovies } from "../api/movies";

export const movieKeys = {
  all: ["movies"] as const,
  popular: (page: number) => [...movieKeys.all, "popular", page] as const,
  search: (query: string, page: number) => [...movieKeys.all, "search", query.trim(), page] as const,
  detail: (movieId: string) => [...movieKeys.all, "detail", movieId] as const,
};

export const movieQueries = {
  popular: (page: number) => queryOptions({
    queryKey: movieKeys.popular(page),
    queryFn: ({ signal }) => getPopularMovies(page, signal),
  }),
  search: (query: string, page: number) => {
    const normalizedQuery = query.trim();
    return queryOptions({
      queryKey: movieKeys.search(normalizedQuery, page),
      queryFn: ({ signal }) => searchMovies(normalizedQuery, page, signal),
      enabled: normalizedQuery.length > 0,
    });
  },
  detail: (movieId: string) => queryOptions({
    queryKey: movieKeys.detail(movieId),
    queryFn: ({ signal }) => getMovieDetails(movieId, signal),
  }),
};

import type { TmdbMoviePage } from "../types/tmdb";
import { getTmdbAuth, TMDB_API_URL } from "./tmdb-config";

// First API exercise: intentionally uses only native fetch, without ky.
export async function fetchPopularMovies(signal?: AbortSignal): Promise<TmdbMoviePage> {
  const auth = getTmdbAuth();
  const url = new URL("movie/popular", TMDB_API_URL);
  url.search = new URLSearchParams({ ...auth.searchParams, page: "1" }).toString();

  const response = await fetch(url, {
    headers: { accept: "application/json", ...auth.headers },
    signal,
  });

  if (!response.ok) throw new Error(`TMDB 인기 영화 요청에 실패했어요. (HTTP ${response.status})`);
  return response.json() as Promise<TmdbMoviePage>;
}

import { HTTPError } from "ky";
import type { Movie, MoviePage } from "../types/movie";
import type { TmdbMovie, TmdbMovieDetails, TmdbMoviePage } from "../types/tmdb";
import { tmdb } from "./tmdb";

export function getImageUrl(path: string | null, size: "w500" | "w1280" = "w500") {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : "/images/poster-placeholder.svg";
}

export function toMovie(movie: TmdbMovie | TmdbMovieDetails): Movie {
  const details = "runtime" in movie ? movie : undefined;
  const minutes = details?.runtime;

  return {
    id: movie.id,
    title: movie.title || movie.original_title || "제목 정보 없음",
    originalTitle: movie.original_title || movie.title,
    releaseDate: movie.release_date?.replace(/-/g, ".") || "개봉일 미정",
    posterPath: getImageUrl(movie.poster_path),
    backdropPath: movie.backdrop_path ? getImageUrl(movie.backdrop_path, "w1280") : "",
    overview: movie.overview?.trim() || "등록된 줄거리가 없어요.",
    genres: details?.genres.map((genre) => genre.name) ?? [],
    runtime: minutes && minutes > 0
      ? [Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)}시간` : "", minutes % 60 ? `${minutes % 60}분` : ""].filter(Boolean).join(" ")
      : "상영 시간 정보 없음",
    tagline: details?.tagline?.trim() || "줄거리",
  };
}

function toMoviePage(response: TmdbMoviePage): MoviePage {
  return {
    movies: response.results.map(toMovie),
    page: response.page,
    totalPages: Math.min(response.total_pages, 500),
    totalResults: response.total_results,
  };
}

export async function getPopularMovies(page: number, signal: AbortSignal): Promise<MoviePage> {
  const response = await tmdb.get("movie/popular", { searchParams: { page }, signal }).json<TmdbMoviePage>();
  return toMoviePage(response);
}

export async function searchMovies(query: string, page: number, signal: AbortSignal): Promise<MoviePage> {
  const response = await tmdb.get("search/movie", {
    searchParams: { query: query.trim(), page, include_adult: false },
    signal,
  }).json<TmdbMoviePage>();
  return toMoviePage(response);
}

export async function getMovieDetails(movieId: string, signal: AbortSignal): Promise<Movie | null> {
  if (!/^[1-9]\d*$/.test(movieId) || !Number.isSafeInteger(Number(movieId))) return null;

  try {
    return toMovie(await tmdb.get(`movie/${movieId}`, { signal }).json<TmdbMovieDetails>());
  } catch (error) {
    if (error instanceof HTTPError && error.response.status === 404) return null;
    throw error;
  }
}

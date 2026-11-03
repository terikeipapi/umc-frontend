import { HTTPError, TimeoutError } from "ky";
import { TmdbConfigurationError } from "../api/tmdb-config";

export function getMovieErrorMessage(error: unknown): string {
  if (error instanceof TmdbConfigurationError) return error.message;
  if (error instanceof TimeoutError) return "요청 시간이 초과됐어요. 다시 시도해 주세요.";
  if (error instanceof HTTPError) {
    const status = error.response.status;
    if (status === 401 || status === 403) return "TMDB 인증에 실패했어요. API 토큰과 접근 권한을 확인해 주세요.";
    if (status === 429) return "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.";
    return "영화 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.";
  }
  return "영화 정보를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.";
}

export function shouldRetryMovieQuery(failureCount: number, error: Error): boolean {
  if (error instanceof TmdbConfigurationError || error.name === "AbortError") return false;
  if (error instanceof HTTPError && error.response.status < 500) return false;
  return failureCount < 1;
}

export const TMDB_API_URL = "https://api.themoviedb.org/3/";

export class TmdbConfigurationError extends Error {
  constructor() {
    super("TMDB 인증 정보가 없어요. .env.local에 VITE_TMDB_ACCESS_TOKEN을 설정하고 개발 서버를 다시 실행해 주세요.");
    this.name = "TmdbConfigurationError";
  }
}

export function getTmdbAuth() {
  const token = import.meta.env.VITE_TMDB_ACCESS_TOKEN?.trim();
  const apiKey = import.meta.env.VITE_TMDB_API_KEY?.trim();

  if (!token && !apiKey) throw new TmdbConfigurationError();

  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  return {
    headers,
    searchParams: { language: "ko-KR", ...(!token && apiKey ? { api_key: apiKey } : {}) },
  };
}

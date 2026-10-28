import { HTTPError, TimeoutError } from "ky";
import { useEffect, useRef, useState } from "react";
import { TmdbConfigurationError } from "../api/tmdb-config";

type RequestState<T> =
  | { status: "idle" | "loading"; data?: undefined; error?: undefined }
  | { status: "error"; data?: undefined; error: string }
  | { status: "success"; data: T; error?: undefined };

function errorMessage(error: unknown) {
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

export function useMovieRequest<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>) {
  const loader = useRef(load);
  loader.current = load;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string | null; attempt: number; state: RequestState<T> }>({
    key: null, attempt: 0, state: { status: "idle" },
  });

  useEffect(() => {
    if (key === null) return;
    const controller = new AbortController();
    setResult({ key, attempt, state: { status: "loading" } });
    // Deferring avoids an extra request during StrictMode's development effect check.
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      try {
        const data = await loader.current(controller.signal);
        if (!controller.signal.aborted) setResult({ key, attempt, state: { status: "success", data } });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ key, attempt, state: { status: "error", error: errorMessage(error) } });
      }
    });
    return () => controller.abort();
  }, [key, attempt]);

  const state: RequestState<T> = key === null
    ? { status: "idle" }
    : result.key === key && result.attempt === attempt ? result.state : { status: "loading" };

  return { ...state, retry: () => setAttempt((value) => value + 1) };
}

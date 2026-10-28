import { fetchPopularMovies } from "../api/popular-fetch";

// Add ?tmdb-fetch=1 in development to run the native-fetch exercise once.
// This runs outside React effects, so StrictMode does not duplicate the request.
void fetchPopularMovies().then(
  (response) => console.info("[TMDB fetch] 인기 영화 응답", response),
  (error: unknown) => console.info("[TMDB fetch] 요청 확인", error instanceof Error ? error.message : "요청 실패"),
);

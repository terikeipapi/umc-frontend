import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const originalFetch = globalThis.fetch;
const fakeToken = "offline-test-token";
let server;
let movies;
let nativeFetch;
let requests = [];
let respond;

const movie = {
  id: 550,
  title: "파이트 클럽",
  original_title: "Fight Club",
  release_date: "1999-11-13",
  poster_path: "/poster.jpg",
  backdrop_path: "/backdrop.jpg",
  overview: "영화 줄거리",
};
const moviePage = (results = [movie], page = 1) => ({
  page,
  results,
  total_pages: 3,
  total_results: results.length,
});
const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json" },
});
const signal = () => new AbortController().signal;

async function createTestServer(token = fakeToken, apiKey = "") {
  return createServer({
    root,
    configFile: false,
    envDir: fileURLToPath(new URL("./fixtures/no-env/", import.meta.url)),
    define: {
      "import.meta.env.VITE_TMDB_ACCESS_TOKEN": JSON.stringify(token),
      "import.meta.env.VITE_TMDB_API_KEY": JSON.stringify(apiKey),
    },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
    logLevel: "error",
  });
}

before(async () => {
  // Install before ky is imported: ky captures the configured fetch implementation.
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    requests.push(request);
    return respond(request);
  };
  server = await createTestServer();
  movies = await server.ssrLoadModule("/src/api/movies.ts");
  nativeFetch = await server.ssrLoadModule("/src/api/popular-fetch.ts");
});

after(async () => {
  try {
    await server?.close();
  } finally {
    globalThis.fetch = originalFetch;
  }
});

beforeEach(() => {
  requests = [];
  respond = () => jsonResponse(moviePage());
});

function assertTmdbRequest(request, pathname) {
  const url = new URL(request.url);
  assert.equal(url.origin, "https://api.themoviedb.org");
  assert.equal(url.pathname, pathname);
  assert.equal(url.searchParams.get("language"), "ko-KR");
  assert.equal(request.headers.get("authorization"), "Bearer " + fakeToken);
  assert.equal(request.headers.get("accept"), "application/json");
  return url;
}

test("native fetch requests Korean popular movies once with Bearer authentication", async () => {
  const result = await nativeFetch.fetchPopularMovies(signal());
  assert.deepEqual(result, moviePage());
  assert.equal(requests.length, 1);
  const url = assertTmdbRequest(requests[0], "/3/movie/popular");
  assert.equal(url.searchParams.get("page"), "1");
});

test("native fetch rejects an unsuccessful response without retrying", async () => {
  respond = () => jsonResponse({ status_message: "Unauthorized" }, 401);
  await assert.rejects(nativeFetch.fetchPopularMovies(signal()), /HTTP 401/);
  assert.equal(requests.length, 1);
});

test("ky popular movies preserve page, language and authentication and return display data", async () => {
  respond = () => jsonResponse(moviePage([movie], 2));
  const result = await movies.getPopularMovies(2, signal());
  assert.equal(requests.length, 1);
  const url = assertTmdbRequest(requests[0], "/3/movie/popular");
  assert.equal(url.searchParams.get("page"), "2");
  assert.equal(result.page, 2);
  assert.equal(result.totalPages, 3);
  assert.equal(result.movies[0].id, 550);
  assert.equal(result.movies[0].title, "파이트 클럽");
  assert.equal(result.movies[0].posterPath, "https://image.tmdb.org/t/p/w500/poster.jpg");
});

test("search sends the submitted Korean query safely and preserves an empty result", async () => {
  respond = () => jsonResponse(moviePage([], 3));
  const result = await movies.searchMovies("  기생충 & 봄?  ", 3, signal());
  assert.equal(requests.length, 1);
  const url = assertTmdbRequest(requests[0], "/3/search/movie");
  assert.equal(url.searchParams.get("query"), "기생충 & 봄?");
  assert.equal(url.searchParams.get("page"), "3");
  assert.equal(url.searchParams.get("include_adult"), "false");
  assert.deepEqual(result.movies, []);
  assert.equal(result.totalResults, 0);
});

test("movie details map real genres, runtime and missing image/text fields for direct access", async () => {
  respond = () => jsonResponse({
    ...movie,
    poster_path: null,
    backdrop_path: null,
    release_date: "",
    overview: "  ",
    genres: [{ id: 18, name: "드라마" }],
    runtime: 131,
    tagline: "  ",
  });
  const result = await movies.getMovieDetails("550", signal());
  assert.equal(requests.length, 1);
  assertTmdbRequest(requests[0], "/3/movie/550");
  assert.equal(result.id, 550);
  assert.deepEqual(result.genres, ["드라마"]);
  assert.equal(result.runtime, "2시간 11분");
  assert.equal(result.posterPath, "/images/poster-placeholder.svg");
  assert.equal(result.backdropPath, "");
  assert.equal(result.releaseDate, "개봉일 미정");
  assert.equal(result.overview, "등록된 줄거리가 없어요.");
  assert.equal(result.tagline, "줄거리");
});

test("invalid detail URLs return not-found without contacting TMDB", async () => {
  for (const id of ["abc", "0", "-1", "1.5", "1e2", "9007199254740992"]) {
    assert.equal(await movies.getMovieDetails(id, signal()), null, id);
  }
  assert.equal(requests.length, 0);
});

test("a missing TMDB movie becomes not-found while rate limiting remains an error", async () => {
  respond = () => jsonResponse({ status_code: 34, status_message: "Not found" }, 404);
  assert.equal(await movies.getMovieDetails("999999999", signal()), null);
  assert.equal(requests.length, 1);

  requests = [];
  respond = () => jsonResponse({ status_message: "Too many requests" }, 429);
  await assert.rejects(movies.getMovieDetails("550", signal()), (error) => {
    assert.equal(error.response?.status, 429);
    return true;
  });
  assert.equal(requests.length, 1);
});

test("an in-flight request is cancellable when the page or search changes", async () => {
  let started;
  const requestStarted = new Promise((resolve) => { started = resolve; });
  respond = (request) => new Promise((resolve, reject) => {
    const abort = () => reject(request.signal.reason);
    request.signal.addEventListener("abort", abort, { once: true });
    started();
    if (request.signal.aborted) abort();
  });
  const controller = new AbortController();
  const pending = movies.getPopularMovies(1, controller.signal);
  await requestStarted;
  controller.abort();
  await assert.rejects(pending, (error) => error.name === "AbortError");
  assert.equal(requests.length, 1);
});

test("API key authentication also preserves request-specific search parameters", async () => {
  const keyServer = await createTestServer("", "offline-api-key");
  try {
    const keyMovies = await keyServer.ssrLoadModule("/src/api/movies.ts");
    await keyMovies.searchMovies("Dune", 2, signal());
    assert.equal(requests.length, 1);
    const request = requests[0];
    const url = new URL(request.url);
    assert.equal(url.pathname, "/3/search/movie");
    assert.equal(url.searchParams.get("api_key"), "offline-api-key");
    assert.equal(url.searchParams.get("language"), "ko-KR");
    assert.equal(url.searchParams.get("query"), "Dune");
    assert.equal(url.searchParams.get("page"), "2");
    assert.equal(request.headers.has("authorization"), false);
  } finally {
    await keyServer.close();
  }
});

test("missing credentials show a configuration error without sending an unauthenticated request", async () => {
  const unconfiguredServer = await createTestServer("", "");
  try {
    const unconfiguredMovies = await unconfiguredServer.ssrLoadModule("/src/api/movies.ts");
    await assert.rejects(unconfiguredMovies.getPopularMovies(1, signal()), (error) => {
      assert.equal(error.name, "TmdbConfigurationError");
      assert.match(error.message, /VITE_TMDB_ACCESS_TOKEN/);
      return true;
    });
    assert.equal(requests.length, 0);
  } finally {
    await unconfiguredServer.close();
  }
});

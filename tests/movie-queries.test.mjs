import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { QueryObserver } from "@tanstack/react-query";
import { createServer } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const originalFetch = globalThis.fetch;
let server;
let queryClient;
let movieQueries;
let requests = [];
let respond;

const movie = {
  id: 550,
  title: "파이트 클럽",
  original_title: "Fight Club",
  release_date: "1999-11-13",
  poster_path: null,
  backdrop_path: null,
  overview: "영화 줄거리",
};
const moviePage = (results = [movie], page = 1) => ({
  page, results, total_pages: 3, total_results: results.length,
});
const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json" },
});
const details = (id = 550) => ({ ...movie, id, genres: [], runtime: 120, tagline: "" });

before(async () => {
  // ky captures fetch when its module is loaded; keep all requests offline.
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    requests.push(request);
    return respond(request);
  };
  server = await createServer({
    root,
    configFile: false,
    envDir: fileURLToPath(new URL("./fixtures/no-env/", import.meta.url)),
    define: {
      "import.meta.env.VITE_TMDB_ACCESS_TOKEN": JSON.stringify("offline-query-test-token"),
      "import.meta.env.VITE_TMDB_API_KEY": JSON.stringify(""),
    },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
    logLevel: "error",
  });
  ({ queryClient } = await server.ssrLoadModule("/src/lib/query-client.ts"));
  ({ movieQueries } = await server.ssrLoadModule("/src/queries/movies.ts"));
});

after(async () => {
  queryClient?.clear();
  try {
    await server?.close();
  } finally {
    globalThis.fetch = originalFetch;
  }
});

beforeEach(() => {
  requests = [];
  respond = (request) => {
    const url = new URL(request.url);
    const id = url.pathname.match(/\/movie\/(\d+)$/)?.[1];
    return jsonResponse(id ? details(Number(id)) : moviePage([movie], Number(url.searchParams.get("page") || 1)));
  };
});

afterEach(() => queryClient?.clear());

function waitFor(observer, predicate) {
  const current = observer.getCurrentResult();
  if (predicate(current)) return Promise.resolve(current);
  return new Promise((resolve) => {
    const unsubscribe = observer.subscribe((result) => {
      if (predicate(result)) {
        unsubscribe();
        resolve(result);
      }
    });
  });
}

async function visit(options) {
  const observer = new QueryObserver(queryClient, options);
  const unsubscribe = observer.subscribe(() => {});
  const result = await waitFor(observer, (state) => !state.isFetching && (state.isSuccess || state.isError));
  unsubscribe();
  observer.destroy();
  return result;
}

test("reopening popular, search and detail screens reuses fresh cache without another request", async () => {
  for (const options of [movieQueries.popular(1), movieQueries.search("기생충", 1), movieQueries.detail("550")]) {
    const first = await visit(options);
    assert.equal(first.status, "success");
    const count = requests.length;
    const reopened = await visit(options);
    assert.equal(reopened.status, "success");
    assert.equal(reopened.isStale, false);
    assert.equal(reopened.dataUpdatedAt, first.dataUpdatedAt);
    assert.equal(requests.length, count);
  }
  assert.equal(requests.length, 3);
});

test("different pages, search terms and movie IDs keep independent cached results", async () => {
  const options = [
    movieQueries.popular(1), movieQueries.popular(2),
    movieQueries.search("Dune", 1), movieQueries.search("Dune", 2), movieQueries.search("1917", 1),
    movieQueries.detail("550"), movieQueries.detail("551"),
  ];
  for (const option of options) await queryClient.fetchQuery(option);
  assert.equal(requests.length, 7);
  assert.equal(queryClient.getQueryCache().getAll().length, 7);
  assert.equal(queryClient.getQueryData(options[0].queryKey).page, 1);
  assert.equal(queryClient.getQueryData(options[1].queryKey).page, 2);
  assert.equal(queryClient.getQueryData(options[3].queryKey).page, 2);
  assert.equal(queryClient.getQueryData(options[5].queryKey).id, 550);
  assert.equal(queryClient.getQueryData(options[6].queryKey).id, 551);
  for (const option of options) await queryClient.fetchQuery(option);
  assert.equal(requests.length, 7);
});

test("surrounding search whitespace shares the normalized search cache", async () => {
  await queryClient.fetchQuery(movieQueries.search("  기생충 & 봄?  ", 1));
  await queryClient.fetchQuery(movieQueries.search("기생충 & 봄?", 1));
  assert.equal(requests.length, 1);
  assert.equal(new URL(requests[0].url).searchParams.get("query"), "기생충 & 봄?");
});

test("blank search stays idle until a submitted search enables its query", async () => {
  const observer = new QueryObserver(queryClient, movieQueries.search("   ", 1));
  const unsubscribe = observer.subscribe(() => {});
  try {
    assert.equal(observer.getCurrentResult().fetchStatus, "idle");
    assert.equal(requests.length, 0);
    observer.setOptions(movieQueries.search("Dune", 1));
    const result = await waitFor(observer, (state) => state.isSuccess);
    assert.equal(result.data.movies[0].id, 550);
    assert.equal(requests.length, 1);
  } finally {
    unsubscribe();
    observer.destroy();
  }
});

test("empty search results and a missing detail are successful reusable cache entries", async () => {
  respond = (request) => new URL(request.url).pathname.includes("/search/")
    ? jsonResponse(moviePage([]))
    : jsonResponse({ status_message: "Not found" }, 404);
  const searchOptions = movieQueries.search("없는 영화", 1);
  const detailOptions = movieQueries.detail("999999999");
  const search = await visit(searchOptions);
  const detail = await visit(detailOptions);
  assert.equal(search.status, "success");
  assert.deepEqual(search.data.movies, []);
  assert.equal(detail.status, "success");
  assert.equal(detail.data, null);
  await visit(searchOptions);
  await visit(detailOptions);
  assert.equal(requests.length, 2);
});

test("invalidating an active query refreshes it while preserving the displayed data", async () => {
  const options = movieQueries.popular(1);
  await queryClient.fetchQuery(options);
  let finishResponse;
  respond = () => new Promise((resolve) => { finishResponse = resolve; });
  const observer = new QueryObserver(queryClient, options);
  const unsubscribe = observer.subscribe(() => {});
  try {
    const refreshing = queryClient.invalidateQueries({ queryKey: options.queryKey });
    const pending = observer.getCurrentResult();
    assert.equal(pending.status, "success");
    assert.equal(pending.isFetching, true);
    assert.equal(pending.data.movies[0].id, 550);
    await waitFor(observer, (state) => state.isFetching);
    // ky starts fetch in a microtask after query invalidation.
    while (!finishResponse) await new Promise((resolve) => setImmediate(resolve));
    finishResponse(jsonResponse(moviePage([{ ...movie, id: 551 }])));
    await refreshing;
    assert.equal(observer.getCurrentResult().data.movies[0].id, 551);
    assert.equal(requests.length, 2);
  } finally {
    unsubscribe();
    observer.destroy();
  }
});

test("an authentication error is not retried and a user retry can recover", async () => {
  respond = () => jsonResponse({ status_message: "Unauthorized" }, 401);
  const options = movieQueries.popular(1);
  const observer = new QueryObserver(queryClient, { ...options, retryDelay: 0 });
  const unsubscribe = observer.subscribe(() => {});
  try {
    const failed = await waitFor(observer, (state) => state.isError);
    assert.equal(failed.error.response.status, 401);
    assert.equal(requests.length, 1);
    respond = () => jsonResponse(moviePage());
    const recovered = await observer.refetch();
    assert.equal(recovered.status, "success");
    assert.equal(requests.length, 2);
  } finally {
    unsubscribe();
    observer.destroy();
  }
});

test("a temporary server failure retries once and then succeeds", async () => {
  respond = () => requests.length === 1
    ? jsonResponse({ status_message: "Unavailable" }, 503)
    : jsonResponse(moviePage());
  const result = await visit({ ...movieQueries.popular(1), retryDelay: 0 });
  assert.equal(result.status, "success");
  assert.equal(requests.length, 2);
});

test("leaving a screen cancels its in-flight API request through the query signal", async () => {
  let started;
  const requestStarted = new Promise((resolve) => { started = resolve; });
  respond = (request) => new Promise((resolve, reject) => {
    request.signal.addEventListener("abort", () => reject(request.signal.reason), { once: true });
    started(request);
  });
  const observer = new QueryObserver(queryClient, movieQueries.popular(1));
  const unsubscribe = observer.subscribe(() => {});
  const request = await requestStarted;
  assert.equal(request.signal.aborted, false);
  unsubscribe();
  observer.destroy();
  assert.equal(request.signal.aborted, true);
  assert.equal(requests.length, 1);
});

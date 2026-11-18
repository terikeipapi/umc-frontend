import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { QueryObserver } from "@tanstack/react-query";
import { createServer } from "vite";

const originalFetch = globalThis.fetch;
const apiBase = "https://members.example.test/api/";
let server;
let favorites;
let ratings;
let favoriteQueries;
let ratingQueries;
let auth;
let queryClient;
let requests = [];
let respond;

const json = (result, status = 200) => new Response(JSON.stringify({
  isSuccess: true, code: "COMMON200", message: "요청에 성공했습니다.", result,
}), { status, headers: { "content-type": "application/json" } });
const failure = (status, message = "요청에 실패했습니다.") => new Response(JSON.stringify({
  isSuccess: false, code: `ERROR${status}`, message, result: null,
}), { status, headers: { "content-type": "application/json" } });
const token = (memberId = 17) => `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: String(memberId), exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.test-signature`;
const savedRating = { ratingId: 91, memberId: 17, movieId: 550, score: 4, comment: "다시 보고 싶은 영화" };

before(async () => {
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    requests.push(request.clone());
    return respond(request);
  };
  server = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false,
    envDir: fileURLToPath(new URL("./fixtures/no-env/", import.meta.url)),
    define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify(apiBase) },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: "custom", optimizeDeps: { noDiscovery: true, include: [] }, logLevel: "error",
  });
  favorites = await server.ssrLoadModule("/src/api/favorites.ts");
  ratings = await server.ssrLoadModule("/src/api/ratings.ts");
  ({ favoriteQueries } = await server.ssrLoadModule("/src/queries/favorites.ts"));
  ({ ratingQueries } = await server.ssrLoadModule("/src/queries/ratings.ts"));
  ({ useAuthStore: auth } = await server.ssrLoadModule("/src/store/auth-store.ts"));
  ({ queryClient } = await server.ssrLoadModule("/src/lib/query-client.ts"));
});

beforeEach(() => {
  requests = [];
  respond = () => { throw new Error("Unexpected network request"); };
  auth.getState().setSession(token());
});

afterEach(() => {
  queryClient?.clear();
  auth?.getState().clearSession();
});

after(async () => {
  await server?.close();
  globalThis.fetch = originalFetch;
});

function assertRequest(index, path, method = "GET") {
  const request = requests[index];
  assert.ok(request, `Request ${index} exists`);
  assert.equal(request.url, apiBase + path);
  assert.equal(request.method, method);
  assert.equal(request.headers.get("authorization"), `Bearer ${auth.getState().accessToken}`);
  assert.equal(request.headers.get("accept"), "application/json");
  return request;
}

test("favorite list and movie status use authenticated member API, not TMDB", async () => {
  respond = (request) => json(request.url.endsWith("/550")
    ? { isFavorite: true }
    : [{ favoriteId: 3, movieId: 550, createdAt: "2026-11-17T00:00:00.000Z" }]);
  assert.deepEqual(await favorites.getFavorites(), [{ favoriteId: 3, movieId: 550, createdAt: "2026-11-17T00:00:00.000Z" }]);
  assert.deepEqual(await favorites.getFavorite(550), { movieId: 550, isFavorite: true });
  assertRequest(0, "favorites");
  assertRequest(1, "favorites/550");
  assert.equal(requests.length, 2);
});

test("favorite creation sends only movieId and removal targets that movieId", async () => {
  respond = (request) => json(request.method === "DELETE" ? null : { favoriteId: 3, movieId: 550, createdAt: "2026-11-17T00:00:00.000Z" });
  assert.deepEqual(await favorites.addFavorite(550), { movieId: 550, isFavorite: true });
  assert.deepEqual(await assertRequest(0, "favorites", "POST").json(), { movieId: 550 });
  await favorites.deleteFavorite(550);
  assertRequest(1, "favorites/550", "DELETE");
  assert.equal(requests.length, 2);
});

test("member ratings preserve ratingId and filter data in the UI instead of changing the endpoint", async () => {
  respond = () => json([savedRating]);
  assert.deepEqual(await ratings.getMemberRatings(17), [savedRating]);
  assertRequest(0, "members/17/ratings");
  assert.equal(requests.length, 1);
});

test("rating creation sends movie, score and comment without a client supplied owner", async () => {
  respond = () => json(savedRating, 201);
  assert.deepEqual(await ratings.createRating({ movieId: 550, score: 4, comment: savedRating.comment, memberId: 999, ratingId: 1000 }), savedRating);
  assert.deepEqual(await assertRequest(0, "ratings", "POST").json(), { movieId: 550, score: 4, comment: savedRating.comment });
});

test("rating update and deletion use ratingId rather than the movieId", async () => {
  respond = (request) => json(request.method === "DELETE" ? null : { ...savedRating, score: 5, comment: "수정한 후기" });
  const updated = await ratings.updateRating(91, { score: 5, comment: "수정한 후기", movieId: 550, memberId: 999 });
  assert.equal(updated.score, 5);
  assert.deepEqual(await assertRequest(0, "ratings/91", "PATCH").json(), { score: 5, comment: "수정한 후기" });
  await ratings.deleteRating(91);
  assertRequest(1, "ratings/91", "DELETE");
  assert.equal(requests.length, 2);
});

test("failed favorite and rating writes expose the server error and never retry automatically", async () => {
  respond = () => failure(503, "서버 점검 중입니다.");
  for (const request of [
    () => favorites.addFavorite(550), () => favorites.deleteFavorite(550),
    () => ratings.createRating({ movieId: 550, score: 4 }),
    () => ratings.updateRating(91, { score: 5 }), () => ratings.deleteRating(91),
  ]) {
    const before = requests.length;
    await assert.rejects(request(), (error) => {
      assert.equal(error.status, 503);
      assert.equal(error.message, "서버 점검 중입니다.");
      return true;
    });
    assert.equal(requests.length, before + 1);
  }
});

test("an expired server session clears authentication instead of retrying a protected request", async () => {
  respond = () => failure(401, "로그인이 필요합니다.");
  await assert.rejects(favorites.getFavorites(), (error) => error.status === 401);
  assert.equal(requests.length, 1);
  assert.equal(auth.getState().accessToken, null);
  assert.equal(auth.getState().memberId, null);
});

test("a response from a previous login cannot overwrite data or expire the new account", async () => {
  for (const status of [200, 401]) {
    auth.getState().setSession(token(17));
    let complete;
    respond = () => new Promise((resolve) => { complete = resolve; });
    const pending = favorites.getFavorites();
    while (!complete) await new Promise((resolve) => setImmediate(resolve));
    const currentToken = token(18);
    auth.getState().setSession(currentToken);
    complete(status === 200 ? json([{ movieId: 550 }]) : failure(401));
    await assert.rejects(pending, (error) => error.code === "SESSION_CHANGED");
    assert.equal(auth.getState().memberId, 18);
    assert.equal(auth.getState().accessToken, currentToken);
  }
  assert.equal(requests.length, 2);
});

test("anonymous favorites and ratings queries stay idle without sending a request", async () => {
  auth.getState().clearSession();
  for (const options of [favoriteQueries.list(null), favoriteQueries.detail(null, 550), ratingQueries.member(null)]) {
    const observer = new QueryObserver(queryClient, options);
    const unsubscribe = observer.subscribe(() => {});
    assert.equal(observer.getCurrentResult().fetchStatus, "idle");
    unsubscribe();
    observer.destroy();
  }
  assert.equal(requests.length, 0);
});

test("different members cannot reuse each other's favorite or rating query data", async () => {
  respond = (request) => json(request.url.includes("/ratings") ? [{ ...savedRating, memberId: auth.getState().memberId }] : [{ movieId: auth.getState().memberId === 17 ? 550 : 551 }]);
  for (const memberId of [17, 18]) {
    auth.getState().setSession(token(memberId));
    await queryClient.fetchQuery(favoriteQueries.list(memberId));
    await queryClient.fetchQuery(ratingQueries.member(memberId));
  }
  assert.notDeepEqual(favoriteQueries.list(17).queryKey, favoriteQueries.list(18).queryKey);
  assert.notDeepEqual(ratingQueries.member(17).queryKey, ratingQueries.member(18).queryKey);
  assert.deepEqual(queryClient.getQueryData(favoriteQueries.list(17).queryKey), [{ movieId: 550 }]);
  assert.deepEqual(queryClient.getQueryData(favoriteQueries.list(18).queryKey), [{ movieId: 551 }]);
  assert.equal(queryClient.getQueryData(ratingQueries.member(17).queryKey)[0].memberId, 17);
  assert.equal(queryClient.getQueryData(ratingQueries.member(18).queryKey)[0].memberId, 18);
  assert.equal(requests.length, 4);
});

test("favorite query cancellation reaches the authenticated HTTP request", async () => {
  let started;
  const requestStarted = new Promise((resolve) => { started = resolve; });
  respond = (request) => new Promise((resolve, reject) => {
    request.signal.addEventListener("abort", () => reject(request.signal.reason), { once: true });
    started(request);
  });
  const observer = new QueryObserver(queryClient, favoriteQueries.list(17));
  const unsubscribe = observer.subscribe(() => {});
  const request = await requestStarted;
  assert.equal(request.signal.aborted, false);
  unsubscribe();
  observer.destroy();
  assert.equal(request.signal.aborted, true);
  assert.equal(requests.length, 1);
});

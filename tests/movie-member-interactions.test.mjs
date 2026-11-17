import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { registerHooks } from "node:module";
import { act, createElement } from "react";
import { JSDOM } from "jsdom";
import { createServer } from "vite";

const originalFetch = globalThis.fetch;
const globals = new Map();
let dom;
let vite;
let resolver;
let createRoot;
let routing;
let QueryClientProvider;
let queryClient;
let auth;
let favoriteQueries;
let ratingQueries;
let BookmarkButton;
let RatingForm;
let reactRoot;
let requests = [];
let respond;

const token = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: "17", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.test-signature`;
const nextTurn = () => new Promise((resolve) => setTimeout(resolve, 5));
const success = (result) => new Response(JSON.stringify({ isSuccess: true, code: "COMMON200", message: "요청에 성공했습니다.", result }), {
  headers: { "content-type": "application/json" },
});
const failure = () => new Response(JSON.stringify({ isSuccess: false, code: "COMMON503", message: "잠시 후 다시 시도해 주세요.", result: null }), {
  status: 503, headers: { "content-type": "application/json" },
});

function expose(name, value) {
  globals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

before(async () => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost:5173/", pretendToBeVisual: true });
  dom.window.scrollTo = () => {};
  for (const name of ["window", "self", "document", "navigator", "HTMLElement", "HTMLInputElement", "HTMLTextAreaElement", "Node"]) {
    expose(name, name === "window" ? dom.window : dom.window[name]);
  }
  expose("requestAnimationFrame", dom.window.requestAnimationFrame.bind(dom.window));
  expose("cancelAnimationFrame", dom.window.cancelAnimationFrame.bind(dom.window));
  expose("scrollTo", () => {});
  expose("IS_REACT_ACT_ENVIRONMENT", true);
  resolver = registerHooks({
    resolve(specifier, context, nextResolve) {
      return nextResolve(specifier, specifier === "@tanstack/router-core/isServer"
        ? { ...context, conditions: ["browser", ...context.conditions] } : context);
    },
  });
  ({ createRoot } = await import("react-dom/client"));
  ({ QueryClientProvider } = await import("@tanstack/react-query"));
  routing = await import("@tanstack/react-router");
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    requests.push(request.clone());
    return respond(request);
  };
  vite = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)), configFile: false,
    envDir: fileURLToPath(new URL("./fixtures/no-env/", import.meta.url)),
    define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("http://localhost:3000") },
    esbuild: { jsx: "automatic" },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: "custom", optimizeDeps: { noDiscovery: true, include: [] }, logLevel: "error",
  });
  ({ default: BookmarkButton } = await vite.ssrLoadModule("/src/components/movies/bookmark-button.tsx"));
  ({ RatingForm } = await vite.ssrLoadModule("/src/components/movies/rating-form.tsx"));
  ({ useAuthStore: auth } = await vite.ssrLoadModule("/src/store/auth-store.ts"));
  ({ queryClient } = await vite.ssrLoadModule("/src/lib/query-client.ts"));
  // Mutation observers schedule collection after unmount; collect immediately in
  // this isolated test process instead of leaving browser-length timers alive.
  queryClient.setDefaultOptions({ ...queryClient.getDefaultOptions(), mutations: { gcTime: 0 } });
  ({ favoriteQueries } = await vite.ssrLoadModule("/src/queries/favorites.ts"));
  ({ ratingQueries } = await vite.ssrLoadModule("/src/queries/ratings.ts"));
});

beforeEach(() => {
  requests = [];
  respond = () => { throw new Error("Unexpected request in offline interaction test"); };
  document.body.innerHTML = '<div id="test-root"></div>';
  auth.getState().setSession(token);
});

afterEach(async () => {
  if (reactRoot) await act(async () => reactRoot.unmount());
  reactRoot = undefined;
  queryClient?.clear();
  auth?.getState().clearSession();
});

after(async () => {
  await vite?.close();
  resolver?.deregister();
  dom?.window.close();
  globalThis.fetch = originalFetch;
  for (const [name, descriptor] of globals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
});

async function mount(component) {
  const { createRootRoute, createRoute, createRouter, createMemoryHistory, Outlet, RouterProvider } = routing;
  const root = createRootRoute({ component: Outlet });
  const router = createRouter({
    routeTree: root.addChildren([
      createRoute({ getParentRoute: () => root, path: "/movies/550", component }),
      createRoute({ getParentRoute: () => root, path: "/login", component: () => createElement("h1", null, "로그인") }),
    ]),
    history: createMemoryHistory({ initialEntries: ["/movies/550"] }), defaultPendingMs: 0, defaultPendingMinMs: 0,
  });
  await router.load();
  reactRoot = createRoot(document.getElementById("test-root"));
  await act(async () => {
    reactRoot.render(createElement(QueryClientProvider, { client: queryClient }, createElement(RouterProvider, { router })));
    await nextTurn();
  });
  return router;
}

async function until(predicate, message = "Expected UI state") {
  const deadline = Date.now() + 2000;
  while (!predicate() && Date.now() < deadline) await act(nextTurn);
  assert.ok(predicate(), `${message}: ${document.body.textContent}`);
}

async function click(element) {
  assert.ok(element, "The requested control exists");
  await act(async () => { element.click(); await nextTurn(); });
}

async function typeComment(value) {
  const field = document.querySelector("textarea");
  assert.ok(field, "The review field exists");
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, "value").set.call(field, value);
    field.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  });
}

const bookmark = () => document.querySelector("button[aria-pressed]");
const submit = () => document.querySelector('button[type="submit"]');
const score = (value) => document.querySelector(`input[type="radio"][value="${value}"]`);
const writes = () => requests.filter((request) => request.method !== "GET");

test("anonymous movie controls avoid member requests and return through login", async () => {
  auth.getState().clearSession();
  const router = await mount(() => createElement("div", null,
    createElement(BookmarkButton, { movieId: 550, movieTitle: "파이트 클럽" }),
    createElement(RatingForm, { movieId: 550 })));
  assert.equal(requests.length, 0);
  await click(bookmark());
  assert.equal(router.state.location.pathname, "/login");
  assert.equal(router.state.location.search.redirect, "/movies/550");
  assert.equal(requests.length, 0);
});

test("favorite pending state blocks duplicate writes and success updates status and list caches", async () => {
  let isFavorite = false;
  let complete;
  respond = (request) => request.method === "GET" ? success({ movieId: 550, isFavorite }) : new Promise((resolve) => { complete = resolve; });
  queryClient.setQueryData(favoriteQueries.list(17).queryKey, []);
  await mount(() => createElement(BookmarkButton, { movieId: 550, movieTitle: "파이트 클럽" }));
  await until(() => bookmark() && !bookmark().disabled);
  assert.equal(bookmark().getAttribute("aria-pressed"), "false");
  await click(bookmark());
  assert.equal(bookmark().disabled, true);
  await click(bookmark());
  assert.equal(writes().length, 1);
  assert.deepEqual(await writes()[0].json(), { movieId: 550 });
  isFavorite = true;
  await act(async () => { complete(success({ movieId: 550, isFavorite: true })); await nextTurn(); });
  await until(() => bookmark().getAttribute("aria-pressed") === "true" && !bookmark().disabled);
  assert.equal(queryClient.getQueryData(favoriteQueries.detail(17, 550).queryKey).isFavorite, true);
  assert.ok(queryClient.getQueryData(favoriteQueries.list(17).queryKey).some((favorite) => favorite.movieId === 550));
  await click(bookmark());
  assert.equal(writes()[1].method, "DELETE");
  assert.equal(new URL(writes()[1].url).pathname, "/favorites/550");
  isFavorite = false;
  await act(async () => { complete(success(null)); await nextTurn(); });
  await until(() => bookmark().getAttribute("aria-pressed") === "false" && !bookmark().disabled);
  assert.deepEqual(queryClient.getQueryData(favoriteQueries.list(17).queryKey), []);
});

test("a failed favorite write keeps the saved state and shows retryable feedback", async () => {
  respond = (request) => request.method === "GET" ? success({ movieId: 550, isFavorite: false }) : failure();
  queryClient.setQueryData(favoriteQueries.list(17).queryKey, []);
  await mount(() => createElement(BookmarkButton, { movieId: 550, movieTitle: "파이트 클럽" }));
  await until(() => bookmark() && !bookmark().disabled);
  await click(bookmark());
  await until(() => document.querySelector('[role="alert"]'));
  assert.equal(bookmark().getAttribute("aria-pressed"), "false");
  assert.equal(bookmark().disabled, false);
  assert.deepEqual(queryClient.getQueryData(favoriteQueries.list(17).queryKey), []);
  assert.equal(writes().length, 1);
});

test("rating creation, editing and deletion follow the server ratingId and refresh the form", async () => {
  let rating = null;
  respond = async (request) => {
    if (request.method === "GET") return success(rating ? [rating] : []);
    if (request.method === "DELETE") { rating = null; return success(null); }
    const body = await request.json();
    rating = { ratingId: 91, memberId: 17, movieId: 550, score: body.score, comment: body.comment ?? null };
    return success(rating);
  };
  await mount(() => createElement(RatingForm, { movieId: 550 }));
  await until(() => score(4));
  await click(score(4));
  await typeComment("처음 남긴 후기");
  await click(submit());
  await until(() => writes().length === 1 && queryClient.getQueryData(ratingQueries.member(17).queryKey)?.[0]?.ratingId === 91 && !score(4).disabled);
  assert.equal(writes()[0].method, "POST");
  assert.deepEqual(await writes()[0].json(), { movieId: 550, score: 4, comment: "처음 남긴 후기" });
  assert.equal(queryClient.getQueryData(ratingQueries.member(17).queryKey)[0].ratingId, 91);
  await click(score(5));
  await typeComment("수정한 후기");
  await click(submit());
  await until(() => writes().length === 2 && queryClient.getQueryData(ratingQueries.member(17).queryKey)?.[0]?.score === 5 && !score(5).disabled);
  assert.equal(writes()[1].method, "PATCH");
  assert.equal(new URL(writes()[1].url).pathname, "/ratings/91");
  assert.deepEqual(await writes()[1].json(), { score: 5, comment: "수정한 후기" });
  const remove = [...document.querySelectorAll("button")].find((button) => button.textContent.includes("삭제"));
  await click(remove);
  await until(() => writes().length === 3 && queryClient.getQueryData(ratingQueries.member(17).queryKey)?.length === 0);
  assert.equal(writes()[2].method, "DELETE");
  assert.equal(new URL(writes()[2].url).pathname, "/ratings/91");
  assert.equal(document.querySelector("textarea").value, "");
});

test("a failed rating save preserves the draft, score and saved query data", async () => {
  respond = (request) => request.method === "GET" ? success([]) : failure();
  await mount(() => createElement(RatingForm, { movieId: 550 }));
  await until(() => score(3));
  await click(score(3));
  await typeComment("실패해도 보존할 후기");
  await click(submit());
  await until(() => document.querySelector('[role="alert"]'));
  assert.equal(document.querySelector("textarea").value, "실패해도 보존할 후기");
  assert.equal(score(3).checked, true);
  assert.equal(submit().disabled, false);
  assert.deepEqual(queryClient.getQueryData(ratingQueries.member(17).queryKey), []);
  assert.equal(writes().length, 1);
});

test("a duplicate-rating conflict preserves the draft and retries against the refreshed ratingId", async () => {
  let serverRating = null;
  respond = async (request) => {
    if (request.method === "GET") return success(serverRating ? [serverRating] : []);
    if (request.method === "POST") {
      serverRating = { ratingId: 91, memberId: 17, movieId: 550, score: 5, comment: "다른 탭에서 작성한 후기" };
      return new Response(JSON.stringify({ isSuccess: false, code: "RATING409_1", message: "이미 평점을 남기셨습니다.", result: null }), {
        status: 409, headers: { "content-type": "application/json" },
      });
    }
    const body = await request.json();
    serverRating = { ...serverRating, ...body };
    return success(serverRating);
  };
  await mount(() => createElement(RatingForm, { movieId: 550 }));
  await until(() => score(3));
  await click(score(3));
  await typeComment("보존해야 할 내 후기");
  await click(submit());
  await until(() => queryClient.getQueryData(ratingQueries.member(17).queryKey)?.[0]?.ratingId === 91 && !submit().disabled);
  assert.equal(document.querySelector("textarea").value, "보존해야 할 내 후기");
  assert.equal(score(3).checked, true);
  assert.ok(document.querySelector('[role="alert"]'));
  await click(submit());
  await until(() => writes().length === 2 && queryClient.getQueryData(ratingQueries.member(17).queryKey)?.[0]?.comment === "보존해야 할 내 후기");
  assert.equal(writes()[0].method, "POST");
  assert.equal(writes()[1].method, "PATCH");
  assert.equal(new URL(writes()[1].url).pathname, "/ratings/91");
  assert.deepEqual(await writes()[1].json(), { score: 3, comment: "보존해야 할 내 후기" });
});

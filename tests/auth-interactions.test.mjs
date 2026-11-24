import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { act, createElement } from "react";
import { JSDOM } from "jsdom";
import { createTestRouter, TestRouteView } from "./helpers/next-router.mjs";
import { createSourceLoader } from "./helpers/source-loader.mjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const originalFetch = globalThis.fetch;
const originalGlobals = new Map();
let dom;
let source;
let createRoot;
let pages;
let profileModule;
let memberQueries;
let queryClient;
let observer;
let authLayout;
let reactRoot;
let requests = [];
let respond;

function expose(name, value) {
  originalGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

const nextTurn = () => new Promise((resolve) => setTimeout(resolve, 10));
const token = (memberId = 17, expires = Math.floor(Date.now() / 1000) + 3600) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ sub: String(memberId), exp: expires })).toString("base64url")}.signature`;
const member = { email: "movie@example.com", nickname: "영화산책", createdAt: "2026-11-17T00:00:00.000Z" };
const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json" },
});
const apiSuccess = (result, message = "요청에 성공했습니다.") => jsonResponse({
  isSuccess: true, code: "COMMON200", message, result,
});
function deferred() {
  let resolve;
  const promise = new Promise((complete) => { resolve = complete; });
  return { promise, resolve };
}

before(async () => {
  // This is an isolated DOM test, with no browser or external server involved.
  dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost:3001/",
    pretendToBeVisual: true,
  });
  dom.window.scrollTo = () => {};
  for (const name of ["window", "self", "document", "navigator", "HTMLElement", "HTMLInputElement", "Node"]) {
    expose(name, name === "window" ? dom.window : dom.window[name]);
  }
  expose("requestAnimationFrame", dom.window.requestAnimationFrame.bind(dom.window));
  expose("cancelAnimationFrame", dom.window.cancelAnimationFrame.bind(dom.window));
  expose("localStorage", dom.window.localStorage);
  expose("scrollTo", () => {});
  expose("IS_REACT_ACT_ENVIRONMENT", true);
  ({ createRoot } = await import("react-dom/client"));
  // ky captures fetch at module initialization, so install the offline fixture first.
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    requests.push(request.clone());
    return respond(request);
  };
  source = await createSourceLoader({
    define: { "process.env.NEXT_PUBLIC_API_BASE_URL": JSON.stringify("http://localhost:3000") },
  });
  const [login, profile, edit, signup] = await Promise.all([
    source.load("/src/features/auth/login-page.tsx"),
    source.load("/src/features/member/profile-page.tsx"),
    source.load("/src/features/member/edit-profile-page.tsx"),
    source.load("/src/features/auth/signup-page.tsx"),
  ]);
  profileModule = await source.load("/src/store/auth-store.ts");
  ({ memberQueries } = await source.load("/src/queries/member.ts"));
  ({ SessionObserver: observer } = await source.load("/src/components/auth/session-observer.tsx"));
  authLayout = await source.load("/src/components/auth/auth-guard.tsx");
  pages = [
    ["/login", login.LoginPage], ["/mypage", profile.ProfilePage],
    ["/mypage/edit", edit.EditProfilePage], ["/signup", signup.SignupPage],
  ];
});

beforeEach(() => {
  requests = [];
  respond = (request) => new URL(request.url).pathname === "/members/me" && request.method === "GET"
    ? apiSuccess(member) : new URL(request.url).pathname === "/favorites" ? apiSuccess([])
      : (() => { throw new Error(`Unexpected ${request.method} ${request.url}`); })();
  document.body.innerHTML = '<div id="test-root"></div>';
  profileModule.useAuthStore.getState().clearSession();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
});

afterEach(async () => {
  if (reactRoot) await act(async () => { reactRoot.unmount(); });
  reactRoot = undefined;
  queryClient.clear();
});

after(async () => {
  await source?.close();
  dom?.window.close();
  globalThis.fetch = originalFetch;
  for (const [name, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
});

async function mount(pathname) {
  const router = createTestRouter(pathname);
  reactRoot = createRoot(document.querySelector("#test-root"));
  await act(async () => {
    reactRoot.render(createElement(QueryClientProvider, { client: queryClient },
      createElement(TestRouteView, { router, routes: pages, guard: authLayout.AuthGuard, observer })));
    await nextTurn();
  });
  await act(async () => { await nextTurn(); });
  return router;
}

function field(label) {
  const element = [...document.querySelectorAll("label")].find((node) => node.textContent.trim() === label);
  assert.ok(element, `The ${label} field is labeled`);
  const input = document.getElementById(element.htmlFor);
  assert.ok(input instanceof dom.window.HTMLInputElement);
  return input;
}

function button(label) {
  const element = [...document.querySelectorAll("button")].find((node) =>
    node.getAttribute("aria-label") === label || node.textContent.trim() === label);
  assert.ok(element, `Button ${label} exists`);
  return element;
}

async function type(label, value) {
  const input = field(label);
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(input, value);
    input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  });
  // HTML email inputs sanitize surrounding ASCII whitespace before onChange.
  assert.equal(input.value, input.type === "email" ? value.trim() : value);
}

async function click(element) {
  await act(async () => { element.click(); await nextTurn(); });
}

async function settlePending(pending, response) {
  await act(async () => { pending.resolve(response); await nextTurn(); });
}

async function completeSignupForm() {
  await type("이메일", "  new@example.com  ");
  await type("닉네임", "  영화친구  ");
  await type("비밀번호", "Movie!123");
  await type("비밀번호 확인", "Movie!123");
}

test("client hydration restores a valid stored session and removes an expired token", () => {
  const stored = token();
  window.localStorage.setItem(profileModule.AUTH_STORAGE_KEY, stored);
  profileModule.hydrateSession();
  assert.equal(profileModule.useAuthStore.getState().hydrated, true);
  assert.equal(profileModule.useAuthStore.getState().accessToken, stored);
  assert.equal(profileModule.useAuthStore.getState().memberId, 17);
  window.localStorage.setItem(profileModule.AUTH_STORAGE_KEY, token(17, 1));
  profileModule.hydrateSession();
  assert.equal(profileModule.useAuthStore.getState().accessToken, null);
  assert.equal(window.localStorage.getItem(profileModule.AUTH_STORAGE_KEY), null);
  assert.equal(requests.length, 0);
});

test("both protected Next routes replace anonymous visits with a safe login return URL", async () => {
  for (const pathname of ["/mypage", "/mypage/edit?from=profile"]) {
    const router = await mount(pathname);
    assert.equal(router.location.pathname, "/login");
    assert.equal(router.location.searchParams.get("redirect"), pathname);
    assert.equal(document.querySelector("h1").textContent, "로그인");
    assert.equal(requests.length, 0);
    await act(async () => reactRoot.unmount());
    reactRoot = undefined;
  }
});

test("login validates input, toggles password visibility and sends one request while pending", async () => {
  const router = await mount("/login?redirect=/mypage");
  assert.equal(button("로그인").disabled, true);
  await type("이메일", "not-an-email");
  await type("비밀번호", "old");
  assert.equal(field("이메일").getAttribute("aria-invalid"), "true");
  assert.equal(button("로그인").disabled, true);
  await type("이메일", "movie@example.com");
  assert.equal(button("로그인").disabled, false);
  assert.equal(field("비밀번호").type, "password");
  await click(button("비밀번호 보기"));
  assert.equal(field("비밀번호").type, "text");
  assert.equal(field("비밀번호").value, "old");
  await click(button("비밀번호 숨기기"));
  assert.equal(field("비밀번호").type, "password");
  const pending = deferred();
  respond = () => pending.promise;
  const form = document.querySelector("form");
  await act(async () => {
    form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
    form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
    await nextTurn();
  });
  assert.equal(requests.length, 1);
  assert.equal(new URL(requests[0].url).pathname, "/auth/login");
  assert.equal(requests[0].headers.has("authorization"), false);
  assert.deepEqual(await requests[0].json(), { email: "movie@example.com", password: "old" });
  assert.equal(button("로그인 중…").disabled, true);
  respond = (request) => apiSuccess(new URL(request.url).pathname === "/favorites" ? [] : member);
  await settlePending(pending, apiSuccess({ nickname: member.nickname, accessToken: token() }));
  await act(async () => { await nextTurn(); });
  assert.equal(profileModule.useAuthStore.getState().memberId, 17);
  assert.equal(router.location.pathname, "/mypage");
});

test("failed login displays server feedback and allows retry without creating a session", async () => {
  await mount("/login");
  await type("이메일", "movie@example.com");
  await type("비밀번호", "wrong");
  respond = () => jsonResponse({ isSuccess: false, code: "AUTH401_1", message: "이메일 또는 비밀번호가 올바르지 않습니다.", result: null }, 401);
  await click(button("로그인"));
  assert.match(document.querySelector('[role="alert"]').textContent, /이메일 또는 비밀번호/);
  assert.equal(profileModule.useAuthStore.getState().accessToken, null);
  assert.equal(button("로그인").disabled, false);
});

test("a 401 while viewing a protected page clears the session and returns to login", async () => {
  profileModule.useAuthStore.getState().setSession(token());
  respond = () => jsonResponse({ isSuccess: false, code: "AUTH401", message: "다시 로그인해 주세요.", result: null }, 401);
  const router = await mount("/mypage");
  await act(async () => { await nextTurn(); });
  assert.equal(profileModule.useAuthStore.getState().memberId, null);
  assert.equal(router.location.pathname, "/login");
  assert.equal(router.location.searchParams.get("redirect"), "/mypage");
  assert.equal(document.querySelector("h1").textContent, "로그인");
});

test("token expiry redirects an open protected page and removes its private cache", async () => {
  profileModule.useAuthStore.getState().setSession(token(17, (Date.now() + 180) / 1000));
  const router = await mount("/mypage");
  assert.equal(router.location.pathname, "/mypage");
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 220)); });
  await act(async () => { await nextTurn(); });
  assert.equal(profileModule.useAuthStore.getState().memberId, null);
  assert.equal(router.location.pathname, "/login");
  assert.equal(queryClient.getQueryData(["member", 17, "me"]), undefined);
  assert.equal(queryClient.getQueryData(["favorites", 17, "list"]), undefined);
});

test("profile edit rejects invalid or unchanged input and saves a changed nickname into the view route", async () => {
  profileModule.useAuthStore.getState().setSession(token());
  const router = await mount("/mypage/edit");
  assert.equal(field("이메일").readOnly, true);
  assert.equal(button("저장하기").disabled, true);
  await type("닉네임", "가");
  assert.equal(button("저장하기").disabled, true);
  assert.equal(field("닉네임").getAttribute("aria-invalid"), "true");
  await type("닉네임", "  영화산책  ");
  assert.equal(button("저장하기").disabled, true);
  await type("닉네임", "  새로운영화친구  ");
  assert.equal(button("저장하기").disabled, false);
  respond = (request) => apiSuccess(new URL(request.url).pathname === "/favorites" ? [] : { ...member, nickname: "새로운영화친구" });
  await click(button("저장하기"));
  assert.equal(router.location.pathname, "/mypage");
  assert.equal(document.querySelector("h1").textContent, "내 정보");
  assert.match(document.querySelector("dl").textContent, /새로운영화친구/);
  assert.match(document.querySelector("dl").textContent, /movie@example.com/);
  const patches = requests.filter((request) => request.method === "PATCH");
  assert.equal(patches.length, 1);
  assert.deepEqual(await patches[0].json(), { nickname: "새로운영화친구" });
  assert.match(patches[0].headers.get("authorization"), /^Bearer /);
});

test("cancel discards the edit draft and a later edit starts with the saved nickname", async () => {
  profileModule.useAuthStore.getState().setSession(token());
  queryClient.setQueryData(memberQueries.me(17).queryKey, { ...member, nickname: "기존회원" });
  const router = await mount("/mypage/edit");
  assert.equal(field("닉네임").value, "기존회원");
  await type("닉네임", "취소할이름");
  const cancel = [...document.querySelectorAll("a")].find((node) => node.textContent === "취소");
  await click(cancel);
  assert.equal(router.location.pathname, "/mypage");
  assert.match(document.querySelector("dl").textContent, /기존회원/);
  assert.doesNotMatch(document.querySelector("dl").textContent, /취소할이름/);
  const edit = [...document.querySelectorAll("a")].find((node) => node.textContent === "내 정보 수정");
  await click(edit);
  assert.equal(router.location.pathname, "/mypage/edit");
  assert.equal(field("닉네임").value, "기존회원");
  assert.equal(requests.filter((request) => request.method === "PATCH").length, 0);
});

test("signup duplicate checks lock their field, recover from failure and reset when the value changes", async () => {
  await mount("/signup");
  assert.equal(button("가입하기").disabled, true);
  assert.equal(button("이메일 중복 확인").disabled, true);
  await completeSignupForm();
  assert.equal(button("가입하기").disabled, true);
  const pending = deferred();
  respond = () => pending.promise;
  await click(button("이메일 중복 확인"));
  assert.equal(field("이메일").disabled, true);
  assert.equal(button("이메일 중복 확인").disabled, true);
  assert.equal(button("이메일 중복 확인").textContent, "확인 중…");
  await click(button("이메일 중복 확인"));
  assert.equal(requests.length, 1);
  await settlePending(pending, jsonResponse({ isSuccess: false, code: "COMMON500", message: "중복 확인 서버 오류", result: null }, 500));
  assert.equal(field("이메일").disabled, false);
  assert.equal(button("이메일 중복 확인").disabled, false);
  assert.match(document.body.textContent, /중복 확인 서버 오류/);
  respond = () => apiSuccess({ email: "new@example.com", exists: false });
  await click(button("이메일 중복 확인"));
  assert.equal(requests.length, 2);
  assert.match(document.body.textContent, /사용 가능한 이메일/);
  await type("이메일", "changed@example.com");
  assert.doesNotMatch(document.body.textContent, /사용 가능한 이메일/);
  assert.equal(button("가입하기").disabled, true);
});

test("signup sends one trimmed payload without confirmation, locks pending submission and shows success", async () => {
  await mount("/signup");
  await completeSignupForm();
  respond = (request) => apiSuccess(new URL(request.url).pathname.includes("/email/")
    ? { email: "new@example.com", exists: false }
    : { nickname: "영화친구", exists: false });
  await click(button("이메일 중복 확인"));
  await click(button("닉네임 중복 확인"));
  assert.equal(button("가입하기").disabled, false);
  const pending = deferred();
  respond = () => pending.promise;
  const form = document.querySelector("form");
  await act(async () => {
    form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
    form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
    await nextTurn();
  });
  const posts = requests.filter((request) => request.method === "POST");
  assert.equal(posts.length, 1);
  assert.equal(new URL(posts[0].url).pathname, "/members");
  assert.deepEqual(await posts[0].json(), {
    email: "new@example.com", nickname: "영화친구", password: "Movie!123",
  });
  assert.equal(document.querySelector("form").getAttribute("aria-busy"), "true");
  assert.ok([...document.querySelectorAll("input, button")].every((element) => element.disabled));
  assert.equal(button("가입 중…").disabled, true);
  await settlePending(pending, apiSuccess({ memberId: 7, email: "new@example.com", nickname: "영화친구" }, "회원가입에 성공했습니다."));
  assert.match(document.querySelector('[role="status"]').textContent, /회원가입에 성공했습니다/);
  assert.ok([...document.querySelectorAll('a[href="/login"]')].some((node) => node.textContent === "로그인하러 가기"));
  assert.equal(document.querySelector('input[type="password"]'), null);
});

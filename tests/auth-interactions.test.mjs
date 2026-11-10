import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { registerHooks } from "node:module";
import { act, createElement } from "react";
import { JSDOM } from "jsdom";
import { createServer } from "vite";

const rootDirectory = fileURLToPath(new URL("../", import.meta.url));
const originalFetch = globalThis.fetch;
const originalGlobals = new Map();
let dom;
let vite;
let createRoot;
let routing;
let pages;
let profileModule;
let clientResolver;
let reactRoot;
let requests = [];
let respond;

function expose(name, value) {
  originalGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

const nextTurn = () => new Promise((resolve) => setImmediate(resolve));
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
    url: "http://localhost:5173/",
    pretendToBeVisual: true,
  });
  dom.window.scrollTo = () => {};
  for (const name of ["window", "self", "document", "navigator", "HTMLElement", "HTMLInputElement", "Node"]) {
    expose(name, name === "window" ? dom.window : dom.window[name]);
  }
  expose("requestAnimationFrame", dom.window.requestAnimationFrame.bind(dom.window));
  expose("cancelAnimationFrame", dom.window.cancelAnimationFrame.bind(dom.window));
  expose("scrollTo", () => {});
  expose("IS_REACT_ACT_ENVIRONMENT", true);
  // Node's default export selects the router's SSR implementation. Model the
  // application's client condition when mounting into a DOM, without patching it.
  clientResolver = registerHooks({
    resolve(specifier, context, nextResolve) {
      return nextResolve(specifier, specifier === "@tanstack/router-core/isServer"
        ? { ...context, conditions: ["browser", ...context.conditions] }
        : context);
    },
  });
  ({ createRoot } = await import("react-dom/client"));
  routing = await import("@tanstack/react-router");
  // ky captures fetch at module initialization, so install the offline fixture first.
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    requests.push(request.clone());
    return respond(request);
  };
  vite = await createServer({
    root: rootDirectory,
    configFile: false,
    envDir: fileURLToPath(new URL("./fixtures/no-env/", import.meta.url)),
    define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("http://localhost:3000") },
    esbuild: { jsx: "automatic" },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
    logLevel: "error",
  });
  const [login, profile, edit, signup] = await Promise.all([
    vite.ssrLoadModule("/src/pages/auth/login-page.tsx"),
    vite.ssrLoadModule("/src/pages/member/profile-page.tsx"),
    vite.ssrLoadModule("/src/pages/member/edit-profile-page.tsx"),
    vite.ssrLoadModule("/src/pages/auth/signup-page.tsx"),
  ]);
  profileModule = await vite.ssrLoadModule("/src/store/profile-preview-store.ts");
  pages = [
    ["/login", login.LoginPage], ["/mypage", profile.ProfilePage],
    ["/mypage/edit", edit.EditProfilePage], ["/signup", signup.SignupPage],
  ];
});

beforeEach(() => {
  requests = [];
  respond = () => { throw new Error("Unexpected network request in offline DOM test"); };
  document.body.innerHTML = '<div id="test-root"></div>';
  profileModule.useProfilePreviewStore.setState({ profile: { ...profileModule.DEFAULT_PREVIEW_PROFILE } });
});

afterEach(async () => {
  if (reactRoot) await act(async () => { reactRoot.unmount(); });
  reactRoot = undefined;
});

after(async () => {
  await vite?.close();
  clientResolver?.deregister();
  dom?.window.close();
  globalThis.fetch = originalFetch;
  for (const [name, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
});

async function mount(pathname) {
  const { createRootRoute, createRoute, createRouter, createMemoryHistory, Outlet, RouterProvider } = routing;
  const rootRoute = createRootRoute({ component: Outlet });
  const router = createRouter({
    routeTree: rootRoute.addChildren(pages.map(([path, component]) => createRoute({
      getParentRoute: () => rootRoute, path, component,
    }))),
    history: createMemoryHistory({ initialEntries: [pathname] }),
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
  });
  await router.load();
  reactRoot = createRoot(document.querySelector("#test-root"));
  await act(async () => { reactRoot.render(createElement(RouterProvider, { router })); await nextTurn(); });
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

test("login reacts to typing, toggles password visibility and submits preview feedback without requests", async () => {
  await mount("/login");
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
  await click(button("로그인"));
  assert.match(document.querySelector('[role="status"]').textContent, /실제로 로그인되지 않아요/);
  assert.equal(requests.length, 0);
});

test("profile edit rejects invalid or unchanged input and saves a changed nickname into the view route", async () => {
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
  await click(button("저장하기"));
  assert.equal(router.state.location.pathname, "/mypage");
  assert.equal(document.querySelector("h1").textContent, "내 정보");
  assert.match(document.querySelector("dl").textContent, /새로운영화친구/);
  assert.match(document.querySelector("dl").textContent, /movie@example.com/);
  assert.equal(requests.length, 0);
});

test("cancel discards the edit draft and a later edit starts with the saved nickname", async () => {
  profileModule.useProfilePreviewStore.getState().updateNickname("기존회원");
  const router = await mount("/mypage/edit");
  assert.equal(field("닉네임").value, "기존회원");
  await type("닉네임", "취소할이름");
  const cancel = [...document.querySelectorAll("a")].find((node) => node.textContent === "취소");
  await click(cancel);
  assert.equal(router.state.location.pathname, "/mypage");
  assert.match(document.querySelector("dl").textContent, /기존회원/);
  assert.doesNotMatch(document.querySelector("dl").textContent, /취소할이름/);
  const edit = [...document.querySelectorAll("a")].find((node) => node.textContent === "내 정보 수정");
  await click(edit);
  assert.equal(router.state.location.pathname, "/mypage/edit");
  assert.equal(field("닉네임").value, "기존회원");
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

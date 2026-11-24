import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { createTestRouter, NextRouterProvider } from "./helpers/next-router.mjs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createSourceLoader } from "./helpers/source-loader.mjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

let server;
let form;
let profileModule;
let pages;
let auth;
let authRoute;
let memberQueries;
let queryClient;
const token = (sub = "17", exp = Math.floor(Date.now() / 1000) + 3600) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ sub, exp })).toString("base64url")}.signature`;
const member = { email: "movie@example.com", nickname: "영화산책", createdAt: "2026-11-17T00:00:00.000Z" };

before(async () => {
  server = await createSourceLoader({
  });
  form = await server.load("/src/lib/member-form.ts");
  profileModule = await server.load("/src/store/auth-store.ts");
  auth = await server.load("/src/lib/auth.ts");
  authRoute = await server.load("/src/components/auth/auth-guard.tsx");
  ({ memberQueries } = await server.load("/src/queries/member.ts"));
  const [login, profile, edit] = await Promise.all([
    server.load("/src/features/auth/login-page.tsx"),
    server.load("/src/features/member/profile-page.tsx"),
    server.load("/src/features/member/edit-profile-page.tsx"),
  ]);
  pages = [
    ["/login", login.LoginPage],
    ["/mypage", profile.ProfilePage],
    ["/mypage/edit", edit.EditProfilePage],
  ];
});

after(async () => server?.close());

beforeEach(() => {
  profileModule.useAuthStore.getState().clearSession();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
});

async function renderPath(pathname) {
  const component = pages.find(([path]) => path === pathname)?.[1];
  assert.ok(component, `Page ${pathname} exists`);
  const router = createTestRouter(pathname);
  return renderToStaticMarkup(createElement(QueryClientProvider, { client: queryClient },
    createElement(NextRouterProvider, { router }, createElement(component))));
}

function labeledInput(html, label, name) {
  const labelMatch = html.match(new RegExp(`<label[^>]*for="([^"]+)"[^>]*>${label}<\\/label>`));
  assert.ok(labelMatch, `A visible ${label} label must reference its input`);
  const input = [...html.matchAll(/<input\b[^>]*>/g)]
    .map(([tag]) => tag)
    .find((tag) => tag.includes(`name="${name}"`));
  assert.ok(input, `Input ${name} exists`);
  assert.equal(input.match(/\bid="([^"]+)"/)?.[1], labelMatch[1]);
  return input;
}

test("email validation trims the submitted value and rejects blank or malformed addresses", () => {
  assert.equal(form.isEmailValid("  movie@example.com  "), true);
  for (const value of ["", "   ", "movie", "movie@example", "movie @example.com", "movie@@example.com"]) {
    assert.equal(form.isEmailValid(value), false, value);
  }
  assert.equal(form.isEmailValid(`${"a".repeat(243)}@example.com`), false);
});

test("nickname boundaries count Unicode characters after trimming", () => {
  for (const value of ["가나", "  영화산책  ", "😀🎬", "가".repeat(12)]) {
    assert.equal(form.isNicknameValid(value), true, value);
  }
  for (const value of ["", "   ", "가", "😀", "가".repeat(13), "😀".repeat(13)]) {
    assert.equal(form.isNicknameValid(value), false, value);
  }
});

test("signup password requires every character group and rejects unsupported characters", () => {
  for (const special of "!@#$%^&*") {
    assert.equal(form.isSignupPasswordValid(`Movie1${special}a`), true, special);
  }
  for (const value of ["movie1!a", "MOVIE1!A", "MovieA!a", "Movie12a", "Aa1!abc", "Aa1!abcd ", "Aa1!abcd_", "Aa1!abcd가", "Aa1!abcd\n"]) {
    assert.equal(form.isSignupPasswordValid(value), false, value);
  }
});

test("signup password respects bcrypt's 72-byte maximum", () => {
  assert.equal(form.isSignupPasswordValid(`Aa1!${"a".repeat(68)}`), true);
  assert.equal(form.isSignupPasswordValid(`Aa1!${"a".repeat(69)}`), false);
  assert.equal(form.isSignupPasswordValid(`Aa1!${"😀".repeat(18)}`), false);
});

test("login accepts an existing nonempty password without imposing the signup policy", () => {
  assert.equal(form.canPreviewLogin(" movie@example.com ", "old"), true);
  assert.equal(form.isSignupPasswordValid("old"), false);
  assert.equal(form.canPreviewLogin("movie@example.com", ""), false);
  assert.equal(form.canPreviewLogin("invalid", "old"), false);
});

test("session derives memberId from JWT and rejects malformed or expired tokens", () => {
  const store = profileModule.useAuthStore;
  store.getState().setSession(token());
  assert.equal(store.getState().memberId, 17);
  assert.equal(profileModule.getSession().memberId, 17);
  for (const invalid of ["bad-token", token("0"), token("-1"), token("1e3"), token("9007199254740992"), token("17", 1)]) {
    assert.throws(() => store.getState().setSession(invalid), /다시 로그인/);
  }
  store.setState({ accessToken: token("17", 1), memberId: 17 });
  assert.equal(profileModule.getSession(), null);
  assert.equal(store.getState().memberId, null);
});

test("importing the auth store on the server never reads browser storage", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  let reads = 0;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() { reads += 1; throw new Error("Browser storage is unavailable on the server"); },
  });
  const isolated = await createSourceLoader();
  try {
    const store = (await isolated.load("/src/store/auth-store.ts")).useAuthStore;
    assert.equal(reads, 0);
    assert.equal(store.getInitialState().accessToken, null);
    assert.equal(store.getInitialState().hydrated, false);
  } finally {
    await isolated.close();
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete globalThis.localStorage;
  }
});

test("separate QueryClient instances never share member data across server requests", async () => {
  const { createQueryClient } = await server.load("/src/lib/query-client.ts");
  const first = createQueryClient();
  const second = createQueryClient();
  try {
    first.setQueryData(["member", 17, "me"], member);
    assert.equal(second.getQueryData(["member", 17, "me"]), undefined);
  } finally {
    first.clear();
    second.clear();
  }
});

test("login return URLs reject external destinations and login loops", () => {
  for (const invalid of ["https://evil.example", "//evil.example", "/\\evil.example", "/login", "/signup", "/\nevil.example"]) {
    assert.equal(auth.getSafeRedirect(invalid), "/mypage");
  }
  assert.equal(auth.getSafeRedirect("/movies/550?tab=rating#mine"), "/movies/550?tab=rating#mine");
});

test("the shared guard hides protected children during server rendering", () => {
  const router = createTestRouter("/mypage");
  const html = renderToStaticMarkup(createElement(NextRouterProvider, { router },
    createElement(authRoute.AuthGuard, null, createElement("p", null, "private member data"))));
  assert.doesNotMatch(html, /private member data/);
  assert.equal(router.location.pathname, "/mypage");
});

test("both member pages live under the shared Next route-group layout", () => {
  for (const route of ["mypage/page.tsx", "mypage/edit/page.tsx"]) {
    assert.ok(existsSync(new URL(`../src/app/(authenticated)/${route}`, import.meta.url)));
  }
  const layout = readFileSync(new URL("../src/app/(authenticated)/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /AuthGuard/);
  assert.match(layout, /children/);
  assert.ok(!existsSync(new URL("../src/pages", import.meta.url)), "Legacy pages folder must not register duplicate Next routes");
});

test("private cache cleanup removes member data while preserving public movie cache", () => {
  queryClient.setQueryData(["member", 17, "me"], member);
  queryClient.setQueryData(["favorites", 17, "list"], [{ movieId: 550 }]);
  queryClient.setQueryData(["ratings", 17], [{ score: 4 }]);
  queryClient.setQueryData(["movies", "detail", "550"], { id: 550 });
  auth.clearPrivateQueries(queryClient);
  assert.equal(queryClient.getQueryCache().getAll().length, 1);
  assert.deepEqual(queryClient.getQueryData(["movies", "detail", "550"]), { id: 550 });
});

test("direct login route renders labeled empty inputs, masked password and disabled submit", async () => {
  const html = await renderPath("/login");
  assert.match(html, /<h1[^>]*>로그인<\/h1>/);
  const email = labeledInput(html, "이메일", "email");
  const password = labeledInput(html, "비밀번호", "password");
  assert.match(email, /type="email"/);
  assert.match(email, /value=""/);
  assert.match(password, /type="password"/);
  assert.match(password, /value=""/);
  assert.match(html, /<button[^>]*type="submit"[^>]*disabled=""[^>]*>로그인<\/button>/);
  assert.doesNotMatch(html, /미리보기|실제 계정에 로그인하지 않습니다/);
  assert.match(html, /href="\/signup"/);
});

test("server rendering shows profile loading without leaking a browser member session", async () => {
  profileModule.useAuthStore.getState().setSession(token());
  queryClient.setQueryData(memberQueries.me(17).queryKey, member);
  queryClient.setQueryData(["favorites", 17, "list"], []);
  const html = await renderPath("/mypage");
  assert.match(html, /<h1[^>]*>내 정보<\/h1>/);
  assert.doesNotMatch(html, /예시 회원 정보입니다/);
  assert.match(html, /내 정보를 불러오고 있어요/);
  assert.doesNotMatch(html, /movie@example\.com|영화산책/);
  assert.match(html, /href="\/mypage\/edit"/);
  assert.doesNotMatch(html, /password|비밀번호|accessToken|refreshToken/i);
});

test("server rendering keeps the edit form hidden until the browser member query is ready", async () => {
  profileModule.useAuthStore.getState().setSession(token());
  queryClient.setQueryData(memberQueries.me(17).queryKey, member);
  const html = await renderPath("/mypage/edit");
  assert.match(html, /<h1[^>]*>내 정보 수정<\/h1>/);
  assert.match(html, /내 정보를 불러오고 있어요/);
  assert.doesNotMatch(html, /name="email"|name="nickname"|movie@example\.com|영화산책/);
  assert.doesNotMatch(html, /실제 계정에는 반영되지 않습니다/);
  assert.doesNotMatch(html, /type="password"|name="password"/);
});

import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { createServer } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
let server;
let form;
let profileModule;
let pages;

before(async () => {
  server = await createServer({
    root,
    configFile: false,
    envDir: fileURLToPath(new URL("./fixtures/no-env/", import.meta.url)),
    esbuild: { jsx: "automatic" },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
    logLevel: "error",
  });
  form = await server.ssrLoadModule("/src/lib/member-form.ts");
  profileModule = await server.ssrLoadModule("/src/store/profile-preview-store.ts");
  const [login, profile, edit] = await Promise.all([
    server.ssrLoadModule("/src/pages/auth/login-page.tsx"),
    server.ssrLoadModule("/src/pages/member/profile-page.tsx"),
    server.ssrLoadModule("/src/pages/member/edit-profile-page.tsx"),
  ]);
  pages = [
    ["/login", login.LoginPage],
    ["/mypage", profile.ProfilePage],
    ["/mypage/edit", edit.EditProfilePage],
  ];
});

after(async () => server?.close());

beforeEach(() => {
  if (profileModule) {
    profileModule.useProfilePreviewStore.setState({
      profile: { ...profileModule.DEFAULT_PREVIEW_PROFILE },
    });
  }
});

async function renderPath(pathname) {
  const rootRoute = createRootRoute({ component: Outlet });
  const routes = pages.map(([path, component]) => createRoute({
    getParentRoute: () => rootRoute,
    path,
    component,
  }));
  const router = createRouter({
    routeTree: rootRoute.addChildren(routes),
    history: createMemoryHistory({ initialEntries: [pathname] }),
  });
  await router.load();
  assert.equal(router.state.location.pathname, pathname);
  assert.equal(router.state.matches.at(-1)?.status, "success");
  return renderToStaticMarkup(createElement(RouterProvider, { router }));
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

test("saving a preview nickname trims it and preserves the existing email", () => {
  const { useProfilePreviewStore: store } = profileModule;
  const original = store.getState().profile;
  assert.equal(store.getState().updateNickname("  영화친구  "), true);
  assert.deepEqual(store.getState().profile, {
    email: original.email,
    nickname: "영화친구",
  });
  assert.deepEqual(original, profileModule.DEFAULT_PREVIEW_PROFILE);
  assert.deepEqual(Object.keys(store.getState().profile).sort(), ["email", "nickname"]);
});

test("invalid preview edits leave the current profile unchanged", () => {
  const { useProfilePreviewStore: store } = profileModule;
  store.getState().updateNickname("저장된이름");
  const saved = store.getState().profile;
  for (const value of ["", " ", "가", "가".repeat(13)]) {
    assert.equal(store.getState().updateNickname(value), false, value);
    assert.equal(store.getState().profile, saved);
  }
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
  assert.match(html, /실제 계정에 로그인하지 않습니다/);
  assert.match(html, /href="\/signup"/);
});

test("direct profile route renders the example member and edit link without password data", async () => {
  const html = await renderPath("/mypage");
  assert.match(html, /<h1[^>]*>내 정보<\/h1>/);
  assert.match(html, /예시 회원 정보입니다/);
  assert.match(html, /movie@example\.com/);
  assert.match(html, /영화산책/);
  assert.match(html, /href="\/mypage\/edit"/);
  assert.doesNotMatch(html, /password|비밀번호|accessToken|refreshToken/i);
});

test("direct edit route initializes existing values, readonly email and disabled unchanged save", async () => {
  const html = await renderPath("/mypage/edit");
  assert.match(html, /<h1[^>]*>내 정보 수정<\/h1>/);
  const email = labeledInput(html, "이메일", "email");
  const nickname = labeledInput(html, "닉네임", "nickname");
  assert.match(email, /readOnly=""/);
  assert.match(email, /value="movie@example\.com"/);
  assert.match(nickname, /value="영화산책"/);
  assert.match(html, /<button[^>]*type="submit"[^>]*disabled=""[^>]*>저장하기<\/button>/);
  assert.match(html, /href="\/mypage"[^>]*>취소<\/a>/);
  assert.match(html, /실제 계정에는 반영되지 않습니다/);
  assert.doesNotMatch(html, /type="password"|name="password"/);
});

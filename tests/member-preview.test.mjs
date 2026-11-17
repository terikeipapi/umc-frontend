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
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const root = fileURLToPath(new URL("../", import.meta.url));
let server;
let form;
let profileModule;
let pages;
let auth;
let authRoute;
let memberQueries;
let queryClient;
let generatedTree;
const token = (sub = "17", exp = Math.floor(Date.now() / 1000) + 3600) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ sub, exp })).toString("base64url")}.signature`;
const member = { email: "movie@example.com", nickname: "영화산책", createdAt: "2026-11-17T00:00:00.000Z" };

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
  profileModule = await server.ssrLoadModule("/src/store/auth-store.ts");
  auth = await server.ssrLoadModule("/src/lib/auth.ts");
  authRoute = await server.ssrLoadModule("/src/routes/(authenticated)/_auth.tsx");
  ({ memberQueries } = await server.ssrLoadModule("/src/queries/member.ts"));
  ({ routeTree: generatedTree } = await server.ssrLoadModule("/src/routeTree.gen.ts"));
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
  profileModule.useAuthStore.getState().clearSession();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
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
  return renderToStaticMarkup(createElement(QueryClientProvider, { client: queryClient }, createElement(RouterProvider, { router })));
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

test("login return URLs reject external destinations and login loops", () => {
  for (const invalid of ["https://evil.example", "//evil.example", "/\\evil.example", "/login", "/signup", "/\nevil.example"]) {
    assert.equal(auth.getSafeRedirect(invalid), "/mypage");
  }
  assert.equal(auth.getSafeRedirect("/movies/550?tab=rating#mine"), "/movies/550?tab=rating#mine");
});

test("the shared layout guard redirects both protected page destinations before loading", () => {
  for (const path of ["/mypage", "/mypage/edit"]) {
    assert.throws(() => authRoute.Route.options.beforeLoad({ location: { href: path } }), (error) => {
      assert.equal(error.options.to, "/login");
      assert.equal(error.options.search.redirect, path);
      return true;
    });
  }
});

test("the generated tree places both member URLs under the shared pathless authenticated layout", () => {
  const router = createRouter({ routeTree: generatedTree, history: createMemoryHistory({ initialEntries: ["/"] }) });
  for (const path of ["/mypage", "/mypage/edit"]) {
    const matches = router.matchRoutes(path);
    assert.ok(matches.some((match) => match.routeId === "/(authenticated)/_auth"));
    assert.equal(matches.at(-1).pathname.replace(/\/$/, ""), path);
    assert.ok(matches.every((match) => !match.pathname.includes("authenticated") && !match.pathname.includes("_auth")));
  }
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

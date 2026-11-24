import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Run after `pnpm build && pnpm start` and the local NestJS/MySQL server.
// Isolated tooling: npm install --prefix .tmp/browser-tools --no-save playwright
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const browserRequire = createRequire(resolve(root, ".tmp/browser-tools/package.json"));
const { chromium } = browserRequire("playwright");
const baseURL = process.env.UMCINE_BROWSER_URL || "http://localhost:5173";
const apiURL = process.env.UMCINE_API_URL || "http://localhost:3000";
for (const address of [baseURL, apiURL]) {
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(address).hostname), "Use local development servers only");
}
const output = resolve(root, "docs/week9");
const screenshots = resolve(output, "screenshots");
await mkdir(screenshots, { recursive: true });
const runId = randomBytes(5).toString("hex");
const account = { email: `next-mission-${runId}@example.com`, nickname: `넥스트${runId.slice(0, 5)}`, password: `Next!${randomBytes(12).toString("hex")}8A` };
let createdMemberId;
let browser;
let page;
const checks = [];
const network = [];
const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];
const cleanup = { members: 0, favorites: 0, ratings: 0 };
let failure;

function record(name, details = {}) {
  checks.push({ name, passed: true, ...details });
  console.log(`PASS ${name}`);
}
async function until(predicate, message, timeout = 30_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await predicate()) return;
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error(message);
}
async function capture(name, mask = []) {
  await page.evaluate(async () => {
    await Promise.all([...document.querySelectorAll("main img")].map((image) => image.complete ? undefined : new Promise((done) => {
      image.addEventListener("load", done, { once: true });
      image.addEventListener("error", done, { once: true });
      setTimeout(done, 8000);
    })));
    await document.fonts.ready;
  });
  await page.screenshot({ path: resolve(screenshots, name), fullPage: name !== "02-search-1917.png", animations: "disabled", mask, maskColor: "#e5e7eb" });
}
async function api(path, method = "GET", body) {
  const result = await page.evaluate(async ({ apiURL, path, method, body }) => {
    const token = localStorage.getItem("umcine-access-token");
    const response = await fetch(`${apiURL}${path}`, {
      method,
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { "content-type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  }, { apiURL, path, method, body });
  assert.ok(result.status < 400, `${method} ${path} should succeed`);
  return result.body.result;
}
const popularRequests = () => network.filter((item) => item.host === "api.themoviedb.org" && item.path === "/3/movie/popular" && item.page === "1").length;

try {
  assert.equal((await fetch(baseURL)).status, 200, "Next production server is running");
  assert.equal((await fetch(apiURL)).status, 200, "Local backend is running");
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "ko-KR", timezoneId: "Asia/Seoul", deviceScaleFactor: 1 });
  page = await context.newPage();
  page.setDefaultTimeout(30_000);
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const reason = request.failure()?.errorText || "unknown";
    if (reason.includes("ERR_ABORTED")) return;
    const url = new URL(request.url());
    failedRequests.push({ host: url.host, path: url.pathname, reason });
  });
  page.on("response", (response) => {
    const request = response.request();
    if (!["xhr", "fetch", "document"].includes(request.resourceType())) return;
    const url = new URL(response.url());
    network.push({ method: request.method(), host: url.host, path: url.pathname, page: url.searchParams.get("page"), status: response.status() });
  });

  await page.goto(baseURL, { waitUntil: "networkidle" });
  await page.locator("main article").first().waitFor();
  assert.ok(await page.locator("main article").count() > 0);
  await capture("01-popular-movies.png");
  record("실제 TMDB 인기 영화 렌더링");
  const firstPageRequests = popularRequests();
  await page.getByRole("button", { name: "2페이지", exact: true }).click();
  await page.waitForURL(/page=2/);
  await until(async () => (await page.locator('[aria-label="2페이지"]').getAttribute("aria-current")) === "page", "Popular page 2 did not load");
  await page.getByRole("button", { name: "1페이지", exact: true }).click();
  await page.waitForURL(baseURL + "/");
  assert.equal(popularRequests(), firstPageRequests, "Fresh popular page should use Query cache");
  record("URL 페이지 이동 및 1페이지 TanStack Query 캐시 재사용");

  await page.getByRole("link", { name: "검색", exact: true }).click();
  await page.getByRole("searchbox", { name: "검색어" }).fill("1917");
  await page.getByRole("button", { name: "검색", exact: true }).click();
  await page.waitForURL(/query=1917/);
  await page.locator('section[aria-label="영화 검색 결과"] li').first().waitFor();
  await capture("02-search-1917.png");
  const detailHref = await page.locator('section[aria-label="영화 검색 결과"] li h3 a').first().getAttribute("href");
  assert.match(detailHref, /^\/movies\/\d+$/);
  record("숫자 제목 1917 검색 및 URL 검색어 보존");

  await page.locator('section[aria-label="영화 검색 결과"] li h3 a').first().click();
  await page.getByRole("heading", { name: "나의 평점" }).waitFor();
  await capture("03-movie-detail.png");
  record("영화 상세 직접 데이터 조회 및 비로그인 평점 안내");
  const movieId = Number(detailHref.split("/").at(-1));
  await page.getByRole("link", { name: "← 영화 목록" }).click();
  await page.locator("main article").first().waitFor();
  assert.equal(popularRequests(), firstPageRequests);
  record("영화 상세에서 목록 복귀 시 캐시 유지");

  await page.goto(`${baseURL}/mypage/edit?proof=next#form`);
  await page.waitForURL(/\/login\?redirect=/);
  assert.equal(new URL(page.url()).searchParams.get("redirect"), "/mypage/edit?proof=next#form");
  await page.getByRole("heading", { name: "로그인", exact: true }).waitFor();
  await capture("04-protected-route-login.png");
  record("비로그인 보호 경로 차단 및 복귀 URL 보존");

  await page.goto(`${baseURL}/signup`);
  await page.getByLabel("이메일", { exact: true }).fill(account.email);
  await page.getByRole("button", { name: "이메일 중복 확인" }).click();
  await page.getByText("사용 가능한 이메일이에요.", { exact: true }).waitFor();
  await page.getByLabel("닉네임", { exact: true }).fill(account.nickname);
  await page.getByRole("button", { name: "닉네임 중복 확인" }).click();
  await page.getByText("사용 가능한 닉네임이에요.", { exact: true }).waitFor();
  await page.getByLabel("비밀번호", { exact: true }).fill(account.password);
  await page.getByLabel("비밀번호 확인", { exact: true }).fill(account.password);
  const signupResponse = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/members");
  await page.getByRole("button", { name: "가입하기", exact: true }).click();
  const signup = await signupResponse;
  assert.equal(signup.status(), 201);
  createdMemberId = (await signup.json()).result.memberId;
  await page.getByRole("link", { name: "로그인하러 가기" }).waitFor();
  record("실제 회원가입 및 이메일·닉네임 중복 확인");

  await page.goto(`${baseURL}/login?${new URLSearchParams({ redirect: "/mypage/edit" })}`);
  await page.getByLabel("이메일", { exact: true }).fill(account.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page.waitForURL(`${baseURL}/mypage/edit`);
  await page.getByLabel("닉네임", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("닉네임", { exact: true }).inputValue(), account.nickname);
  await capture("05-profile-edit.png", [page.getByLabel("이메일", { exact: true })]);
  record("실제 로그인 성공 후 원래 보호 경로 복귀");
  await page.getByLabel("닉네임", { exact: true }).fill("취소할닉네임");
  await page.getByRole("link", { name: "취소", exact: true }).click();
  await page.waitForURL(`${baseURL}/mypage`);
  await page.locator("dl").getByText(account.nickname, { exact: true }).waitFor();
  assert.equal(await page.locator("dl").getByText("취소할닉네임", { exact: true }).count(), 0);
  await page.getByRole("link", { name: "내 정보 수정", exact: true }).click();
  await page.waitForURL(`${baseURL}/mypage/edit`);
  await page.getByLabel("닉네임", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("닉네임", { exact: true }).inputValue(), account.nickname, "Cancelled profile draft should not survive a new edit navigation");
  record("회원정보 수정 취소 후 재진입 시 서버 저장값 복원");
  const updatedNickname = `영화친구${runId.slice(0, 4)}`;
  await page.getByLabel("닉네임", { exact: true }).fill(updatedNickname);
  await page.getByRole("button", { name: "저장하기", exact: true }).click();
  await page.waitForURL(`${baseURL}/mypage`);
  await page.locator("dl").getByText(updatedNickname, { exact: true }).waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("dl").getByText(updatedNickname, { exact: true }).waitFor();
  record("회원정보 수정 및 보호 페이지 새로고침 후 세션·수정값 유지");

  await page.goto(`${baseURL}${detailHref}`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "나의 평점" }).waitFor();
  const bookmark = page.locator("main button[aria-pressed]");
  await until(async () => await bookmark.isEnabled(), "Favorite status did not load");
  assert.equal(await bookmark.getAttribute("aria-pressed"), "false");
  await bookmark.click();
  await until(async () => (await bookmark.getAttribute("aria-pressed")) === "true", "Favorite create failed");
  assert.equal((await api(`/favorites/${movieId}`)).isFavorite, true);
  await page.getByLabel("5점", { exact: true }).check();
  await page.getByLabel("후기 (선택)", { exact: true }).fill("Next.js로 옮긴 UMCine에서도 영화 후기를 남길 수 있어요.");
  await page.getByRole("button", { name: "평점 등록", exact: true }).click();
  await page.getByText("평점을 등록했어요.", { exact: true }).waitFor();
  await page.getByLabel("4점", { exact: true }).check();
  await page.getByLabel("후기 (선택)", { exact: true }).fill("검색부터 찜과 평점 수정까지 기존 기능을 확인했어요.");
  await page.getByRole("button", { name: "평점 수정", exact: true }).click();
  await page.getByText("평점을 수정했어요.", { exact: true }).waitFor();
  const ratings = await api(`/members/${createdMemberId}/ratings`);
  assert.equal(ratings.find((rating) => rating.movieId === movieId)?.score, 4);
  await capture("06-favorite-rating.png");
  record("찜 생성 및 평점·후기 등록/수정 실제 API 연동");

  await page.getByRole("link", { name: "마이페이지", exact: true }).click();
  await page.locator('section[aria-labelledby="favorites-heading"] article').first().waitFor();
  await capture("07-profile-favorites.png", [page.locator(".profile-details > div").first().locator("dd")]);
  record("마이페이지에 서버 찜 목록 렌더링");
  await page.goto(`${baseURL}${detailHref}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "평점 삭제", exact: true }).click();
  await page.getByText("평점을 삭제했어요.", { exact: true }).waitFor();
  assert.equal((await api(`/members/${createdMemberId}/ratings`)).length, 0);
  await until(async () => await bookmark.isEnabled(), "Favorite button not ready");
  await bookmark.click();
  await until(async () => (await bookmark.getAttribute("aria-pressed")) === "false", "Favorite delete failed");
  assert.equal((await api("/favorites")).length, 0);
  record("평점 삭제 및 찜 해제 실제 API 연동");

  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await page.waitForURL(`${baseURL}/login`);
  await page.goto(`${baseURL}/mypage`);
  await page.waitForURL(/\/login\?redirect=/);
  assert.equal(await page.evaluate(() => localStorage.getItem("umcine-access-token")), null);
  record("로그아웃 후 토큰 제거 및 보호 경로 재차단");
  await page.goto(`${baseURL}/movies/abc`, { waitUntil: "networkidle" });
  await page.getByText("영화를 찾을 수 없어요.", { exact: true }).waitFor();
  await capture("08-invalid-movie.png");
  record("잘못된 영화 ID 오류 화면");
  assert.equal(pageErrors.length, 0, "No browser runtime or hydration errors");
  assert.equal(consoleErrors.length, 0, "No browser console errors");
  assert.equal(failedRequests.length, 0, "No failed browser requests");
  assert.ok(network.filter((item) => ["localhost:3000", "api.themoviedb.org"].includes(item.host)).every((item) => item.status < 400), "Real API requests succeeded");
  record("브라우저 hydration/runtime/console 오류 및 실패 요청 0건");
} catch (error) {
  failure = error;
  console.error(`FAIL ${error.message}`);
} finally {
  await browser?.close();
  // Delete only the unique account generated by this run, checking both ID/email.
  if (createdMemberId) {
    try {
      process.loadEnvFile(resolve(root, "../study/.env"));
      const backendRequire = createRequire(resolve(root, "../study/package.json"));
      const { createConnection } = backendRequire("mysql2/promise");
      assert.ok(["localhost", "127.0.0.1", "::1"].includes(process.env.DB_HOST || "localhost"));
      const connection = await createConnection({ host: process.env.DB_HOST || "localhost", port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER || "root", password: process.env.DB_PASSWORD || "", database: process.env.DB_NAME });
      try {
        await connection.beginTransaction();
        const [rows] = await connection.execute("SELECT member_id FROM member WHERE member_id = ? AND email = ? FOR UPDATE", [createdMemberId, account.email]);
        assert.equal(rows.length, 1, "Cleanup identity must match");
        for (const table of ["favorite", "rating"]) {
          const [deleted] = await connection.execute(`DELETE FROM ${table} WHERE member_id = ?`, [createdMemberId]);
          cleanup[table === "favorite" ? "favorites" : "ratings"] += deleted.affectedRows;
        }
        const [deleted] = await connection.execute("DELETE FROM member WHERE member_id = ? AND email = ?", [createdMemberId, account.email]);
        assert.equal(deleted.affectedRows, 1);
        cleanup.members = deleted.affectedRows;
        await connection.commit();
      } catch (error) { await connection.rollback(); throw error; }
      finally { await connection.end(); }
    } catch (error) { failure ||= error; console.error(`Cleanup failed: ${error.message}`); }
  }
  const report = {
    executedAt: new Date().toISOString(), timezone: "Asia/Seoul", mode: "Next.js production server; actual TMDB API and local NestJS/MySQL; no HTTP fixtures", baseURL,
    success: !failure, checks, screenshots: ["01-popular-movies.png", "02-search-1917.png", "03-movie-detail.png", "04-protected-route-login.png", "05-profile-edit.png", "06-favorite-rating.png", "07-profile-favorites.png", "08-invalid-movie.png"],
    consoleErrors, pageErrors, failedRequests, network, cleanup,
    ...(failure ? { failure: failure.message } : {}),
  };
  // Passwords and tokens are neither logged nor persisted. Mask test email fields in screenshots.
  await writeFile(resolve(output, "browser-verification.json"), JSON.stringify(report, null, 2) + "\n");
}
if (failure) process.exitCode = 1;

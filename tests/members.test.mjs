import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const originalFetch = globalThis.fetch;
const apiBase = "https://members.example.test/api/";
let server;
let members;
let registration;
let requests = [];
let respond;

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json" },
});
const success = (result, message = "요청에 성공했습니다.") => ({
  isSuccess: true,
  code: "COMMON200",
  message,
  result,
});
const failure = (code, message) => ({ isSuccess: false, code, message, result: null });
const signupInput = { email: "  movie+crew@example.com  ", nickname: "  영화친구  ", password: "Umc!1234" };

before(async () => {
  // Install before importing the real API modules: ky captures global fetch.
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    requests.push(request);
    return respond(request);
  };
  server = await createServer({
    root,
    configFile: false,
    envDir: fileURLToPath(new URL("./fixtures/no-env/", import.meta.url)),
    define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify(`  ${apiBase}  `) },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
    logLevel: "error",
  });
  members = await server.ssrLoadModule("/src/api/members/check-duplicate.ts");
  registration = await server.ssrLoadModule("/src/api/members/signup.ts");
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
  respond = () => jsonResponse(success({ exists: false }));
});

function assertMemberRequest(request, relativePath, method = "GET") {
  const url = new URL(request.url);
  assert.equal(url.href, apiBase + relativePath);
  assert.equal(request.method, method);
  assert.equal(request.headers.get("accept"), "application/json");
  assert.equal(request.headers.has("authorization"), false);
  assert.equal(url.search, "");
  assert.equal(url.hash, "");
}

for (const [name, method, value, property] of [
  ["email", "checkEmailAvailable", "movie+crew@example.com", "email"],
  ["nickname", "checkNicknameAvailable", "영화+친구&#", "nickname"],
]) {
  for (const exists of [false, true]) {
    test(`${name} duplicate checks map the real exists=${exists} response to available=${!exists}`, async () => {
      respond = () => jsonResponse(success({ [property]: value, exists }));
      assert.equal(await members[method](`  ${value}  `), !exists);
      assert.equal(requests.length, 1);
      assertMemberRequest(requests[0], `members/${property}/${encodeURIComponent(value)}`);
    });
  }
}

test("signup posts exactly the public request fields and preserves the password unchanged", async () => {
  const member = { memberId: 17, email: "movie+crew@example.com", nickname: "영화친구" };
  const envelope = { ...success(member, "회원가입에 성공했습니다."), code: "COMMON201" };
  respond = () => jsonResponse(envelope, 201);

  const result = await registration.signup({ ...signupInput, password: " Umc!1234 ", passwordConfirm: "ignored", memberId: 99 });

  assert.deepEqual(result, envelope);
  assert.equal(requests.length, 1);
  assertMemberRequest(requests[0], "members", "POST");
  assert.equal(requests[0].headers.get("content-type"), "application/json");
  assert.deepEqual(await requests[0].json(), {
    email: "movie+crew@example.com",
    nickname: "영화친구",
    password: " Umc!1234 ",
  });
});

test("a 200 application failure rejects with the server message and code", async () => {
  respond = () => jsonResponse(failure("MEMBER4001", "입력값을 다시 확인해 주세요."));
  await assert.rejects(members.checkEmailAvailable("movie@example.com"), (error) => {
    assert.equal(error.name, "ApiError");
    assert.equal(error.message, "입력값을 다시 확인해 주세요.");
    assert.equal(error.code, "MEMBER4001");
    assert.equal(error.status, 200);
    return true;
  });
  assert.equal(requests.length, 1);
});

test("a duplicate signup HTTP 409 exposes the usable error without retrying creation", async () => {
  respond = () => jsonResponse(failure("MEMBER4091", "이미 사용 중인 이메일입니다."), 409);
  await assert.rejects(registration.signup(signupInput), (error) => {
    assert.equal(error.name, "ApiError");
    assert.equal(error.message, "이미 사용 중인 이메일입니다.");
    assert.equal(error.code, "MEMBER4091");
    assert.equal(error.status, 409);
    return true;
  });
  assert.equal(requests.length, 1);
  assertMemberRequest(requests[0], "members", "POST");
});

test("a duplicate-check HTTP 503 is not automatically retried", async () => {
  respond = () => jsonResponse(failure("COMMON503", "점검 중입니다. 잠시 후 다시 시도해 주세요."), 503);
  await assert.rejects(members.checkNicknameAvailable("영화친구"), (error) => {
    assert.equal(error.status, 503);
    assert.equal(error.code, "COMMON503");
    assert.equal(error.message, "점검 중입니다. 잠시 후 다시 시도해 주세요.");
    return true;
  });
  assert.equal(requests.length, 1);
});

test("a signup HTTP 503 never triggers an automatic second create request", async () => {
  respond = () => jsonResponse(failure("COMMON503", "회원가입 서버가 점검 중입니다."), 503);
  await assert.rejects(registration.signup(signupInput), (error) => {
    assert.equal(error.status, 503);
    assert.equal(error.message, "회원가입 서버가 점검 중입니다.");
    return true;
  });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, "POST");
});

test("a non-JSON HTTP failure gives safe feedback rather than leaking server text", async () => {
  respond = () => new Response("private database debug output", { status: 503 });
  await assert.rejects(members.checkEmailAvailable("movie@example.com"), (error) => {
    assert.equal(error.name, "ApiError");
    assert.equal(error.status, 503);
    assert.match(error.message, /요청을 처리하지 못했어요/);
    assert.doesNotMatch(error.message, /private database/);
    return true;
  });
  assert.equal(requests.length, 1);
});

test("a malformed success envelope is rejected instead of reporting successful registration", async () => {
  respond = () => jsonResponse({ memberId: 17 });
  await assert.rejects(registration.signup(signupInput), /서버 응답을 확인하지 못했어요/);
  assert.equal(requests.length, 1);
});

test("a network failure gives connection feedback and does not retry signup", async () => {
  respond = () => { throw new TypeError("offline"); };
  await assert.rejects(registration.signup(signupInput), /서버에 연결하지 못했어요/);
  assert.equal(requests.length, 1);
});

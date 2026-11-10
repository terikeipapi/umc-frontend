# 7주차 필수 미션 기록

참고 자료: 「7주차 - 인증 개념 이해와 회원가입 구현하기」 PDF 26~27쪽. 기록 날짜는 2026년 11월 10일(한국 시간)이다. 구현과 자동 검증은 완료했으며, Figma 원본 대조와 실제 브라우저 시각 검수는 아래 제한으로 남아 있다.

## 필수 미션

로그인, 내 정보 조회, 내 정보 수정 화면을 만들고 각 페이지에 직접 접속해 화면 표시와 입력값 반영을 확인한다. 작업 대상은 React 프런트엔드 프로젝트 `umcine`이다.

PDF 3쪽은 로그인·내 정보 API 연동을 8주차 범위로 구분한다. 이번 기록은 화면 퍼블리싱과 폼 동작을 대상으로 하며, 실제 로그인 성공이나 서버 회원정보 변경을 수행했다는 의미가 아니다.

### 화면과 동작

| 주소 | 구현한 내용 | 자동 검증 |
| --- | --- | --- |
| `/login` | 이메일·비밀번호 입력, 이메일 검증, 비밀번호 보기·숨기기, 제출 안내, 회원가입 이동 | SSR·DOM 이벤트 테스트 통과 |
| `/mypage` | 예시 이메일·닉네임 조회, 정보 수정 이동 | SSR·수정 후 DOM 표시 확인 통과 |
| `/mypage/edit` | 기존 값 표시, 닉네임 검증, 저장 후 조회 화면 반영, 취소 시 변경 폐기 | SSR·저장·취소 DOM 테스트 통과 |
| `/signup` | 본문 실습의 회원가입 폼, 이메일·닉네임 중복 확인, 가입 요청 상태 | 모의 API·DOM 이벤트 테스트 통과 |

### 핵심 코드

#### 1. 페이지 연결과 로그인 입력

[로그인 경로](../../src/routes/login.tsx), [조회 경로](../../src/routes/mypage.index.tsx), [수정 경로](../../src/routes/mypage.edit.tsx)를 TanStack Router에 연결했다. 헤더에서도 각 페이지로 이동할 수 있다. 접근 제한이나 인증 레이아웃은 추가하지 않았다.

[로그인 화면](../../src/pages/auth/login-page.tsx)은 `useState`와 `value/onChange`로 입력을 관리한다. 이메일이 잘못되거나 비밀번호가 비어 있으면 제출을 막는다. 기존 계정의 비밀번호가 가입 정책과 다를 수 있으므로 로그인에 회원가입 정규식을 다시 적용하지 않는다.

```tsx
<MemberField
  label="이메일"
  name="email"
  type="email"
  value={email}
  onChange={(event) => { setEmail(event.target.value); setFeedback(""); }}
/>
<button type="submit" disabled={!canPreviewLogin(email, password)}>로그인</button>
```

제출은 새로고침을 막고 화면 미리보기 안내를 표시한다. 실제 로그인 요청·JWT 발급·토큰 저장은 수행하지 않는다. 비밀번호는 기본적으로 가려지고 보기·숨기기를 선택할 수 있다.

#### 2. 내 정보 조회와 수정

[조회 화면](../../src/pages/member/profile-page.tsx)은 [예시 프로필 저장소](../../src/store/profile-preview-store.ts)의 이메일과 닉네임을 표시한다. [수정 화면](../../src/pages/member/edit-profile-page.tsx)은 입력 중의 닉네임을 별도 상태로 관리한다.

```tsx
const [nickname, setNickname] = useState(profile.nickname);
const valid = isNicknameValid(nickname);
const dirty = nickname.trim() !== profile.nickname;

function handleSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setTouched(true);
  if (!valid || !dirty || !updateNickname(nickname)) return;
  void navigate({ to: "/mypage" });
}
```

이메일은 읽기 전용이고 닉네임은 앞뒤 공백을 제거한 2~12자를 허용한다. 저장하면 조회 화면에 변경값을 표시하고 취소하면 입력 중의 값만 버린다. 예시 정보는 메모리에만 있어 새로고침하면 초기화된다. 비밀번호나 실제 회원 계정을 저장하지 않는다.

#### 3. 회원가입 본문 실습

[회원가입 화면](../../src/pages/auth/signup-page.tsx), [공통 검증](../../src/lib/member-form.ts), [회원 API 클라이언트](../../src/api/api-client.ts), [중복 확인](../../src/api/members/check-duplicate.ts), [가입 요청](../../src/api/members/signup.ts)을 분리했다.

```ts
const payload: SignupRequest = {
  email: input.email.trim(),
  nickname: input.nickname.trim(),
  password: input.password,
};
return readApiResponse<SignupMember>(apiClient.post("members", { json: payload }));
```

- 이메일 형식, 닉네임 길이, 비밀번호 대문자·소문자·숫자·허용 특수문자와 8~72자, 비밀번호 확인을 검사한다. 비밀번호는 공백 제거 없이 전달하며 확인값은 요청에서 제외한다.
- 입력 조건과 두 중복 확인을 모두 통과해야 가입 버튼이 활성화된다. 이메일·닉네임을 수정하면 해당 확인 결과를 초기화한다.
- 중복 확인 중에는 해당 입력·버튼을 잠그고 가입 중에는 폼을 잠근다. 동기 잠금으로 연속 제출도 한 요청으로 제한한다.
- 실패하면 입력을 유지해 재시도할 수 있다. 성공하면 서버 메시지와 로그인 링크를 표시하고 비밀번호 입력을 제거한다.
- 워크북 예제의 `available`과 현재 백엔드의 `result.exists`는 의미가 반대이므로 `exists === false`를 사용 가능으로 변환했다.
- 설치된 ky v1에 맞춰 `prefixUrl`을 사용한다. 회원 요청에는 TMDB 인증을 넣지 않으며 자동 재시도는 끈다.

### 최종 확인 결과

Node.js 24.21.0에서 다음 명령을 실행했다. 테스트의 회원·TMDB 응답은 모의 데이터이며 실제 서버 가입 성공을 증명하지 않는다.

| 명령 | 결과 |
| --- | --- |
| `npm.cmd run type-check` | 통과 |
| `npm.cmd test` | 46개 통과, 실패 0개 |
| `npm.cmd run build` | 통과, `dist/` 생성 |
| `git diff --check` | 통과 |

검증 코드: [DOM 동작 5개](../../tests/auth-interactions.test.mjs), [검증·저장소·SSR 10개](../../tests/member-preview.test.mjs), [회원 API 12개](../../tests/members.test.mjs), 기존 영화 API·쿼리 회귀 19개.

- [x] 각 필수 화면을 메모리 라우터로 직접 렌더링
- [x] 로그인 입력값 반영, 비밀번호 보기·숨기기, 검증·제출 안내
- [x] 유효하지 않거나 바뀌지 않은 닉네임의 저장 차단
- [x] 저장 후 조회 화면 반영, 취소 후 기존 값 유지, 수정 재진입
- [x] 회원가입 중복 확인 중 입력·버튼 잠금, 실패 후 재시도, 수정 후 초기화
- [x] 두 중복 확인 후에만 가입 활성화, 연속 제출 1회 처리, 성공 안내
- [x] 가입 요청의 공백 처리·확인 비밀번호 제외, 409·503·네트워크 오류 처리
- [x] 타입 검사, 기존 영화 기능 회귀 테스트, 프로덕션 빌드
- [ ] 실제 브라우저에서 주소 직접 입력·새로고침·시각 검수
- [ ] Figma 원본과 크기·간격·색상 일치 확인

DOM 테스트는 jsdom에서 실제 컴포넌트의 입력·클릭·제출 이벤트를 실행했다. 이는 실제 Chrome 캡처나 시각 검수를 대신하지 않는다.

## 디자인 확인 범위

[워크북 Figma 디자인](https://www.figma.com/design/erFuXxEy5svB8Be5gjIqdu?node-id=42-2731)의 연결을 시도했으나 다음 오류로 디자인 컨텍스트를 읽을 수 없었다.

```text
Looks like you don't have edit access to this file. The file owner can share it with you and make you an editor.
```

따라서 기존 UMCine의 흰 배경, 검정 텍스트, 입력창·버튼 스타일과 기존 아이콘을 사용했다. 계정 화면에는 좁은 화면 대응 스타일을 추가했고, 기존 영화 화면의 최소 너비는 유지했다. Figma와의 정확한 시각 일치 여부는 확인되지 않았다.

브라우저 도구는 다음 사유로 작업을 중단했다. 이후 브라우저 입력이나 캡처를 수행하지 않았다.

```text
Computer Use has been stopped for this turn because it could not determine the current browser URL on Windows with enough confidence to enforce policy.
```

### 남은 수동 확인 순서

1. `C:\umc\umcine`에서 `pnpm dev`를 실행한다.
2. `/login`, `/mypage`, `/mypage/edit`, `/signup`을 주소창에서 직접 열고 새로고침한다.
3. 로그인 입력·비밀번호 가림, 닉네임 변경 저장·취소, 좁은 화면과 키보드 초점을 확인한다.
4. 실제 가입 확인이 필요하면 `.env.local`의 `VITE_API_BASE_URL`에 맞는 `study` 서버를 실행하고 본문 회원가입 흐름을 확인한다. 기본 주소는 `http://localhost:3000`이다.
5. Figma 접근 권한이 확보되면 화면을 원본과 대조한다. 확인 전에는 디자인 일치나 브라우저 검수를 완료로 표시하지 않는다.

## 트러블슈팅 보고서

[트러블슈팅 보고서](TROUBLESHOOTING.md)에 실제 발생한 DOM 라우터 환경 선택 오류, 생성 ID 검증 실패, npm 설치 내부 오류를 원문·원인·해결·검증·배운 점 순서로 정리했다. npm 내부 원인의 미확정 사항과 남은 시각 검수 제한도 함께 기록했다.

## 제출 기록

[Notion 미션 기록 비공개 초안](https://app.notion.com/p/414eb2880e2081089fa8c9a1bb1f23e8?pvs=204)에도 저장했다. 구현 코드와 기록은 [GitHub 저장소](https://github.com/terikeipapi/umc-frontend)의 `main` 브랜치에 게시했다. [GitHub 미션 기록](https://github.com/terikeipapi/umc-frontend/blob/main/docs/week7/MISSION.md)과 [트러블슈팅 보고서](https://github.com/terikeipapi/umc-frontend/blob/main/docs/week7/TROUBLESHOOTING.md)에서 상대 코드 링크를 따라 구현을 확인할 수 있다. UMC 제출 사이트로의 URL 제출과 실제 스터디 사진 첨부는 수행하지 않았다.

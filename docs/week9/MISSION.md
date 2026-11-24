# 9주차 필수 미션: UMCine Next.js 마이그레이션

작성일: 2026년 11월 24일(한국 시간)

## 수행 내용

기존 UMCine의 인기 영화·검색·상세, 회원가입·로그인·로그아웃, 내 정보 조회·수정, 찜, 평점·후기 기능을 유지하면서 Vite와 TanStack Router 기반 프로젝트를 Next.js App Router로 이전했다. 기존 URL과 회원 API 계약을 유지하고 화면 이동·검색 파라미터·인증 처리를 Next.js API로 교체했다.

| 미션 조건 | 구현 |
| --- | --- |
| Next.js 프로젝트 설정 | `next dev`, `next build`, `next start`, Next TypeScript 설정과 루트 레이아웃 적용 |
| TanStack Router 전용 API 교체 | `next/link`, `next/navigation`, App Router의 `page.tsx`·`layout.tsx` 사용 |
| 기존 라이브러리 설정 수정 | Tailwind를 PostCSS 플러그인으로 전환하고 Query Provider를 클라이언트 경계로 이동 |
| Server·Client Component 경계 | 레이아웃·라우트 진입점은 서버, 훅·이벤트·쿼리를 사용하는 UI는 클라이언트로 분리 |
| 브라우저 API의 서버 실행 방지 | `localStorage` 복원과 개발용 fetch 실습을 클라이언트 effect에서 실행 |

## 라우팅 구성

```text
src/
├── app/
│   ├── layout.tsx                  # 공통 서버 레이아웃
│   ├── page.tsx                    # /
│   ├── search/page.tsx             # /search
│   ├── movies/[movieId]/page.tsx    # /movies/:movieId
│   ├── login/page.tsx              # /login
│   ├── signup/page.tsx             # /signup
│   ├── (authenticated)/
│   │   ├── layout.tsx              # AuthGuard 경계
│   │   └── mypage/
│   │       ├── page.tsx            # /mypage
│   │       └── edit/page.tsx       # /mypage/edit
│   └── not-found.tsx
└── features/                       # 기존 src/pages의 화면 구현
```

Next.js는 `src/pages`를 Pages Router로 해석하므로 기존 화면 폴더를 `src/features`로 옮겼다. `(authenticated)`는 URL에 포함되지 않는 Route Group이다. 인증된 사용자에게만 보이는 두 마이페이지는 공통 레이아웃의 AuthGuard 아래에 둔다.

| 이전 구성 | 이전 후 구성 |
| --- | --- |
| `createRootRoute`, `createFileRoute`, 생성 라우트 트리 | `src/app`의 파일 기반 라우팅 |
| `<Outlet />` | 레이아웃의 `children` |
| `<Link to="...">` | `<Link href="...">` |
| `useNavigate` | `useRouter().push/replace` |
| `useSearch` | `useSearchParams` |
| `useParams` | `next/navigation`의 `useParams` |
| 링크의 `activeProps` | `usePathname`으로 활성 메뉴 표시 |
| `beforeLoad`, `<Navigate />` | 세션 복원 후 AuthGuard의 `router.replace` |
| `router.invalidate`를 통한 인증 갱신 | Zustand 구독과 개인 Query 캐시 취소·제거 |

검색어·페이지는 기존처럼 URL에 저장한다. 검색어 `1917`도 문자열로 유지하며 페이지는 1~500의 유효한 정수만 사용한다. 로그인 복귀 주소는 기존 앱 내부 URL 검증을 유지하고 `URLSearchParams`로 인코딩한다.

## 서버와 클라이언트 경계

루트 레이아웃·각 라우트의 페이지 진입점·찾을 수 없는 경로 화면은 Server Component다. 상태·이벤트·라우팅 훅·TanStack Query를 사용하는 화면 및 Provider에는 `"use client"` 경계를 둔다. 검색 파라미터를 읽는 UI는 서버 진입점의 Suspense 아래에 배치한다.

Client Component도 초기 HTML 생성 과정에 참여하므로 `"use client"`만으로 브라우저 API 접근이 안전해지는 것은 아니다. 인증 스토어는 서버와 첫 클라이언트 렌더에서 `hydrated: false`, 빈 세션으로 시작한다. SessionObserver의 effect에서 `hydrateSession()`을 호출해 `localStorage`를 읽고, AuthGuard는 복원이 끝날 때까지 대기 화면을 표시한다. 그 뒤 비로그인·만료 세션을 로그인 화면으로 보낸다.

QueryClient는 Provider의 상태로 생성해 화면 이동 동안 유지하고 서버 요청 사이에는 공유하지 않는다. `gcTime`은 서버에서 `Infinity`, 브라우저에서 30분을 사용한다. 서버의 유한 GC 타이머가 완료된 요청 객체를 계속 보관하지 않도록 분리했다. [TanStack Query의 서버 메모리 안내](https://tanstack.com/query/latest/docs/framework/react/guides/ssr#high-memory-consumption-on-server)

로그아웃·만료·현재 토큰의 401·다른 탭의 토큰 변경은 회원·찜·평점 캐시를 취소하고 제거한다. 공개 영화 캐시는 유지한다.

## 라이브러리와 환경 설정

- Vite 실행 설정과 TanStack Router 생성 파일·플러그인·의존성을 제거하고 Next.js를 적용했다.
- Tailwind CSS는 `@tailwindcss/vite` 대신 `@tailwindcss/postcss`와 `postcss.config.mjs`를 사용한다.
- `import.meta.env.VITE_*`는 `process.env.NEXT_PUBLIC_*`로 변경했다. `.env.example`과 로컬 실행 안내도 갱신했다.
- 개발·프로덕션 서버는 5173 포트를 사용해 기존 NestJS 서버의 CORS 주소를 유지한다. 회원 API 기본 주소는 3000 포트다.
- 개발용 `?tmdb-fetch=1` 실습은 클라이언트 effect에서 동적 import하고 프로덕션에서는 실행하지 않는다.
- 기존 7개 테스트 모음의 Vite 모듈 로딩을 esbuild 기반 헬퍼로 바꾸고, 화면 테스트는 Next.js의 실제 라우팅 컨텍스트를 사용하도록 이전했다. 저장소 없는 SSR, 보호 화면 비노출, QueryClient 분리, 토큰 복원·만료 검사도 추가했다.

## 기존 기능 보존

TMDB 데이터 변환, 로딩·오류·빈 결과·누락 이미지 처리, 요청 취소·재시도, 브라우저의 5분 fresh·30분 GC 캐시 정책을 유지한다. 찜·평점·회원정보 API와 계정별 Query 키도 유지한다. 찜 등록·해제 후 목록과 상세 상태를 동기화하고, 평점 수정·삭제는 `ratingId`를 사용한다. 평점 충돌이나 서버 실패 후 사용자가 작성한 내용은 보존한다.

## 실행 및 검증

```sh
# C:\umc\study — 별도 터미널
npm.cmd run start:dev

# C:\umc\umcine
pnpm.cmd install
pnpm.cmd type-check
pnpm.cmd test
pnpm.cmd build
pnpm.cmd start
```

개발 실행은 `pnpm.cmd dev`를 사용한다. TMDB 환경 변수와 백엔드의 DB·JWT 설정은 [README](../../README.md)를 참고한다.

<!-- VERIFICATION_RESULTS_START -->

| 검증 | 명령·대상 | 실제 결과 |
| --- | --- | --- |
| 의존성 재현 | `pnpm.cmd install --frozen-lockfile` | 성공. `pnpm-workspace.yaml`에서 esbuild 빌드 허용 |
| 타입 검사 | `pnpm.cmd type-check` | 통과 |
| 회귀 테스트 | `pnpm.cmd test` | 73개 통과, 실패 0개, 건너뜀 0개 |
| 프로덕션 빌드 | `pnpm.cmd build` | Next.js 16.4.6 빌드 성공. App Router의 7개 공개 경로와 `/_not-found` 생성 |
| 프로덕션 실행 | `pnpm.cmd start` | 5173 포트에서 Next.js 서버 실행 |
| 직접 주소 요청 | 실행 중인 프로덕션 서버에 HTTP 요청 | 경로 8건 HTTP 200, 미등록 경로 HTTP 404, `X-Powered-By: Next.js` 확인 |
| 실제 API 브라우저 검증 | 프로덕션 Next.js + TMDB + 로컬 NestJS/MySQL | 16개 항목 모두 통과, 캡처 8개, 콘솔·런타임 오류·실패 요청 0건 |

<!-- VERIFICATION_RESULTS_END -->

빌드의 App Router 경로는 `/`, `/login`, `/movies/[movieId]`, `/mypage`, `/mypage/edit`, `/search`, `/signup`과 `/_not-found`다. 전체 검증 요약은 [verification.json](verification.json), 실제 브라우저의 항목별 결과·네트워크 기록은 [browser-verification.json](browser-verification.json)에 저장했다.

자동 테스트 73개의 HTTP 응답은 모의 응답이며, 실제 브라우저 검증 16개는 HTTP fixture 없이 실행했다. 직접 주소의 HTTP 200 확인은 문서 응답과 라우팅 검증으로 구분한다. 실제 API를 사용하는 브라우저 검증에서는 인기 목록·페이지·검색·상세·캐시 재사용, 회원가입·로그인·보호 경로 복귀, 회원정보 수정 취소와 재진입·저장·새로고침, 찜 생성·조회·해제, 평점 등록·수정·삭제, 로그아웃과 잘못된 영화 ID를 확인했다. 검증 후 생성한 임시 회원 1개를 정리했다.

실행 화면과 제출용 설명은 [인증 기록](SUBMISSION.md)에 정리했다. 이전 8주차의 69개 테스트 및 백엔드 검증 수치는 이번 실행 결과로 재사용하지 않는다.

## 참고 자료

- [Next.js: Vite에서 이전하기](https://nextjs.org/docs/app/guides/migrating/from-vite)
- [Next.js: Server·Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Tailwind CSS: Next.js 설치](https://tailwindcss.com/docs/installation/framework-guides/nextjs)
- [이전 8주차 구현·검증 기록](../week8/MISSION.md)

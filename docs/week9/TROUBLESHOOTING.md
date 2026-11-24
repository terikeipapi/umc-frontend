# 9주차 트러블슈팅: Next.js 마이그레이션

작성일: 2026년 11월 24일(한국 시간)

## 1. 기존 화면 폴더가 Next.js 라우트로 해석됨

**확인한 구성:** 기존 화면 컴포넌트가 `src/pages/auth`, `src/pages/movies`, `src/pages/member`에 있었다.

**원인:** Next.js에서 `pages`는 Pages Router의 예약 폴더다. 화면 파일을 그대로 두면 App Router와 별도로 의도하지 않은 라우트가 생기거나 페이지 export 규칙과 충돌할 수 있다.

**해결:** 화면 구현을 `src/features`로 옮기고, 공개 URL에 대응하는 진입점만 `src/app/**/page.tsx`에 배치했다. TanStack Router의 파일·생성 라우트 트리를 제거하고 경로를 App Router로 일원화했다.

**검증 기준:** 빌드 경로 목록에 `/`, `/search`, `/movies/[movieId]`, `/login`, `/signup`, `/mypage`, `/mypage/edit`가 나타나고 기존 화면 파일 이름에서 파생된 경로가 없어야 한다.

## 2. `"use client"`를 추가해도 브라우저 API의 서버 실행은 막히지 않음

**확인한 구성:** 기존 인증 스토어는 모듈이 로드될 때 저장된 세션을 읽었다. 개발용 fetch 실습도 모듈 최상위에서 요청을 시작했다.

**원인:** Client Component도 초기 HTML을 생성할 때 서버 렌더링에 참여한다. `localStorage`를 모듈 최상위나 렌더 중에 읽으면 서버에서 접근할 수 없거나 서버 HTML과 첫 클라이언트 결과가 달라질 수 있다.

**해결:** 인증 스토어를 빈 세션과 `hydrated: false`로 시작하게 했다. SessionObserver의 effect에서 `hydrateSession()`을 호출하고 브라우저 환경을 확인한 뒤 저장소를 읽는다. 개발용 실습도 개발 모드의 클라이언트 effect에서만 동적 import한다.

**검증 기준:** 서버가 브라우저 전역 없이 렌더링되고, 저장된 세션이 있는 새로고침에서도 hydration 오류 없이 로그인 상태로 복원되어야 한다. 프로덕션에는 실습 요청이 발생하지 않아야 한다.

## 3. 세션 복원 전에 보호 경로가 로그인으로 이동할 수 있음

**원인:** 서버와 최초 클라이언트 상태를 빈 세션으로 맞춘 뒤 토큰 유무만 검사하면 정상적으로 저장된 토큰을 읽기 전에 비로그인으로 판단한다.

**해결:** AuthGuard가 `hydrated`를 확인하도록 했다. 복원 중에는 대기 화면을 표시하고, 복원 뒤 세션이 없을 때만 `router.replace(getLoginHref(...))`를 실행한다. 로그인 후에는 검증한 복귀 URL로 돌아간다.

**검증 기준:** 비로그인 `/mypage/edit` 접근은 해당 경로를 보존한 로그인 URL로 이동해야 한다. 로그인 상태에서 같은 주소를 새로고침하면 편집 화면이 열려야 한다. 만료·로그아웃·401 후에는 개인 화면과 캐시가 정리되어야 한다.

## 4. QueryClient의 모듈 싱글턴은 서버 요청 간 캐시를 공유할 수 있음

**확인한 구성:** 기존 SPA는 모듈 밖에서 생성한 QueryClient 한 개를 앱 전체에서 사용했다.

**원인:** 서버 프로세스의 모듈은 여러 요청에 재사용될 수 있다. 브라우저 한 탭의 캐시 수명을 전제로 만든 싱글턴을 서버에서도 사용하면 요청 간 데이터가 남을 수 있다.

**해결:** `createQueryClient()` 팩토리를 만들고 클라이언트 Provider의 상태로 인스턴스를 보관한다. 화면 이동 중에는 같은 Provider가 캐시를 유지하고, 서버의 별도 렌더링은 인스턴스를 공유하지 않는다. 계정별 Query 키와 세션 변경 시 개인 캐시 제거도 유지했다.

추가로 브라우저의 30분 GC 설정이 서버에도 적용되지 않도록 `gcTime: typeof window === "undefined" ? Infinity : QUERY_GC_TIME`으로 분리했다. 서버에서 유한 GC 타이머는 완료된 요청의 캐시와 요청 컨텍스트를 계속 붙잡을 수 있다. `Infinity`는 타이머를 예약하지 않으므로 요청별 QueryClient가 필요 없어지면 함께 회수될 수 있다. [TanStack Query 공식 SSR 메모리 안내](https://tanstack.com/query/latest/docs/framework/react/guides/ssr#high-memory-consumption-on-server)

**검증 기준:** 공개 영화의 재방문 캐시는 유지되고 회원·찜·평점은 계정별로 분리되어야 한다. 이전 세션의 늦은 성공·401 응답이 새 계정의 상태에 반영되지 않아야 한다.

## 5. Vite 환경 변수와 Tailwind 플러그인을 그대로 사용할 수 없음

**확인한 구성:** `import.meta.env.VITE_*`, `@tailwindcss/vite`, Vite React·Router 플러그인을 사용했다.

**해결:** 브라우저에서 필요한 환경 변수를 `process.env.NEXT_PUBLIC_*`로 바꾸고 `.env.example`과 실행 문서를 갱신했다. Tailwind는 `@tailwindcss/postcss`를 PostCSS 설정에 등록했다. TypeScript에서 Vite 클라이언트 타입을 제거하고 Next.js 타입·플러그인을 적용했다.

`NEXT_PUBLIC_*`는 빌드 시 브라우저 코드에 반영되므로 프로덕션에서 값을 바꿨다면 다시 빌드해야 한다. 기존 `.env.local`의 키를 변경하지 않으면 TMDB 인증 설정 안내가 표시된다.

**검증 기준:** 인기 영화 요청에 TMDB 인증이 적용되고 기존 스타일이 유지되어야 한다. 타입 검사·프로덕션 빌드에서 Vite 전역이나 플러그인을 참조하지 않아야 한다.

## 6. Next.js 기본 포트가 기존 백엔드와 겹침

**확인한 구성:** NestJS API는 3000 포트를 사용하고 CORS는 `http://localhost:5173`을 허용한다.

**원인:** Next.js를 기본 포트로 시작하면 회원 API와 같은 포트를 사용한다. 임의의 다른 포트로 바꾸면 백엔드 CORS 설정도 맞춰야 한다.

**해결:** `next dev --port 5173`, `next start --port 5173`으로 기존 프런트엔드 주소를 유지했다. 회원 API 주소는 `NEXT_PUBLIC_API_BASE_URL=http://localhost:3000`을 사용한다.

**검증 기준:** 프런트엔드와 백엔드가 동시에 실행되고 회원가입·로그인·회원정보·찜·평점 요청이 CORS 오류 없이 처리되어야 한다.

## 7. 검색 파라미터·인증 테스트도 기존 라우터에 의존함

**확인한 구성:** 테스트가 Vite의 `ssrLoadModule`과 TanStack Router의 메모리 라우터·생성 트리에 의존했다.

**해결:** 기존 7개 테스트 모음의 TypeScript 모듈 로딩을 esbuild 기반 헬퍼로 이전하고, 화면 테스트가 Next.js의 실제 App Router·검색·경로 컨텍스트를 사용하도록 바꿨다. 검색어·페이지·로그인 복귀, 비로그인·만료·401, API CRUD·캐시·실패 시 입력 보존이라는 기존 검증 목적을 유지했다. 저장소에 접근하지 않는 SSR, 인증 전 보호 화면 비노출, QueryClient 분리, 저장된 토큰 복원·만료 검사도 추가했다.

**검증 범위:** 모의 HTTP 기반의 자동 회귀 테스트와 실제 Next 서버의 경로·화면 확인을 구분한다. 최종 명령 결과는 [미션 검증 표](MISSION.md#실행-및-검증), 실제 캡처는 [인증 기록](SUBMISSION.md)에 기록한다.

## 8. 검색 파라미터를 읽는 화면에는 Suspense 경계가 필요함

**확인한 구성:** 인기 목록의 페이지 번호, 검색 화면의 검색어·페이지, 로그인 복귀 주소와 인증 경계가 `useSearchParams`로 현재 URL을 읽는다.

**원인:** 개발 서버에서는 화면이 정상으로 보여도, 정적 페이지의 프로덕션 사전 렌더링에서는 `useSearchParams`를 사용하는 클라이언트 UI에 Suspense 경계가 필요하다. `"use client"`만 추가하면 이 경계가 생기지 않는다. [Next.js 공식 `useSearchParams` 문서](https://nextjs.org/docs/app/api-reference/functions/use-search-params)

**해결:** 관련 서버 페이지와 보호 레이아웃에서 해당 클라이언트 화면을 `<Suspense fallback={...}>`로 감쌌다. 사전 렌더링할 수 있는 공통 영역은 유지하고 URL에 의존하는 화면은 준비되면 표시한다.

**검증:** Next.js 16.4.6의 `pnpm.cmd build`가 성공했고 7개 공개 App Router 경로와 `/_not-found`가 생성됐다. `pnpm.cmd start`로 실행한 프로덕션 서버의 경로 8건은 HTTP 200, 미등록 경로는 HTTP 404를 반환했다. 개발 실행 결과만으로 마이그레이션을 완료했다고 판단하지 않고 프로덕션 빌드·직접 주소 요청을 함께 확인했다.

이번 문서는 코드와 기존 구성에서 확인한 이전 쟁점을 기록한다. 실제로 관찰하지 않은 오류 메시지나 실행 결과는 재현한 사실로 적지 않았다. [Next.js 마이그레이션 안내](https://nextjs.org/docs/app/guides/migrating/from-vite), [서버·클라이언트 경계 안내](https://nextjs.org/docs/app/getting-started/server-and-client-components)를 참고했다.

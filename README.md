# UMCine

TMDB API의 인기 영화 목록·검색·상세와 회원가입·로그인·회원정보 수정·찜·평점 기능을 제공하는 Next.js App Router 앱입니다.

## 9주차: Next.js 마이그레이션

Vite와 TanStack Router 구성을 Next.js로 옮겼습니다. `src/app`의 `page.tsx`·`layout.tsx`가 라우트를 구성하고 기존 URL을 유지합니다. 기존 `src/pages`는 Next.js의 Pages Router 예약 폴더와 충돌하지 않도록 `src/features`로 이동했습니다.

공통 레이아웃과 라우트 진입점은 Server Component로 두고, 검색·페이지 이동·폼·TanStack Query·Zustand를 사용하는 화면은 Client Component로 분리했습니다. 브라우저 세션은 클라이언트 effect에서 복원하며, 복원이 끝난 뒤 보호 경로의 로그인 여부를 판단합니다.

`(authenticated)` Route Group의 공통 레이아웃 아래 AuthGuard가 `/mypage`, `/mypage/edit`를 보호합니다. 비로그인 접근은 로그인 화면으로 이동하며 로그인 후 원래 주소로 돌아옵니다. 로그인, 내 정보 조회·수정, 로그아웃은 기존 회원 API를 사용합니다.

마이페이지는 서버의 찜 목록을 표시합니다. 영화 상세에서는 찜 조회·추가·해제와 내 평점 조회·등록·수정·삭제를 지원합니다. 평점은 1~5점, 후기는 최대 500자이며, 수정·삭제에는 서버에서 받은 `ratingId`를 사용합니다. 계정별 Query 캐시를 사용하고 로그아웃·401·토큰 만료 시 개인 캐시를 비웁니다. 요청 실패 시 재시도 안내와 작성 내용을 유지합니다.

회원 API 기본 주소는 `http://localhost:3000`이며 `.env.local`의 `NEXT_PUBLIC_API_BASE_URL`로 변경할 수 있습니다. [백엔드 저장소](https://github.com/terikeipapi/umc-backend)에 찜 API와 테이블을 추가했습니다. 기존 작업 공간에서는 백엔드가 `../study`에 있습니다. 별도로 복제했다면 해당 백엔드 폴더에서 다음 명령을 실행하세요.

```sh
cd ../study
npm run week8:db
npm run start:dev
```

`week8:db`는 기존 회원·평점 데이터를 유지하고 필요한 테이블을 준비합니다. 새 터미널에서 `umcine`의 `pnpm dev`를 실행하세요. Windows PowerShell이 스크립트 실행을 차단하면 `npm.cmd`, `pnpm.cmd`를 사용하세요.

[이번 미션 구현 기록](docs/week9/MISSION.md), [트러블슈팅](docs/week9/TROUBLESHOOTING.md), [미션 인증용 문구와 캡처](docs/week9/SUBMISSION.md)를 참고하세요. [8주차 API 연동 기록](docs/week8/MISSION.md), [8주차 트러블슈팅](docs/week8/TROUBLESHOOTING.md), [7주차 미리보기 기록](docs/week7/MISSION.md)은 마이그레이션 전의 과거 기록입니다.

## 실행

`.env.example`을 `.env.local`로 복사하고 TMDB 계정의 **Settings → API → API Read Access Token**을 입력하세요.

```dotenv
NEXT_PUBLIC_TMDB_ACCESS_TOKEN=발급받은_API_Read_Access_Token
NEXT_PUBLIC_TMDB_API_KEY=
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

v3 API key를 사용한다면 토큰 대신 `NEXT_PUBLIC_TMDB_API_KEY`를 설정하세요. 둘 다 설정하면 토큰을 우선합니다. 기존 `.env.local`의 `VITE_*` 키도 위 이름으로 변경해야 합니다. 값을 바꾼 뒤 개발 서버를 재시작하고 프로덕션 실행은 다시 빌드하세요. `.env.local`은 Git에서 제외됩니다. `NEXT_PUBLIC_*` 값은 브라우저 번들에 포함되므로 서버용 비밀값을 넣지 않습니다.

```sh
pnpm install
pnpm dev
pnpm type-check
pnpm test
pnpm build
pnpm start
```

개발·프로덕션 서버는 `http://localhost:5173`에서 실행해 기존 NestJS 서버의 CORS 허용 주소를 유지합니다. `pnpm start`는 빌드한 Next.js 프로덕션 서버를 실행하며 `pnpm preview`도 같은 명령의 별칭입니다.

## 요청 구조

- `src/api/popular-fetch.ts`: 순수 `fetch` 인기 영화 요청. `response.ok`를 검사합니다.
- `src/api/tmdb.ts`: 공통 ky v1 인스턴스. API 주소, 한국어, 인증, 10초 제한을 적용합니다.
- `src/api/movies.ts`: 인기 목록 `/movie/popular`, 검색 `/search/movie`, 상세 `/movie/{id}` 요청과 화면 데이터 변환.
- `src/app`: Next.js App Router의 서버 레이아웃과 라우트 진입점.
- `src/lib/query-client.ts`: Provider별 QueryClient 생성과 캐시·재시도 설정.
- `src/queries/movies.ts`: 요청별 query key와 queryOptions. TanStack Query의 AbortSignal을 API로 전달합니다.
- `src/lib/movie-error.ts`: 공통 오류 메시지와 자동 재시도 조건.
- `src/features/movies/*`: `useQuery`로 목록·검색·상세의 로딩·오류·빈 결과·성공을 표시합니다.
- `src/components/auth`: 세션 복원·만료 관찰과 보호 경로의 클라이언트 인증 경계.
- `postcss.config.mjs`: Tailwind CSS의 Next.js용 PostCSS 설정.

빈 검색어는 요청하지 않습니다. 상세 404/잘못된 ID는 찾을 수 없는 영화로 표시하고, 인증·요청 제한·네트워크 오류는 재시도 가능한 오류로 표시합니다. 이미지·줄거리·개봉일·상영 시간 누락에는 대체 표시를 사용합니다.

목록/검색의 페이지 번호와 검색어는 URL에 저장됩니다. 찜은 실제 TMDB ID를 사용해 회원 서버에 저장하며 로그인한 계정에만 연결됩니다. 과거 브라우저 북마크 저장값은 자동 이관하지 않습니다. 영화 목록·검색의 북마크 버튼은 하나의 찜 목록 쿼리를 공유하고 상세에서는 영화별 찜 조회 API를 사용합니다.

## TanStack Query와 캐시 확인

루트의 클라이언트 Provider가 `QueryClientProvider`로 화면을 감쌉니다. Provider가 유지되는 동안 하나의 QueryClient를 사용해 화면 이동 시 캐시를 재사용하고, 서버 요청 사이에는 QueryClient를 공유하지 않습니다. 서버에서는 `gcTime: Infinity`로 GC 타이머를 만들지 않고 브라우저에서만 30분 GC를 적용합니다.

| 요청 | query key 예시 |
| --- | --- |
| 인기 영화 1페이지 | `["movies", "popular", 1]` |
| 인기 영화 2페이지 | `["movies", "popular", 2]` |
| 기생충 검색 1페이지 | `["movies", "search", "기생충", 1]` |
| 영화 550 상세 | `["movies", "detail", "550"]` |

검색어는 앞뒤 공백을 제거하고, 검색어와 페이지가 모두 키에 포함됩니다. 입력 중에는 요청하지 않고 검색 제출로 URL이 바뀔 때 요청합니다. 빈 검색어는 `enabled: false`로 요청을 막습니다. 목록 카드의 요약과 상세 응답은 별도 캐시에 저장합니다.

- `staleTime: 5분`: 마지막 성공 후 5분 동안 같은 키는 fresh입니다. 이때 앱 내부 링크나 뒤로 가기로 다시 방문하면 추가 API 요청 없이 캐시를 표시합니다.
- 브라우저의 `gcTime: 30분`: 구독 중인 화면이 없어진 후 30분 동안 캐시를 보관합니다. 5분이 지나 stale인 캐시는 재방문 시 먼저 표시하고 백그라운드에서 갱신합니다. 서버는 `Infinity`를 사용해 요청 완료 후 캐시 타이머가 요청 객체를 붙잡지 않도록 합니다. [TanStack Query의 서버 메모리 안내](https://tanstack.com/query/latest/docs/framework/react/guides/ssr#high-memory-consumption-on-server)
- 갱신 중에는 안내와 기존 결과를 함께 표시합니다. 갱신 실패 시에도 캐시를 유지하고 오류 안내와 다시 시도 버튼을 표시합니다.
- 설정 오류·HTTP 4xx·취소는 자동 재시도하지 않습니다. 네트워크·서버 등 일시 오류는 한 번 재시도합니다. 오프라인에서는 연결 대기 상태를 표시하고 연결이 돌아오면 요청을 이어갑니다.
- 캐시는 메모리에 있습니다. 새로고침이나 탭을 닫았다 열면 새 QueryClient가 만들어지므로 다시 요청합니다.

다음 순서로 **Query Devtools와 Network를 함께** 확인하세요.

1. `pnpm dev`로 실행하고 `http://localhost:5173/`를 엽니다. 별도 fetch 실습을 실행하는 `?tmdb-fetch=1`은 붙이지 않습니다.
2. 화면 모서리의 TanStack Query 버튼을 눌러 Query Devtools를 엽니다. 개발 모드에서만 표시됩니다.
3. 브라우저 개발자 도구의 **Network → Fetch/XHR**에서 **Preserve log**를 켜고 `api.themoviedb.org`로 필터링합니다. 브라우저의 **Disable cache**는 TanStack Query의 메모리 캐시를 비우지 않습니다.
4. 목록 로딩 후 `["movies","popular",1]`의 데이터와 fresh 상태를 확인합니다. 카드로 상세에 들어가면 `["movies","detail","영화ID"]`가 생기고 상세 GET 요청이 추가됩니다.
5. 상세의 **영화 목록** 링크로 돌아옵니다. 5분 이내라면 목록이 즉시 표시되고 `movie/popular?page=1`의 요청 수가 늘지 않아야 합니다. 같은 상세를 다시 열어 상세 요청 수도 그대로인지 확인합니다.
6. 목록 2페이지 → 1페이지로 이동하고, 검색에서 `기생충` → `1917` → `기생충`을 제출합니다. 처음 보는 페이지·검색어만 요청하고 재방문은 캐시를 사용하는지 확인합니다. 검색 결과에서 상세로 갔다가 브라우저 뒤로 가기로 돌아와도 같습니다.
7. Query Devtools에서 현재 쿼리를 선택해 **Invalidate**를 누릅니다. Network에 새 요청이 생기고, 기존 내용과 갱신 안내가 함께 표시된 뒤 데이터가 갱신되는지 확인합니다. 또는 5분 후 다른 화면에 갔다 돌아와 stale 캐시의 갱신을 확인할 수 있습니다.
8. 로딩은 쿼리 캐시를 지운 후 Network를 느린 연결로 설정해 확인합니다. 오류는 브라우저의 **Network request blocking**으로 TMDB URL을 차단한 뒤 새 쿼리를 열거나 **Refetch**해 확인합니다. 차단을 해제하고 **다시 시도**하면 복구되어야 합니다. 오프라인은 오류 대신 연결 대기로 표시될 수 있습니다.
9. `/search`에서 요청 없음, 존재하지 않는 제목 검색에서 빈 결과, `/movies/abc`에서 영화 없음 상태를 확인합니다. 잘못된 상세 ID는 API를 호출하지 않습니다.

개발 모드의 React StrictMode에서는 최초 마운트 검사 중 취소된 요청과 이어지는 요청이 보일 수 있습니다. 완료된 같은 키의 **재방문 전후 요청 수**를 비교하세요. 캐시의 fresh/stale, 활성 구독 유무, 네트워크 요청을 구분하는 기준은 [TanStack Query 공식 기본 설정 문서](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults)를 참고하세요.

## Network 패널에서 순수 fetch 확인

1. 인증값을 설정하고 `pnpm dev`를 실행하세요.
2. Chrome 개발자 도구의 **Network**를 열고 Fetch/XHR로 필터링하세요.
3. `http://localhost:5173/?tmdb-fetch=1`로 접속하세요.
4. `movie/popular` 중 순수 fetch 요청을 선택하세요. 클라이언트 effect가 실습 모듈을 동적으로 불러오며, 요청은 모듈에서 한 번 실행됩니다. 목록 화면 자체의 ky 요청은 별도 요청입니다.
5. Headers에서 GET, `language=ko-KR`, `page=1`, 인증을 확인하고 Response에서 `page`, `results`, `total_pages`, `total_results`를 확인하세요. Console에는 실습 응답이 정보 로그로 표시됩니다.

`tmdb-fetch=1` 실습은 개발 모드에서만 동작하며 프로덕션에서는 실행하지 않습니다. 인증값이 없으면 실습과 화면은 설정 안내를 표시하고 인증 없는 요청을 보내지 않습니다.

## 화면 수동 확인

각 주소를 주소창에 직접 입력하고 새로고침하세요.

- `/`, `/?page=2`: 인기 영화와 실제 페이지 이동
- `/search`: 입력 안내, 요청 없음
- `/search?query=기생충`, `/search?query=1917&page=2`: 검색어·페이지 유지
- `/search?query=zzzzzzzzzzzzzzzzzzzzzzzzzz`: 빈 결과
- `/movies/550`: 목록 방문 없이도 상세 정보 요청
- `/movies/abc`, 존재하지 않는 TMDB ID: 영화 없음

로딩·오류·오프라인·캐시 재사용 확인은 위 TanStack Query 절차를 따르세요. Console에서 오류를 확인하세요. 북마크를 누른 뒤 상세와 목록, 새로고침에서도 같은 TMDB ID가 유지되는지 확인하세요.

`pnpm build` 후 `pnpm start`로 같은 주소의 직접 접근·새로고침을 확인할 수 있습니다. 배포 환경은 Next.js 실행을 지원해야 합니다.

## 검증 기록

이번 마이그레이션에서 `pnpm install --frozen-lockfile`, 타입 검사, 회귀 테스트 73개(실패·건너뜀 0개), Next.js 16.4.6 프로덕션 빌드가 통과했습니다. `pnpm start`로 실행한 서버의 경로 8건은 HTTP 200, 미등록 경로는 HTTP 404를 반환했습니다. 명령별 결과와 검증 범위는 [9주차 미션 기록](docs/week9/MISSION.md), 실제 실행 화면은 [인증 기록](docs/week9/SUBMISSION.md)에 정리했습니다. 이전 주차의 결과는 각 주차 문서에 보존했습니다.

실제 TMDB·로컬 NestJS/MySQL에 연결한 프로덕션 브라우저 검증도 16개 항목을 통과했습니다. 목록·검색·상세·캐시, 회원가입·로그인·보호 경로 복귀, 회원정보 수정·취소·새로고침, 찜·평점 변경·삭제, 로그아웃을 확인했고 브라우저 콘솔·런타임 오류와 실패 요청은 0건이었습니다. [상세 실행 기록](docs/week9/browser-verification.json)과 [실제 캡처 8개](docs/week9/SUBMISSION.md#실행-화면과-캡션)를 남겼습니다.

API 통합 테스트는 실제 TypeScript 모듈과 모의 TMDB 응답을 사용합니다. 인증, 검색어 인코딩, 페이지, 상세 변환, 빈 결과, 누락 이미지, 404/429, 요청 취소, 인증 누락을 검증합니다. 실제 서버의 성공 응답을 증명하는 테스트는 아닙니다.

Query 회귀 테스트는 실제 QueryClient·QueryObserver·TypeScript API 모듈을 사용합니다. 목록·검색·상세의 재방문 시 추가 요청 없음, 키별 캐시 분리, 검색어 정규화, 빈 검색 요청 차단, 빈 결과·404 캐시, 무효화 후 갱신, 오류 재시도·복구, 화면 이탈 시 요청 취소를 검증합니다.

이전 Vite 환경에서는 실제 TMDB API와 Chrome 개발 모드에서 목록·검색·상세, 빈 결과, 오류·재시도 복구, Query Devtools를 확인했습니다. 당시 목록·상세 재방문 전후 GET 수는 2→2회, 검색 재방문은 3→3회였습니다. 이 수치는 이번 Next.js 실행 결과와 구분하며 [과거 검증 기록과 Devtools 캡처](docs/tanstack-query-verification.md)에 보존했습니다.

## 출처

마이그레이션은 [Next.js의 Vite 이전 안내](https://nextjs.org/docs/app/guides/migrating/from-vite), [Server·Client Component 안내](https://nextjs.org/docs/app/getting-started/server-and-client-components), [Tailwind CSS의 Next.js 설치 안내](https://tailwindcss.com/docs/installation/framework-guides/nextjs)를 참고했습니다.

TMDB 공식 로고와 고지문은 [TMDB attribution 안내](https://developer.themoviedb.org/docs/faq)를 따릅니다. 로고 원본은 [TMDB 공식 CDN](https://www.themoviedb.org/assets/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg)에서 저장했습니다.

This product uses the TMDB API but is not endorsed or certified by TMDB.

# 9주차 미션 인증 기록

작성일: 2026년 11월 24일(한국 시간)

## 제출용 수행 내용

기존 UMCine의 기능을 유지하면서 Vite·TanStack Router 기반 프로젝트를 Next.js App Router로 마이그레이션했습니다. 인기 영화 목록·페이지 이동, 영화 검색·상세, 회원가입·로그인·로그아웃, 회원정보 조회·수정, 찜, 평점·후기 기능과 기존 URL을 유지했습니다.

TanStack Router의 라우트 선언·Outlet·Link·이동·검색 파라미터 API를 Next.js의 `page.tsx`·`layout.tsx`, `next/link`, `next/navigation`으로 교체했습니다. 기존 `src/pages`는 Next.js의 예약 폴더와 충돌하지 않도록 `src/features`로 옮겼습니다.

루트 레이아웃과 라우트 진입점은 Server Component로, 폼·상태·라우팅 훅·TanStack Query를 사용하는 UI는 Client Component로 나눴습니다. `localStorage`의 로그인 세션은 클라이언트 effect에서 복원하고, 복원이 끝난 뒤 보호 경로의 인증 여부를 판단하도록 수정했습니다. 로그인 후 원래 경로로 돌아가는 처리와 로그아웃·만료·401 시 개인 캐시 제거도 유지했습니다.

환경 변수는 `VITE_*`에서 `NEXT_PUBLIC_*`로 바꾸고 Tailwind를 Next.js용 PostCSS 설정으로 전환했습니다. QueryClient는 Provider마다 생성해 서버 요청 사이에 캐시가 공유되지 않도록 했으며, 화면 이동 중에는 기존 캐시를 재사용합니다. 캐시의 GC는 브라우저에서 30분, 서버에서 `Infinity`로 분리해 서버의 불필요한 타이머를 막았습니다. 프런트엔드 포트는 기존 백엔드 CORS 설정에 맞춰 5173으로 유지했습니다.

## 실행 화면과 캡션

<!-- SCREENSHOT_RESULTS_START -->
Next.js 프로덕션 서버를 실제 TMDB API와 로컬 NestJS/MySQL에 연결해 실행한 화면이다. HTTP 응답을 모의 데이터로 교체하지 않았으며, 아래 PNG 8개를 저장했다. 05·07 캡처의 임시 검증 계정 이메일은 회색으로 가림 처리했다.

| 실행 화면 | 확인 내용 | 인증 기록에 넣을 설명 |
| --- | --- | --- |
| [01-popular-movies.png](screenshots/01-popular-movies.png) | 인기 영화 목록 | 실제 TMDB 인기 영화를 표시하고 기존 카드·페이지 이동 UI를 유지했다. |
| [02-search-1917.png](screenshots/02-search-1917.png) | `1917` 검색 결과 | 숫자로 된 제목을 문자열로 검색하고 URL에 검색어를 보존한다. |
| [03-movie-detail.png](screenshots/03-movie-detail.png) | 영화 상세·비로그인 안내 | 실제 영화 상세를 조회하고 비로그인 상태의 찜·평점 안내를 제공한다. |
| [04-protected-route-login.png](screenshots/04-protected-route-login.png) | 보호 경로 접근 후 로그인 | 비로그인 마이페이지 접근을 차단하고 로그인 후 돌아갈 경로를 보존한다. |
| [05-profile-edit.png](screenshots/05-profile-edit.png) | 회원정보 수정 | 보호 경로에서 서버의 회원정보를 불러온다. 수정 취소 후 재진입, 저장, 새로고침도 검증했다. |
| [06-favorite-rating.png](screenshots/06-favorite-rating.png) | 로그인 후 찜·평점·후기 | 서버의 찜 상태와 등록·수정한 평점·후기를 화면에 반영한다. |
| [07-profile-favorites.png](screenshots/07-profile-favorites.png) | 회원정보와 찜 목록 | 로그인 계정의 회원정보와 서버에 저장된 찜 목록을 표시한다. |
| [08-invalid-movie.png](screenshots/08-invalid-movie.png) | 잘못된 영화 ID | 잘못된 ID의 상세 주소에 직접 접근해도 영화 없음 안내를 제공한다. |

실제 브라우저 검증 16개 항목이 모두 통과했다. 목록·검색·상세와 캐시 재사용, 회원가입과 중복 확인, 로그인 후 보호 경로 복귀, 회원정보 취소·수정·새로고침, 찜 생성·조회·해제, 평점 등록·수정·삭제, 로그아웃과 보호 경로 재차단, 잘못된 ID 처리를 확인했다. 브라우저 콘솔 오류·페이지 런타임 오류·실패 요청은 각각 0건이다. 검증용으로 생성한 임시 회원은 정리했다.
<!-- SCREENSHOT_RESULTS_END -->

## 검증 결과

<!-- SUBMISSION_VERIFICATION_START -->
| 검증 | 결과 |
| --- | --- |
| `pnpm.cmd install --frozen-lockfile` | 잠금 파일 기준 설치 성공 |
| `pnpm.cmd type-check` | 통과 |
| `pnpm.cmd test` | 73개 통과, 실패 0개, 건너뜀 0개 |
| `pnpm.cmd build` | Next.js 16.4.6 프로덕션 빌드 성공 |
| `pnpm.cmd start`와 HTTP 직접 주소 확인 | 5173 포트 실행, 경로 8건 HTTP 200, 미등록 경로 HTTP 404 |
| 실제 API 브라우저 검증 | 16개 항목 통과, 캡처 8개, 콘솔·런타임 오류·실패 요청 0건 |

자동 회귀 테스트 73개는 모의 HTTP 응답을 사용한다. 실제 API 브라우저 검증 16개는 별도로 프로덕션 Next.js·TMDB·로컬 NestJS/MySQL에서 실행했다. 캡처는 화면 상태를 보여주며, 찜·평점의 등록·수정·삭제 결과는 [브라우저 항목별 결과와 네트워크 기록](browser-verification.json)에서 확인할 수 있다. CLI·브라우저 요약은 [verification.json](verification.json)에 저장했다.
<!-- SUBMISSION_VERIFICATION_END -->

구현 상세와 명령별 결과: [MISSION.md](MISSION.md)

이전 과정에서 수정한 문제와 원인: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

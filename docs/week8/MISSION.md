# 8주차 필수 미션: 로그인 전용 라우트와 남은 API

작성일: 2026년 11월 17일(한국 시간)

추가 안내: 이 문서는 프런트엔드 8주차 미션 기록이다. 이후 제공된 백엔드 「서비스의 핵심 기능 만들기」 PDF의 실습·필수 미션은 [백엔드 제출 기록](https://github.com/terikeipapi/umc-backend/blob/main/docs/week8/SUBMISSION.md)에 정리했다. 현재 찜 API는 중복 등록 409·없는 항목 삭제 404를 반환하고, 등록·목록은 `favoriteId/movieId/createdAt`, 여부 조회는 `{isFavorite}`를 반환한다. 프런트엔드는 새 응답을 버튼 상태로 변환하도록 조정했으며 69개 회귀 테스트·타입 검사·빌드를 통과했다. 아래 백엔드 33건 검증은 변경 전 계약의 과거 기록이다.

## 로그인 전용 폴더

```text
src/routes/
├── __root.tsx
├── login.tsx
└── (authenticated)/
    ├── _auth.tsx                 # beforeLoad 인증 검사 + <Outlet />
    └── _auth/
        ├── mypage.index.tsx      # /mypage
        └── mypage.edit.tsx       # /mypage/edit
```

`(authenticated)`는 URL에 포함되지 않는 Route Group이다. `_auth`는 URL 경로를 추가하지 않는 공통 Layout Route다. 그룹으로 파일을 모으고 레이아웃에서 인증 검사와 하위 페이지 렌더링을 담당한다. [TanStack Router 공식 파일 명명 규칙](https://tanstack.com/router/latest/docs/routing/file-naming-conventions)

비로그인 또는 만료된 세션으로 보호 페이지를 열면 `/login?redirect=...`로 이동한다. 로그인 성공 후 검증한 앱 내부 주소로 복귀한다. 서버는 별도로 JWT 서명을 검증하므로 프런트엔드의 JWT 디코딩은 권한 검증을 대체하지 않는다.

## API 연결

| 화면 | 요청 | 요청 데이터 / 응답 사용 |
| --- | --- | --- |
| 마이페이지 | `GET /favorites` | 로그인 계정의 `{movieId}[]` 조회 후 TMDB 상세 캐시로 카드 구성 |
| 영화 상세 | `GET /favorites/{movieId}` | `{movieId,isFavorite}`로 버튼 상태 결정 |
| 목록·상세 | `POST /favorites` | `{movieId}` 전송, 성공 후 상태와 목록 캐시 갱신 |
| 목록·상세·마이페이지 | `DELETE /favorites/{movieId}` | 성공 후 선택 해제 및 목록 제거 |
| 영화 상세 | `GET /members/{memberId}/ratings` | 내 평점 중 현재 `movieId`에 해당하는 항목 선택 |
| 영화 상세 | `POST /ratings` | `{movieId,score,comment}` 전송 |
| 영화 상세 | `PATCH /ratings/{ratingId}` | 기존 응답의 `ratingId`와 `{score,comment}` 사용 |
| 영화 상세 | `DELETE /ratings/{ratingId}` | 기존 응답의 `ratingId`로 삭제 후 새 등록 폼 표시 |

API 공통 응답은 `{isSuccess,code,message,result}`다. 상세 계약은 [백엔드 저장소의 NestJS 찜 컨트롤러](https://github.com/terikeipapi/umc-backend/blob/main/src/movie/favorite.controller.ts), [평점 컨트롤러](https://github.com/terikeipapi/umc-backend/blob/main/src/movie/rating.controller.ts)에 맞췄다.

선행 기능으로 `POST /auth/login`, `GET /members/me`, `PATCH /members/me`도 연결했다. 액세스 토큰만 브라우저에 저장하고 비밀번호는 저장하지 않는다. 회원 요청에만 Bearer 토큰을 붙이고 TMDB에는 회원 토큰을 전달하지 않는다.

## 상태 변경과 오류 처리

- 찜 키는 `["favorites",memberId,...]`, 평점 키는 `["ratings",memberId]`, 회원 키는 `["member",memberId,"me"]`로 분리한다.
- 변경 중 버튼을 비활성화하고 자동 재시도를 하지 않는다. 서버 성공 응답으로 관련 캐시를 갱신한 뒤 목록을 재검증한다.
- 평점은 1~5의 정수, 후기는 최대 500자다. 평점 조회에 실패하면 등록·수정 판단을 추측하지 않고 재조회하게 한다.
- 등록·수정 실패 시 사용자가 입력한 별점과 후기를 유지한다. 409 등 충돌 시 서버 상태를 다시 조회한다.
- 로그아웃·토큰 만료·현재 토큰의 401은 개인 쿼리를 취소·제거하고 인증 상태를 갱신한다. 이전 세션의 늦은 응답은 현재 계정에 반영하지 않는다.
- 찜한 영화의 TMDB 조회만 실패해도 찜 항목은 유지하고 해당 항목에서 재조회·찜 해제를 지원한다.

## 실행

백엔드의 기존 DB·JWT 환경 설정은 `study`의 설정을 사용한다.

```sh
# C:\umc\study
npm.cmd run week8:db
npm.cmd run start:dev

# 다른 터미널: C:\umc\umcine
pnpm.cmd dev
```

회원 API 기본 주소는 `http://localhost:3000`, 프런트엔드는 `http://localhost:5173`이다. TMDB 토큰 설정은 루트 README를 참고한다. `week8:db`는 기존 데이터를 유지하면서 `favorite` 테이블을 추가한다. 계정·영화 쌍의 UNIQUE 제약과 서버 인증으로 중복·계정 간 수정을 방지한다.

## 검증 결과

| 위치 | 명령 | 결과 |
| --- | --- | --- |
| `umcine` | `pnpm.cmd type-check` | 통과 |
| `umcine` | `pnpm.cmd test` | 69개 통과, 실패·건너뜀 0개 |
| `umcine` | `pnpm.cmd build` | 통과, 라우트 트리 재생성 및 프로덕션 번들 생성 |
| `study` | `npm.cmd run week8:db` | 기존 데이터 유지, 찜 테이블 준비 완료 |
| `study` | `npm.cmd run build` | 통과 |
| `study` | `npm.cmd test` | 단위 테스트 1개 통과 |
| `study` | `npm.cmd run test:e2e` | 187개 통과, 이 중 새 찜 API 검증 24개 |
| `study` | `npm.cmd run lint` | 종료 코드 0, 기존 `test/books.db-verification.mjs:294` 타입 경고 2개 |
| `study` | `npm.cmd run week8:verify` | 실제 로컬 HTTP + MySQL 검증 33건 통과 |

프런트엔드 자동 테스트는 실제 TypeScript 모듈·QueryClient·라우터·React 컴포넌트를 사용하되 HTTP 응답은 모의 응답이다. 로그인·회원정보 수정, 보호 라우트, 401·만료, 찜·평점 CRUD, 캐시 동기화, 중복 요청 차단, 409 충돌 시 작성 내용 보존을 검증했다. 실제 생성 라우트 트리에서 두 마이페이지의 부모도 검사했다.

백엔드 E2E는 실제 NestJS HTTP 처리·JWT·검증·서비스와 모의 DB를 사용한다. 별도의 `week8:verify`는 **실제 로컬 서버와 MySQL**에서 로그인·내 정보 조회, 요청된 찜·평점 API 전체와 계정 간 수정 차단을 검증했다. 검증용 회원은 생성된 ID와 이메일을 함께 확인한 뒤 정리했다. 토큰·비밀번호를 제외한 [HTTP 검증 기록](https://github.com/terikeipapi/umc-backend/blob/main/output/week8/api-verification.json)에 요청별 결과를 남겼다.

이번 작업에서는 실제 브라우저 시각 검수 및 실제 TMDB 응답과 회원 서버를 함께 사용하는 브라우저 E2E는 수행하지 않았다. TMDB 기존 API·쿼리 회귀 검증은 모의 응답으로 통과했다.

관련 문서: [트러블슈팅 보고서](TROUBLESHOOTING.md)

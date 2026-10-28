# UMCine

TMDB API의 인기 영화 목록, 영화 검색, 상세 정보를 사용하는 React 앱입니다.

## 실행

`.env.example`을 `.env.local`로 복사하고 TMDB 계정의 **Settings → API → API Read Access Token**을 입력하세요.

```dotenv
VITE_TMDB_ACCESS_TOKEN=발급받은_API_Read_Access_Token
```

v3 API key를 사용한다면 토큰 대신 `VITE_TMDB_API_KEY`를 설정하세요. 둘 다 설정하면 토큰을 우선합니다. 값을 변경한 뒤 개발 서버를 재시작하세요. `.env.local`은 Git에서 제외됩니다. Vite의 `VITE_` 값은 브라우저 번들에 포함되므로 개인 비밀번호나 TMDB 쓰기 권한을 가진 비밀값은 넣지 마세요.

```sh
pnpm install
pnpm dev
pnpm type-check
pnpm test
pnpm build
pnpm preview
```

## 요청 구조

- `src/api/popular-fetch.ts`: 순수 `fetch` 인기 영화 요청. `response.ok`를 검사합니다.
- `src/api/tmdb.ts`: 공통 ky v1 인스턴스. API 주소, 한국어, 인증, 10초 제한을 적용합니다.
- `src/api/movies.ts`: 인기 목록 `/movie/popular`, 검색 `/search/movie`, 상세 `/movie/{id}` 요청과 화면 데이터 변환.
- `src/hooks/use-movie-request.ts`: 로딩·성공·오류, 재시도, 화면 이동 시 취소, 늦은 응답 차단.

빈 검색어는 요청하지 않습니다. 상세 404/잘못된 ID는 찾을 수 없는 영화로 표시하고, 인증·요청 제한·네트워크 오류는 재시도 가능한 오류로 표시합니다. 이미지·줄거리·개봉일·상영 시간 누락에는 대체 표시를 사용합니다.

목록/검색의 페이지 번호와 검색어는 URL에 저장됩니다. 북마크는 실제 TMDB ID로 `umcine-tmdb-bookmark-store`에 저장합니다. 샘플 데이터 ID가 저장된 기존 `umcine-bookmark-store`는 보존되며 새 영화에 적용되지 않습니다.

## Network 패널에서 순수 fetch 확인

1. 인증값을 설정하고 `pnpm dev`를 실행하세요.
2. Chrome 개발자 도구의 **Network**를 열고 Fetch/XHR로 필터링하세요.
3. `http://localhost:5173/?tmdb-fetch=1`로 접속하세요.
4. `movie/popular` 중 Initiator가 `popular-fetch.ts`인 요청을 선택하세요. 순수 fetch 실습은 React effect 밖에서 한 번 실행됩니다. 목록 화면 자체의 ky 요청은 별도 요청입니다.
5. Headers에서 GET, `language=ko-KR`, `page=1`, 인증을 확인하고 Response에서 `page`, `results`, `total_pages`, `total_results`를 확인하세요. Console에는 실습 응답이 정보 로그로 표시됩니다.

`tmdb-fetch=1` 실습은 개발 모드에서만 동작하며 프로덕션 빌드에는 포함되지 않습니다. 인증값이 없으면 실습과 화면은 설정 안내를 표시하고 인증 없는 요청을 보내지 않습니다.

## 화면 수동 확인

각 주소를 주소창에 직접 입력하고 새로고침하세요.

- `/`, `/?page=2`: 인기 영화와 실제 페이지 이동
- `/search`: 입력 안내, 요청 없음
- `/search?query=기생충`, `/search?query=1917&page=2`: 검색어·페이지 유지
- `/search?query=zzzzzzzzzzzzzzzzzzzzzzzzzz`: 빈 결과
- `/movies/550`: 목록 방문 없이도 상세 정보 요청
- `/movies/abc`, 존재하지 않는 TMDB ID: 영화 없음

Network의 느린 연결로 로딩 화면을, 오프라인 전환 후 다시 시도로 오류와 복구를 확인하세요. Console에서 오류를 확인하세요. 북마크를 누른 뒤 상세와 목록, 새로고침에서도 같은 TMDB ID가 유지되는지 확인하세요.

`pnpm preview`도 위 주소들의 직접 접근을 지원합니다. 외부 정적 호스팅에서는 `/search`, `/movies/*` 등의 요청이 `index.html`로 연결되도록 SPA fallback을 설정해야 합니다.

## 검증 기록

`pnpm type-check`, `pnpm test`(10개), `pnpm build`가 모두 통과했습니다. 프로덕션 미리보기에서 목록·검색·상세 주소 6개 및 출처 로고·대체 포스터의 HTTP 200 응답을 확인했습니다. 이는 주소별 HTML 응답 확인이며 브라우저에서의 렌더링 확인과는 구분됩니다.

API 통합 테스트는 실제 TypeScript 모듈과 모의 TMDB 응답을 사용합니다. 인증, 검색어 인코딩, 페이지, 상세 변환, 빈 결과, 누락 이미지, 404/429, 요청 취소, 인증 누락을 검증합니다. 실제 서버의 성공 응답을 증명하는 테스트는 아닙니다.

이번 작업 환경에는 TMDB 인증값과 별도 디자인 링크가 제공되지 않았습니다. 출처 표기는 기존 화면의 하단에 공식 TMDB 로고·링크·필수 고지문을 추가했습니다. 실제 API 성공 응답과 디자인 일치 여부는 인증값/디자인 제공 후 확인이 필요합니다. 브라우저 자동화는 Windows에서 현재 URL을 확인하지 못해 중단되어, Network·Console·주소별 새로고침의 브라우저 실측은 완료하지 못했습니다.

## 출처

TMDB 공식 로고와 고지문은 [TMDB attribution 안내](https://developer.themoviedb.org/docs/faq)를 따릅니다. 로고 원본은 [TMDB 공식 CDN](https://www.themoviedb.org/assets/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg)에서 저장했습니다.

This product uses the TMDB API but is not endorsed or certified by TMDB.

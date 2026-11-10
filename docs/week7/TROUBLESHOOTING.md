# 7주차 트러블슈팅 보고서

작성일: 2026년 11월 10일(한국 시간)

대상: `C:\umc\umcine`의 로그인·내 정보·회원가입 화면 구현과 검증

관련 자료: [필수 미션 기록](MISSION.md)

이번 구현에서 실제로 발생한 테스트·설치 문제 3건을 오류 문구, 원인, 해결, 검증 결과, 배운 점 순서로 정리했다. 아래 수정은 앞선 구현 과정에서 적용했으며, 이번 보고서 작성에서는 애플리케이션과 테스트 코드를 변경하지 않았다.

| 항목 | 상태 | 확인 근거 |
| --- | --- | --- |
| DOM 테스트에서 서버용 라우터 모듈 선택 | 해결 | DOM 동작 테스트 5개 통과 |
| 생성 ID를 고정값으로 가정한 SSR 테스트 | 해결 | 검증·저장소·SSR 테스트 10개 통과 |
| jsdom 설치 중 npm 내부 오류 | pnpm으로 설치 완료, npm 내부 원인은 미확정 | jsdom 31.0.0 설치 및 테스트 실행 성공 |
| Figma 원본 대조 | 확인 대기 | 연결 도구의 편집 권한 오류 |
| 실제 브라우저 시각 검수 | 확인 대기 | 브라우저 도구의 URL 판별 실패 |

## 이슈 1. DOM 테스트에서 라우터 초기화 오류 발생

### 이슈

jsdom에서 실제 로그인·내 정보 화면을 마운트하려고 할 때, 페이지별 입력 검증에 도달하기 전에 라우터 내부 오류가 발생했다. 당시 확인한 오류 문구는 다음과 같다.

```text
TypeError: Cannot read properties of undefined (reading '0')
```

오류 위치는 설치된 `@tanstack/react-router`의 `Matches.js`였다. 테스트에서 `router._rendered`가 초기화되지 않은 상태로 참조되는 것을 확인했다.

### 원인

설치된 `@tanstack/router-core` 1.171.33의 `./isServer`는 `package.json`의 조건부 export에 따라 서로 다른 파일로 해석된다. Node.js의 조건부 export는 실행 조건에 따라 패키지 진입점을 선택한다. [Node.js 조건부 export 공식 문서](https://nodejs.org/api/packages.html#conditional-exports)

| 선택 조건 | 설치된 패키지의 파일 | 주요 값 |
| --- | --- | --- |
| `browser` | `dist/esm/isServer/client.js` | `isServer = false` |
| `node` | `dist/esm/isServer/server.js` | `NODE_ENV === "test"`이면 `undefined`, 그 외에는 `true` |

당시 테스트는 Node.js에서 서버용 export를 선택했고, jsdom의 `document`를 만드는 것만으로 Node.js의 모듈 해석 조건이 바뀌지는 않았다. 서버용 분기에서는 `Transitioner`가 생략되지만, ReactDOM으로 마운트한 테스트에서는 효과가 실행되어 초기화되지 않은 배열을 읽었다.

설치된 소스에서 확인한 연결 지점은 다음과 같다.

- `Transitioner.js`: `router._rendered ??= []`로 배열을 준비한다.
- `Matches.js`: 해당 배열을 `acknowledgement`로 참조하고 효과에서 `acknowledgement[0]`을 읽는다.

### 해결

DOM 테스트에서만 `@tanstack/router-core/isServer`를 해석할 때 `browser` 조건을 추가했다. 훅 등록 후 라우터를 동적으로 import하고 테스트 종료 시 훅을 해제했다. 이 순서는 훅 적용 대상 모듈을 등록 이후에 로드하도록 하기 위한 것이다. [Node.js 모듈 훅 공식 문서](https://nodejs.org/api/module.html#moduleregisterhooksoptions)

[적용 코드: auth-interactions.test.mjs](../../tests/auth-interactions.test.mjs)

```js
clientResolver = registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier, specifier === "@tanstack/router-core/isServer"
      ? { ...context, conditions: ["browser", ...context.conditions] }
      : context);
  },
});
routing = await import("@tanstack/react-router");
```

정리 단계에서는 `clientResolver?.deregister()`를 호출한다. 이 설정은 테스트 파일에만 있으며, 애플리케이션의 라우터 코드와 설치 패키지 내부 파일은 수정하지 않았다.

### 검증 결과

DOM 동작 테스트 5개가 통과했다. 로그인 입력과 비밀번호 표시 전환, 프로필 저장·취소와 페이지 이동, 회원가입 중복 확인·재시도·연속 제출 방지를 실제 컴포넌트 이벤트로 확인했다.

### 배운 점

jsdom의 DOM 준비와 패키지의 실행 환경 선택은 별도로 확인해야 한다. 패키지 내부에서 오류가 발생하면 선택된 export와 초기화 경로를 확인하고, 테스트가 대상 코드의 실행 환경을 제대로 구성했는지 점검한다.

## 이슈 2. React 생성 ID를 고정값으로 예상해 SSR 테스트 실패

### 이슈

로그인과 내 정보 수정 화면의 SSR 테스트 2개가 이메일 레이블을 확인하는 단계에서 실패했다. 당시 오류 문구는 다음과 같다.

```text
AssertionError [ERR_ASSERTION]: The input did not match the regular expression /<label[^>]*for="email"[^>]*>이메일/. Input:
```

실제 렌더링 결과에는 다음과 같은 레이블이 있었다.

```html
<label class="field-label" for="_R_om_">이메일</label>
```

### 원인

[MemberField 컴포넌트](../../src/components/auth/member-field.tsx)는 `useId()`로 ID를 만들고 같은 값을 레이블의 `htmlFor`와 입력의 `id`에 연결한다. `name="email"`이라는 사실이 `id="email"`을 뜻하지 않는다. React의 `useId`는 접근성 속성 연결에 사용할 고유 ID를 생성한다. [React useId 공식 문서](https://react.dev/reference/react/useId)

기존 테스트는 생성된 ID의 문자열을 `email`로 고정해 예상했다. 컴포넌트의 레이블 연결은 올바른 상태였고, 실패 원인은 테스트의 가정이었다.

### 해결

[labeledInput 헬퍼](../../tests/member-preview.test.mjs)를 사용해 표시된 레이블의 `for` 값을 얻고, 해당 `name`의 입력을 찾아 두 속성의 관계를 검사하도록 변경했다.

```js
assert.equal(input.match(/\bid="([^"]+)"/)?.[1], labelMatch[1]);
```

ID 문자열의 형태를 고정하지 않고 레이블과 입력이 정확히 연결되어 있는지를 확인한다. 애플리케이션의 생성 ID 구현은 유지했다.

### 검증 결과

검증·저장소·SSR 테스트 10개가 통과했다. 로그인·조회·수정 화면의 직접 렌더링, 레이블 연결, 비밀번호 가림, 읽기 전용 이메일과 초기 버튼 비활성화를 확인했다.

### 배운 점

자동 생성된 값을 검사할 때는 사용자가 의존하는 관계와 동작을 기준으로 검증한다. ID 생성 규칙이 바뀌더라도 레이블과 입력의 연결이 유지되면 테스트도 통과해야 한다.

## 이슈 3. jsdom 개발 의존성 설치 중 npm 내부 오류 발생

### 이슈

기존 pnpm 프로젝트에서 DOM 테스트용 jsdom을 다음 명령으로 설치하려다가 실패했다.

```powershell
npm.cmd install --save-dev jsdom --ignore-scripts --cache C:/umc/umcine/.tmp/npm-cache
```

실행 로그에 남은 오류와 첫 스택 프레임은 다음과 같다.

```text
TypeError: Cannot read properties of null (reading 'matches')
    at Link.matches (C:\Program Files\nodejs\node_modules\npm\node_modules\@npmcli\arborist\lib\node.js:1184:41)
```

원본 로그: `.tmp/npm-cache/_logs/2026-11-10T08_43_29_200Z-debug-0.log`

당시 환경: Node.js 24.21.0, npm 11.19.0. 이 로그는 작업용 캐시에 있어 Git 추적 대상은 아니다.

### 원인

로그는 npm의 의존성 트리를 구성하는 Arborist 내부에서 오류가 발생했음을 보여준다. 기존 `node_modules/.pnpm/csstype@3.2.3/...` 경로를 처리하던 기록도 확인했다.

여기까지는 관찰된 사실이며, npm 내부에서 왜 `null`이 만들어졌는지는 확정하지 않았다. 이 기록만으로 패키지 손상이나 npm·pnpm의 일반적인 비호환을 원인으로 단정할 수 없다.

### 해결

프로젝트에서 사용하던 pnpm으로 설치를 진행했다. 당시 성공한 명령은 다음과 같다.

```powershell
pnpm.cmd add -D jsdom --ignore-scripts --store-dir C:/umc/.pnpm-store
```

`-D`는 패키지를 개발 의존성으로 추가하는 옵션이다. 설치 후 `package.json`과 `pnpm-lock.yaml`에 jsdom 31.0.0이 반영되었다. [pnpm add 공식 문서](https://pnpm.io/cli/add#--save-dev--d--d)

### 검증 결과

pnpm 설치가 종료 코드 0으로 완료됐고, 설치한 jsdom을 사용한 DOM 테스트 5개와 전체 테스트 46개가 통과했다. npm 내부 오류를 고쳤다고 볼 수는 없으며, 기존 패키지 관리자로 설치 작업을 완료한 해결 사례다.

### 배운 점

의존성을 추가하기 전에 저장소의 lockfile과 기존 패키지 관리자를 확인한다. 설치 오류의 스택을 보존하고, 확인한 사실과 아직 규명하지 못한 내부 원인을 구분해 기록한다.

## 해결 후 회귀 검증

보고서 작성 중 `C:\umc\umcine`에서 `npm.cmd test`를 다시 실행했다.

```text
tests 46
pass 46
fail 0
cancelled 0
skipped 0
todo 0
```

위 코드는 이번 재실행 결과의 요약이다. DOM 동작 5개, 검증·저장소·SSR 10개, 회원 API 12개, 기존 영화 API·쿼리 회귀 19개를 포함한다. 회원·영화 API 테스트에는 모의 응답을 사용한다.

타입 검사와 프로덕션 빌드의 앞선 통과 기록은 [미션 기록](MISSION.md#최종-확인-결과)에 정리했다.

## 남은 검증 제한

다음은 앞선 구현에서 해결되지 않은 확인 항목이다. 자동 테스트 통과와 별도로 남겨 둔다.

| 항목 | 앞선 실행에서 확인한 내용 | 후속 확인 |
| --- | --- | --- |
| Figma 디자인 | 연결 도구가 편집 권한 부족 오류를 반환 | 접근 권한이 확보되면 크기·간격·색상을 원본과 대조 |
| 브라우저 시각 검수 | 도구가 현재 Windows 브라우저 URL을 판별하지 못해 중단 | 브라우저에서 직접 접근·새로고침·레이아웃·키보드 초점 확인 |

원문 오류 메시지와 수동 확인 순서는 [미션 기록의 디자인 확인 범위](MISSION.md#디자인-확인-범위)를 참고한다. 이번 보고서 작성에서는 브라우저나 Figma 연결을 다시 시도하지 않았다.

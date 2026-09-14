# REPORT

## 간단한 소개

`portfolio-site`는 Next.js App Router로 만든 포트폴리오다. 같은 콘텐츠(JSON)를
**테마 5개(design/classic/editorial/brutalist/cinematic)가 서로 다른 레이아웃/CSS로
렌더링**하는 것이 핵심 아키텍처 축이다.

콘텐츠와 표현을 zod 스키마 + 타입 레벨 매핑으로 엄격히 분리해, 어떤 테마를 골라도
같은 콘텐츠 계약을 어길 수 없게 만든 것이 구조적 특징이다. 그 위에 접근성(WCAG 2.2
AA)·성능 예산(Lighthouse, 번들 크기, INP)·시각 회귀까지 자동화된 검증 계층이 두껍게
얹혀 있다.

## 요청/데이터 흐름

```
[src/content/*.json] --content-loader.ts(zod 검증 + 참조 무결성 검사)--> [PortfolioContent]
                                                                                |
                                                                    page-context.ts / selectors.ts
                                                                                |
                                                          [view-models.ts] RouteViewModel
                                                     (route가 어떤 viewModel과 짝지어지는지
                                                      타입 레벨 매핑으로 정적 보장)
                                                                                |
                                          ?view=<designId> 쿼리 --> src/designs/config.ts --> 테마 선택
                                                                                |
                                                        registry.tsx (동적 import로 테마별 코드 스플리팅)
                                                                                |
                                ViewModelDesignRouteRequest로 route<->viewModel 바인딩
                                        (모든 테마가 공유하는 가장 중요한 타입 트릭)
                                                                                |
                              +------------------------------+------------------------------+
                              |                               |                              |
                        design/ 테마                    classic/ 테마              editorial/brutalist/cinematic
                    (if (route !== "x") return null      (같은 narrowing 패턴)         (as X 타입 단언 방식,
                     narrowing 방식)                                                    단일 파일당 하나의 트레이드오프)
```

## 메인 소스

**콘텐츠 계약 — `src/lib/`**

1. **`content-schema.ts`** — `src/content/*.json` 각각의 "정답 모양"을 zod 스키마로
   정의한다(`[INTV:ARCH]`). `nonEmptyString`/`contentId`/`color` 같은 원자적 규칙을
   한 곳에 모아 반복 사용하고(`[INTV:ARCH]`), `.refine()`으로 배열 안 중복 값을
   직접 검사한다(`[INTV:EDGE]`).
2. **`content-loader.ts`** — zod 검증 + 파일 간 참조 무결성 검사(예: 프로젝트가
   참조하는 기술 스택 id가 실제로 존재하는지)를 한다(`[INTV:ARCH]`). 내부 링크
   (`href`가 `/`로 시작)가 실제 활성 라우트를 가리키는지도 검사하고
   (`[INTV:EDGE]`), 상대 경로 문자열은 그대로 URL 생성자에 못 넣는다(`[TRAP]`).
   모듈이 처음 import되는 순간 모든 JSON 검증이 실행된다(`[INTV:ARCH]`, 모듈
   최상위 호출).
3. **`content-readiness.ts`** — 이 저장소가 "재사용 가능한 템플릿"이라는 전제
   위에서(`[INTV:ARCH]`), template/production 모드를 판별한다. 예제 URL/placeholder
   가 실제 배포에 남아있지 않은지 RFC 2606 예약 도메인(`example.com` 등)으로
   재귀적으로 스캔한다(`[INTV:EDGE]`, 여러 곳).
4. **`site-metadata.ts`** — SEO/OG/JSON-LD/robots/sitemap 생성을 한곳에 모으고
   (`[INTV:ARCH]`), 홈만 사이트 전체 타이틀을 그대로 쓰고 나머지는 "페이지 제목 |
   브랜드명" 형식이다(`[INTV:ARCH]`). `<script>` 브레이크아웃을 막는 수동
   이스케이프가 핵심 보안 지점이다(`components/portfolio/structured-data.tsx`와
   함께 봄).

**콘텐츠 → 뷰모델 변환 — `src/lib/portfolio/`**

5. **`content.ts`**, **`page-context.ts`**, **`selectors.ts`** — 원본 콘텐츠에서
   라우트별로 필요한 조각만 뽑아내는 selector 계층이다. `satisfies`로 값의 추론된
   타입을 유지하면서 계약을 검사하고(`[INTV:ARCH]`), 날짜 문자열(ISO라 사전순=
   시간순)로 1차 정렬한다(`[TRAP]`). 템플릿 리터럴 타입으로 `/projects/${string}`
   같은 동적 경로까지 좁히고(`[INTV:ARCH]`), Next.js 최신 버전에서 `searchParams`
   가 Promise로 바뀐 걸 `await`로 풀어야 한다(`[TRAP]`). 등록되지 않은 기술 스택
   id가 들어와도 앱이 죽지 않게 방어한다(`[INTV:EDGE]`).
6. **`view-models.ts`** — **이 프로젝트에서 가장 정교한 타입 레벨 코드**.
   `PortfolioContent`(원본 전체)를 그대로 넘기지 않고 라우트별로 필요한 뷰모델만
   만들며(`[INTV:ARCH]`), `route: "home"`처럼 고정된 리터럴 필드로 판별 유니온을
   구성한다(`[INTV:ARCH]`). 모든 라우트 뷰모델이 공통으로 갖는 필드를 따로 묶고
   (`[INTV:ARCH]`), `slice(-4)`로 최신 4개만 취하는 지점(`[TRAP]`)과 이 라우트에서
   안 쓰는 필드를 `never`로 선언하는 지점(`[TRAP]`)이 있다.

**테마 시스템 — `src/designs/`**

7. **`types.ts`**, **`config.ts`**, **`registry.tsx`** — `ViewModelDesignRouteRequest`
   가 route↔viewModel 바인딩의 핵심이자 가장 중요한 재구현 포인트다(`[TRAP]`).
   5개 테마의 식별자/디자인을 레지스트리로 관리하고(`[INTV:ARCH]`), 각 테마
   폴더를 `() => import(...)` 형태로 등록해 코드 스플리팅한다(`[INTV:PERF]`).
   `props.viewModel.route === "project-detail"`로 비교하는 순간 TS가 그 분기
   안에서 타입을 좁힌다(`[INTV:ARCH]`).
8. **5개 테마 폴더** (`design/`, `classic/`, `editorial/`, `brutalist/`,
   `cinematic/`) — 각 폴더가 같은 `RouteViewModel` 계약을 서로 다른 방식으로
   소비하는 게 볼거리다. `classic/home-route.tsx`는 `if (content.route !== "x")
   return null` narrowing 패턴의 원본이고(`[INTV:ARCH]`, 다른 형제 파일들이 이
   패턴을 반복), 홈 화면 섹션 순서는 코드가 아니라 콘텐츠 데이터가 정한다
   (`[INTV:ARCH]`). `editorial/editorial-route.tsx`는 8개 라우트 전부와 공용
   셸을 한 파일에 담고(`[INTV:ARCH]`), narrowing 대신 `as X` 타입 단언을 쓰는
   의도적 트레이드오프다(`[INTV:TRADE_OFF]`) — 두 방식을 비교해서 읽으면 각각의
   장단점이 뚜렷이 보인다.

**페이지 라우팅 — `src/app/`**

9. **`layout.tsx`** — App Router의 최상위 레이아웃으로 모든 페이지를 감싸고
   (`[INTV:ARCH]`), `next/font/local`로 로컬 폰트를 최적화 로드하며
   (`[INTV:PERF]`), 한국어 사이트일 때만 용량이 큰 한글 세리프 폰트를 적용한다
   (`[INTV:PERF]`). `generateMetadata`가 `<head>`를 만들고(`[INTV:ARCH]`),
   리버스 프록시를 거치면 `x-forwarded-*` 헤더로 원래 host를 복원해야 한다
   (`[INTV:EDGE]`).
10. **`globals.css`** — Tailwind v4는 별도 설정 파일 대신 CSS 안에서 `@import`/
    `@theme`로 설정하고(`[INTV:ARCH]`), `[data-site-design]` 속성으로 React
    리렌더 없이 테마를 전환한다(`[INTV:ARCH]`). `@theme` 블록의 커스텀 프로퍼티는
    선택자 안에서 선언하면 자동 유틸리티 클래스가 생성되지 않는다(`[TRAP]`).
    `prefers-reduced-motion`에 대응해 애니메이션을 끈다(`[INTV:EDGE]`).
11. **`not-found.tsx`**, **`robots.ts`**, **`sitemap.ts`** — 파일 경로/이름
    자체가 Next.js의 예약 컨벤션이고(`[INTV:ARCH]`, 셋 다), 404는 다른 페이지와
    달리 `renderDesignRoute`(테마 선택)를 거치지 않는다(`[INTV:ARCH]`). 404가
    검색엔진에 색인되지 않도록 막는다(`[INTV:EDGE]`).
12. **`about/page.tsx`**, **`projects/[projectId]/page.tsx`** — 파일 경로 자체가
    라우트를 정의하는 App Router 관례고(`[INTV:ARCH]`), `[projectId]`는 동적
    라우트 문법이다(`[INTV:ARCH]`). `isSitePageEnabled`로 콘텐츠 설정(site.json)이
    페이지 노출을 켜고 끌 수 있고(`[INTV:ARCH]`), `generateStaticParams`로 빌드
    시점에 가능한 값 목록을 미리 만든다(`[INTV:PERF]`). `params`가 Promise인 건
    Next.js 최신 버전의 변경이다(`[TRAP]`).

**공용 컴포넌트 — `src/components/portfolio/`**

13. **`site-shell.tsx`**, **`design-switcher.tsx`**, **`design-switcher-close.tsx`**
    — 모든 페이지를 감싸는 공통 뼈대(스킵 링크 + 헤더 + `<main>`)이고
    (`[INTV:ARCH]`), 스킵 링크는 평소 화면 밖에 숨어 있다가 키보드 포커스를
    받으면 나타난다(`[INTV:EDGE]`). 디자인 전환 드롭다운은 `<details>`의
    open 속성으로 펼침/접힘을 다루고(`[INTV:EDGE]`), 바깥 클릭 시 `closest()`로
    조상 방향으로 올라가며 `<details>`를 찾아 닫는다(`[INTV:ARCH]`, `:scope >
    summary` 선택자 트랩 포함).
14. **`animated-terminal.tsx`**, **`journey-list.tsx`**, **`tech-icon.tsx`**,
    **`reveal.tsx`**, **`content-link.tsx`**, **`structured-data.tsx`** — 가짜
    터미널 타이핑 애니메이션은 타이핑→대기→지우기 3단계 상태 머신이고
    (`[INTV:ARCH]`), `prefers-reduced-motion`이면 건너뛴다(`[INTV:EDGE]`).
    `journey-list`는 같은 데이터를 두 레이아웃(단일/paired-centerline)으로
    그릴 수 있고(`[INTV:ARCH]`), 배열을 2개씩 묶는다(`[INTV:ARCH]`).
    `tech-icon`은 브랜드 로고(simple-icons)가 있으면 쓰고 없으면 폴백하는 2단계
    구조다(`[INTV:ARCH]`). `reveal.tsx`는 "as" prop으로 태그를 바꿔치기하는
    polymorphic 패턴이고(`[INTV:ARCH]`), 대문자 변수명이어야 JSX가 커스텀
    컴포넌트로 인식한다(`[TRAP]`). `content-link`는 내부/외부 링크를 분기해
    렌더링한다(`[INTV:ARCH]`). `structured-data`는 JSON-LD를
    `dangerouslySetInnerHTML`로 심는다(`[INTV:EDGE]`).

## 부가 소스 (검증 계층 — 이 프로젝트가 유독 두꺼운 부분)

- **`tests/e2e/site-matrix.ts`** — 테마×라우트 조합의 단일 진실 공급원(다른 스펙
  파일들이 전부 이걸 참조)(`[INTV:ARCH]`). 비활성화된 페이지는 제외하고
  (`[INTV:EDGE]`), 더미 origin으로 URL 생성자를 통과시킨다(`[TRAP]`).
- **`tests/e2e/accessibility.spec.ts`** — `@axe-core/playwright`로 자동 스캔하고
  (`[INTV:ARCH]`), 랜드마크(main/header/footer)가 정확히 하나씩인지 먼저
  확인한 뒤(`[INTV:EDGE]`) 스킵 링크를 실제 키보드 입력으로 검증한다
  (`[INTV:EDGE]`). 라우트를 여러 개 순회하는 테스트는 `test.slow()`로 표시한다
  (`[INTV:PERF]`).
- **`tests/e2e/visual.spec.ts`** — 스크린샷 회귀(`toHaveScreenshot`)이고
  (`[INTV:EDGE]`), `maxDiffPixelRatio: 0.01`로 완전 동일 대신 1% 오차를
  허용하며, 브라우저/뷰포트 조합마다 baseline을 따로 둔다(`[INTV:EDGE]`).
- **`tests/e2e/performance.spec.ts`** — "성능을 재는" 게 아니라 "성능에 나쁜
  일이 몰래 안 일어나는지"를 검증한다(`[INTV:PERF]`). `waitForTimeout`으로
  "아무 일도 안 일어남"을 확인하는 음성 증명 패턴이다(`[TRAP]`).
- **`tests/e2e/interaction-performance.spec.ts`** — `PerformanceObserver` Event
  Timing으로 직접 만든 INP 측정 하네스다(`[INTV:ARCH][INTV:PERF]`). 이중
  `requestAnimationFrame` + `setTimeout(0)`으로 "다음 페인트까지 기다림"을
  구현하고(`[INTV:PERF]`), `event.isTrusted`로 진짜 사용자 입력만 잡는다
  (`[INTV:EDGE]`). 중앙값과 최댓값을 각각 assert한다.
- **`tests/e2e/portfolio.spec.ts`** — 5개 테마 모두가 "같은 콘텐츠"를
  렌더링하는지 검증하는 핵심 회귀 스위트다(`[INTV:ARCH]`).
  `expectSharedRouteEvidence`가 라우트별 콘텐츠 대조 테이블이고, exact/contained
  매칭을 분리해둔 이유가 있다(`[INTV:TRADE_OFF]`).
- **`scripts/route-budgets.mjs`** — Next.js 내부 RSC 클라이언트 레퍼런스
  매니페스트를 직접 파싱해 라우트별 JS/CSS 전송량으로 번들 크기 CI 게이트를
  만든다(`[INTV:PERF]`, 정식 JSON이 아닌 포맷을 다루는 `[TRAP]` 포함).
- **`scripts/summarize-lighthouse.mjs`** — Lighthouse 원시 리포트 여러 개를
  평균이 아닌 중앙값으로 압축해 커밋 가능한 baseline JSON을 만든다
  (`[INTV:PERF]`, 점수가 0~1 소수인 `[TRAP]` 포함, `[FLOW]` 파싱→중앙값 계산
  순서).
- **`scripts/verify-container-runtime.mjs`** — Docker 프로덕션 이미지의
  non-root 실행이 실제 런타임에도 적용됐는지 `docker inspect`로 검증한다
  (`[INTV:ARCH]`). 이미지/컨테이너 이름에 PID+랜덤 hex를 섞어 매 실행마다
  충돌 없이 고유하게 만든다(`[INTV:EDGE]`).
- **`.github/workflows/ci.yml`** — 검증 성격이 다른 여러 job으로 나누는 대신
  job 하나로 15개 스텝을 직렬로 이어 저렴한 검사부터 비싼 검사까지 순서대로
  돈다(`[INTV:ARCH]`). `npm ci`(install이 아님)를 쓰고(`[TRAP]`), Lighthouse가
  브라우저를 새로 받지 않도록 이전 스텝의 설치를 재사용한다(`[TRAP]`).

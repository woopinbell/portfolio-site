# 읽는 순서 가이드 (portfolio-site)

> 이 문서는 코드 주석이 아니라, 이미 곳곳에 박아둔 `[INTV:ARCH]` 등 주석들을 "어디서부터 읽어야
> 전체 그림이 잡히는가" 관점에서 엮은 내비게이션 문서다. 실제 설계 이유는 항상 코드 옆 `[INTV]`
> 주석에 있고, 여기는 그 주석들을 찾아가는 지도 역할만 한다.

## 30초 피치

Next.js App Router 포트폴리오 — 같은 콘텐츠(JSON)를 **테마 5개(design/classic/editorial/
brutalist/cinematic)가 서로 다른 레이아웃/CSS로 렌더링**하는 것이 핵심 아키텍처 축이다. 콘텐츠와
표현을 zod 스키마 + 타입 레벨 매핑으로 엄격히 분리해, 어떤 테마를 골라도 같은 콘텐츠 계약을
어길 수 없게 만들었다. 그 위에 접근성(WCAG 2.2 AA)·성능 예산(Lighthouse, 번들 크기, INP)·
시각 회귀까지 자동화된 검증 계층이 두껍게 얹혀 있다.

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
                              +------------------------------+------------------------------+
                              |                               |                              |
                        design/ 테마                    classic/ 테마              editorial/brutalist/cinematic
                    (if (route !== "x") return null      (같은 narrowing 패턴)         (as X 타입 단언 방식,
                     narrowing 방식)                                                    단일 파일당 하나의 트레이드오프)
                              |
                    ViewModelDesignRouteRequest로 route<->viewModel 바인딩 (가장 중요한 타입 트릭)
```

## 읽는 순서

### 1. 콘텐츠 계약 — `src/lib/`
- `content-schema.ts` — 모든 콘텐츠 JSON의 zod 스키마. 여기서부터 "이 사이트가 표현할 수 있는
  데이터의 전체 범위"가 정해진다.
- `content-loader.ts` — zod 검증 + 파일 간 참조 무결성 검사(예: 프로젝트가 참조하는 기술 스택
  id가 실제로 존재하는지).
- `content-readiness.ts` — 템플릿(데모) 모드 vs 프로덕션 모드 판별, 예제 URL/placeholder가
  실제 배포에 남아있지 않은지 RFC 2606 예약 도메인으로 스캔.
- `site-metadata.ts` — SEO/OG/JSON-LD/robots/sitemap 생성. `<script>` 브레이크아웃을 막는
  수동 이스케이프(`\uXXXX`)가 핵심 보안 지점.

### 2. 콘텐츠 → 뷰모델 변환 — `src/lib/portfolio/`
- `content.ts`, `page-context.ts`, `selectors.ts` — 원본 콘텐츠에서 라우트별로 필요한 조각만
  뽑아내는 selector 계층.
- `view-models.ts` — **이 프로젝트에서 가장 정교한 타입 레벨 코드**: `RouteViewModel`이
  매핑 타입 + 인덱스 접근으로 "route 필드 값이 어떤 viewModel과 짝지어지는지"를 정적으로
  보장하는 판별 유니온 트릭.

### 3. 테마 시스템 — `src/designs/`
- `types.ts` — `ViewModelDesignRouteRequest` (route↔viewModel 바인딩의 핵심,
  `[INTV:TRAP]`로 표시된 가장 중요한 재구현 포인트).
- `config.ts` — `?view=` 쿼리 파싱, 알 수 없는 테마 값이 왔을 때 editorial로 폴백하는 방어
  로직.
- `registry.tsx` — 테마별 동적 `import()`로 코드 스플리팅(안 쓰는 테마의 JS를 안 받아오게).
- 5개 테마 폴더(`design/`, `classic/`, `editorial/`, `brutalist/`, `cinematic/`) — `classic/`의
  `home-route.tsx`가 `if (content.route !== "x") return null` narrowing 패턴의 원본(다른
  형제 파일들이 이 패턴을 그대로 반복). `editorial/`은 반대로 narrowing 대신 `as X` 타입
  단언을 쓰는 의도적 트레이드오프 — 두 방식을 비교해서 읽으면 각각의 장단점이 뚜렷이 보인다.

### 4. 페이지 라우팅 — `src/app/`
`generateMetadata`/`generateStaticParams`, `not-found.tsx`/`robots.ts`/`sitemap.ts` 같은 Next.js
예약 파일들, `globals.css`의 Tailwind v4 테마 토큰 아키텍처(`@theme inline`, `[data-site-design]`
속성으로 React 리렌더 없이 테마 전환).

### 5. 검증 계층 — 이 프로젝트가 유독 두꺼운 부분
- `tests/e2e/site-matrix.ts` — 테마×라우트 조합의 단일 진실 공급원(다른 스펙 파일들이 전부
  이걸 참조).
- `tests/e2e/accessibility.spec.ts` — axe-core 자동 스캔 + 키보드 스킵 링크 수동 시나리오.
- `tests/e2e/visual.spec.ts` — 스크린샷 회귀(애니메이션/폰트/이미지 로딩을 먼저 안정화).
- `tests/e2e/performance.spec.ts` — prefetch/폰트 로딩이 의도대로 안 일어나는지 네트워크
  요청을 가로채 검증(음성 증명 — waitForTimeout으로 "안 일어남"을 확인).
- `tests/e2e/interaction-performance.spec.ts` — PerformanceObserver Event Timing으로 직접 만든
  INP(Interaction to Next Paint) 측정 하네스. 중앙값과 최댓값을 각각 assert하는 이유까지.
- `tests/e2e/portfolio.spec.ts` — 5개 테마 모두가 "같은 콘텐츠"를 렌더링하는지 검증하는 핵심
  회귀 스위트. `expectSharedRouteEvidence`가 라우트별 콘텐츠 대조 테이블.
- `scripts/route-budgets.mjs` — Next.js 내부 RSC 클라이언트 레퍼런스 매니페스트를 직접 파싱해
  번들 크기 CI 게이트를 만든 커스텀 스크립트.
- `scripts/summarize-lighthouse.mjs` — Lighthouse 원시 리포트 여러 개를 중앙값으로 압축해
  커밋 가능한 baseline JSON으로 만드는 스크립트.
- `scripts/verify-container-runtime.mjs` — Docker 프로덕션 이미지의 non-root 실행이 실제
  런타임에도 적용됐는지 `docker inspect`로 검증.

### 6. CI — `.github/workflows/ci.yml`
15개 스텝이 저렴한 검사(lint/typecheck)부터 비싼 검사(빌드/E2E/Lighthouse)까지 직렬로 이어지는
단일 job. GitHub Actions 문법 자체 설명은 `../miniRT/.github/workflows/ci.yml`에 모아뒀다.

## 재구현 시 가장 먼저 마주칠 함정

- `RouteViewModel`의 매핑 타입 트릭 없이 route/viewModel을 느슨하게 연결하면, 테마 컴포넌트가
  엉뚱한 라우트의 viewModel을 받아도 컴파일 타임에 못 잡는다.
- 테마 폴더마다 콘텐츠 selector를 새로 짜면, 한 테마만 특정 필드를 빠뜨리는 실수가 생긴다 —
  `src/lib/portfolio/selectors.ts` 하나를 모든 테마가 공유하는 이유.
- 주석/텍스트 안에 `*/`나 정규식이 기대하는 인접 패턴을 깨는 문자열이 섞이면(이 저장소에서
  실제로 발생했던 버그 — `bug-fix-report.md` 참고), 정적 검사 도구가 조용히 깨진다.

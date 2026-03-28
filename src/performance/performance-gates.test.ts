import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

// [INTV:ARCH] scripts/route-budgets.mjs: 이 프로젝트가 빌드 산출물의 JS/CSS 용량을 라우트별로
// 측정해 "이전 기준선보다 너무 많이 커지면 실패시키는" 자체 스크립트 — 그 안의 순수 함수들을
// 가져와 로직만 단위 테스트한다(실제 빌드를 매번 돌리지 않고도 예산 초과 판정 로직 자체가 맞는지
// 빠르게 확인 가능 — 실제 빌드 실행은 CI에서 훨씬 드물게, 느리게 검증된다).
import {
  BUDGET_GROWTH_FACTOR,
  evaluateRouteBudgets,
  parseClientReferenceManifest,
  type RouteBudgetBaseline,
  type RouteBundleMeasurement,
} from "../../scripts/route-budgets.mjs";

// [INTV:TRAP] createRequire: 이 프로젝트는 ESM(import/export) 기준인데,
// lighthouserc.cjs(CommonJS 설정 파일)와 package.json(순수 JSON)은 import 문으로 바로 불러오기
// 까다로운 형식이다 — createRequire로 이 파일 위치 기준의 옛 방식 require() 함수를 만들어내,
// 그 두 파일을 평범한 CommonJS 모듈처럼 읽어들인다(순수 ESM 프로젝트에서 CommonJS 설정 파일을
// 다뤄야 할 때 흔히 필요한 상호운용 트릭).
const require = createRequire(import.meta.url);
const lighthouseConfig = require("../../lighthouserc.cjs");
const packageJson = require("../../package.json");

describe("production build pipeline", () => {
  it("uses the verified webpack compiler path", () => {
    expect(packageJson.scripts.build).toBe("next build --webpack");
  });
});

// [INTV:ARCH] Lighthouse: 구글이 만든 웹페이지 품질 자동 측정 도구(성능/접근성/SEO 등을 0~1
// 점수로 채점). Lighthouse CI는 이를 배포 파이프라인에 끼워 넣어 "점수가 기준 미만이면 빌드를
// 실패시키는" 데 쓰는 도구 — lighthouserc.cjs가 그 설정 파일이다. 아래 테스트들은 "설정이 실제로
// 우리가 합의한 기준(디자인 5개 전부 측정, 점수 임계값 등)을 담고 있는지"를 검증한다 —
// Lighthouse를 실제로 실행하는 게 아니라 설정값 자체를 점검하는 테스트라 빠르고, 설정 파일이
// 실수로 잘못 고쳐지는 걸 CI에서 즉시 잡아낸다.
describe("production performance gates", () => {
  it("runs three production measurements for every visual design", () => {
    const collect = lighthouseConfig.ci.collect;
    const urls = collect.url as string[];

    expect(collect.startServerCommand).toBe("npm run start:performance");
    expect(collect.numberOfRuns).toBe(3);
    expect(collect.settings.preset).toBe("desktop");
    expect(urls).toHaveLength(10);

    for (const designId of [
      "design",
      "classic",
      "editorial",
      "brutalist",
      "cinematic",
    ]) {
      expect(urls).toContain(`http://localhost:3300/?view=${designId}`);
      expect(urls).toContain(
        `http://localhost:3300/projects/example-project?view=${designId}`,
      );
    }
  });

  // [INTV:PERF] largest-contentful-paint(LCP)/cumulative-layout-shift(CLS)/total-blocking-time
  // (TBT)는 구글이 정의한 "코어 웹 바이탈"류 성능 지표다 — 각각 "화면에서 가장 큰 콘텐츠가
  // 그려지기까지 걸린 시간", "로딩 중 레이아웃이 얼마나 덜컥거리며 밀렸는지", "메인 스레드가
  // 사용자 입력을 못 받고 막혀 있던 시간"을 뜻한다. 이 테스트는 이 프로젝트가 이 세 지표 각각에
  // 합의한 숫자 기준(예: LCP 2.5초 이내)이 설정 파일에 정확히 박혀 있는지 확인한다.
  it("enforces the agreed Lighthouse and lab responsiveness targets", () => {
    const assertions = lighthouseConfig.ci.assert.assertions;

    expect(assertions["categories:performance"]).toEqual([
      "error",
      expect.objectContaining({ minScore: 0.9 }),
    ]);
    expect(assertions["categories:accessibility"]).toEqual([
      "error",
      expect.objectContaining({ minScore: 0.95 }),
    ]);
    expect(assertions["largest-contentful-paint"]).toEqual([
      "error",
      expect.objectContaining({ maxNumericValue: 2_500 }),
    ]);
    expect(assertions["cumulative-layout-shift"]).toEqual([
      "error",
      expect.objectContaining({ maxNumericValue: 0.1 }),
    ]);
    expect(assertions["total-blocking-time"]).toEqual([
      "error",
      expect.objectContaining({ maxNumericValue: 200 }),
    ]);
  });
});

// [INTV:ARCH] "RSC 클라이언트 레퍼런스 매니페스트": Next.js가 빌드 시 만드는, "이 라우트가
// 브라우저로 내려보내는 JS 파일 목록"이 담긴 내부 산출물 — 라우트별 실제 번들 크기를 측정하려면
// 이 압축된 JS 코드 조각을 파싱해야 한다. parseClientReferenceManifest는 정식 JS 모듈로서가
// 아니라 이 특이한 형식(globalThis에 값을 대입하는 코드 문자열)을 직접 문자열/정규식으로 해석하는
// 함수다.
describe("route bundle budgets", () => {
  it("parses the compact webpack client reference manifest", () => {
    const source =
      'globalThis.__RSC_MANIFEST=(globalThis.__RSC_MANIFEST||{});globalThis.__RSC_MANIFEST["/about/page"]={"entryJSFiles":{"route":["static/chunks/page.js"]}};';

    expect(parseClientReferenceManifest(source, "about.js")).toEqual({
      entryJSFiles: {
        route: ["static/chunks/page.js"],
      },
    });
  });

  it("parses a dynamic route key containing square brackets", () => {
    const source =
      'globalThis.__RSC_MANIFEST=(globalThis.__RSC_MANIFEST||{});globalThis.__RSC_MANIFEST["/projects/[projectId]/page"]={"entryJSFiles":{}};';

    expect(parseClientReferenceManifest(source, "project.js")).toEqual({
      entryJSFiles: {},
    });
  });

  const baseline: RouteBudgetBaseline = {
    schemaVersion: 1,
    growthLimitPercent: 5,
    routes: {
      "/": { cssBytes: 100, jsBytes: 1_000 },
      "/projects/[projectId]": { cssBytes: 200, jsBytes: 2_000 },
    },
  };

  // [INTV:PERF] "번들 예산(bundle budget)": 라우트마다 "지난번 측정한 기준(baseline) 대비
  // 이번 빌드가 최대 몇 %까지만 커져도 되는지"를 정해두고, 넘으면 실패시키는 성능 회귀 방지
  // 장치 — evaluateRouteBudgets가 그 비교 로직이다. 여기서는 실제 빌드 없이 가짜
  // 측정값(measurements)과 가짜 기준선(baseline)만으로 그 판정 로직 자체(5% 이내면 통과,
  // 초과하면 문제로 보고, 라우트가 아예 사라지면 그것도 문제로 보고)를 검증한다.
  it("allows at most five percent growth per route and asset type", () => {
    const measurements: RouteBundleMeasurement = {
      "/": { cssBytes: 105, jsBytes: 1_050 },
      "/projects/[projectId]": { cssBytes: 210, jsBytes: 2_100 },
    };

    expect(BUDGET_GROWTH_FACTOR).toBe(1.05);
    expect(evaluateRouteBudgets(measurements, baseline)).toEqual([]);
  });

  it("reports a route and asset when the measured output exceeds its budget", () => {
    const measurements: RouteBundleMeasurement = {
      "/": { cssBytes: 106, jsBytes: 1_050 },
      "/projects/[projectId]": { cssBytes: 210, jsBytes: 2_101 },
    };

    expect(evaluateRouteBudgets(measurements, baseline)).toEqual([
      expect.objectContaining({ asset: "css", route: "/" }),
      expect.objectContaining({
        asset: "js",
        route: "/projects/[projectId]",
      }),
    ]);
  });

  it("fails closed when a baseline route is missing from the build", () => {
    expect(evaluateRouteBudgets({}, baseline)).toEqual([
      expect.objectContaining({ asset: "route", route: "/" }),
      expect.objectContaining({
        asset: "route",
        route: "/projects/[projectId]",
      }),
    ]);
  });
});

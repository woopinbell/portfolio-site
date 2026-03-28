import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// [INTV:ARCH] Lighthouse CI(@lhci/cli)를 여러 번 돌리면 .lighthouseci/ 아래 lhr-*.json 원시
// 리포트가 라우트당 여러 개(런당 하나씩) 쌓인다 — 이 스크립트는 그 원시 리포트 더미를, 저장소에
// 커밋해 성능 회귀를 추적하는 단일 "베이스라인" 파일 하나로 압축하는 역할을 한다
// (performance-gates.test.ts가 바로 이 OUTPUT_PATH 파일을 읽어 유닛 테스트로 구조/값을 검증한다 —
// Lighthouse 원시 리포트는 매번 타임스탬프/러닝타임 등 변동 필드가 많아 그대로 커밋해 diff로
// 추적하기엔 부적합하기 때문).
const INPUT_DIRECTORY = ".lighthouseci";
const OUTPUT_PATH = "performance/lighthouse-baseline.json";

// [INTV:PERF] 여러 번 측정한 값을 평균이 아닌 중앙값으로 대표시킨다 — Lighthouse Lab 측정치는 로컬
// 머신의 다른 프로세스 간섭 등으로 가끔 크게 튀는 런이 섞이는데, 평균은 그 이상치 하나에 쉽게
// 끌려가지만 중앙값은 훨씬 안정적이다(interaction-performance.spec.ts의 median() 선택과 같은 이유).
function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

// [INTV:TRAP] Lighthouse의 카테고리 점수(score)는 0~1 사이 소수로 내려온다 — 100점 만점 표기와
// 헷갈려 그대로 저장하면 targets(90, 95 등 정수 기준값)와 단위가 안 맞아 비교가 항상 실패하거나
// 항상 통과하는(둘 다 조용히 틀린) 버그가 된다. * 100으로 여기서 미리 정규화해, 이후 소비하는
// 쪽(performance-gates.test.ts)은 단위 변환을 신경 쓰지 않아도 되게 한다.
function resultFromReport(report) {
  return {
    accessibilityScore: report.categories.accessibility.score * 100,
    cls: report.audits["cumulative-layout-shift"].numericValue,
    lcpMs: report.audits["largest-contentful-paint"].numericValue,
    performanceScore: report.categories.performance.score * 100,
    tbtMs: report.audits["total-blocking-time"].numericValue,
  };
}

function aggregate(results) {
  return {
    accessibilityScore: median(
      results.map(({ accessibilityScore }) => accessibilityScore),
    ),
    cls: median(results.map(({ cls }) => cls)),
    lcpMs: median(results.map(({ lcpMs }) => lcpMs)),
    performanceScore: median(
      results.map(({ performanceScore }) => performanceScore),
    ),
    tbtMs: median(results.map(({ tbtMs }) => tbtMs)),
  };
}

async function main() {
  const filenames = (await readdir(INPUT_DIRECTORY)).filter(
    (filename) => filename.startsWith("lhr-") && filename.endsWith(".json"),
  );
  if (filenames.length === 0) {
    throw new Error("No Lighthouse JSON reports were found in .lighthouseci.");
  }

  const reports = await Promise.all(
    filenames.map(async (filename) =>
      JSON.parse(
        await readFile(path.join(INPUT_DIRECTORY, filename), "utf8"),
      ),
    ),
  );
  const grouped = new Map();

  // [INTV:FLOW] 1. .lighthouseci/ 안의 lhr-*.json 전부를 읽어 파싱 -> 2. report.finalUrl(실제
  // 도달한 최종 URL, 리다이렉트 후) 기준으로 그룹핑 -> 3. 그룹별로 median()으로 집계 -> 4. URL
  // 알파벳순 정렬 후 단일 baseline JSON으로 직렬화.
  // [INTV:TRAP] report.url이 아니라 report.finalUrl로 그룹핑해야 한다 — Lighthouse CI 설정이
  // trailing slash 리다이렉트나 쿼리스트링 정규화를 거치는 라우트가 있으면, 요청 시점 url과
  // 실제 도달한 url이 달라질 수 있어 url로 묶으면 같은 라우트의 실행 결과가 서로 다른 그룹으로
  // 쪼개지는 조용한 버그가 생긴다.
  for (const report of reports) {
    const url = report.finalUrl;
    const results = grouped.get(url) ?? [];
    results.push(resultFromReport(report));
    grouped.set(url, results);
  }

  const routes = Object.fromEntries(
    [...grouped.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([url, runs]) => [url, { median: aggregate(runs), runs }]),
  );
  const firstReport = reports[0];
  // [INTV:EDGE] runs 배열(원시 개별 측정치)을 median과 함께 그대로 보존해둔다 — 요약값(median)만
  // 남기고 원시 데이터를 버리면, 나중에 "이 median이 왜 이 값이 나왔는지" 재현하려 할 때 Lighthouse
  // 원본 리포트가 이미 .lighthouseci/에서 정리(삭제)된 뒤라 확인할 방법이 없다. environment 블록도
  // 마찬가지로 "이 베이스라인이 어떤 하드웨어/OS/Node 버전에서 측정됐는지"를 함께 박제해, 다른 머신
  // 에서 재현했을 때 값이 다르게 나오는 원인을 성능 회귀와 구분할 수 있게 한다. schemaVersion은
  // 이 baseline JSON의 구조 자체가 나중에 바뀔 걸 대비한 필드 — 소비하는 쪽이 버전을 보고 마이그
  // 레이션 여부를 판단할 수 있다.
  const summary = {
    schemaVersion: 1,
    measuredAt: new Date().toISOString(),
    measurement: {
      kind: "Lighthouse desktop lab run against the local production server",
      runCountPerUrl: 3,
      aggregation: "median",
      interactionProxy: "total-blocking-time",
    },
    targets: {
      accessibilityScore: 95,
      cls: 0.1,
      lcpMs: 2_500,
      performanceScore: 90,
      tbtMs: 200,
    },
    environment: {
      arch: os.arch(),
      chromeUserAgent: firstReport.environment.hostUserAgent,
      cpu: os.cpus()[0]?.model ?? "unknown",
      logicalCpuCount: os.cpus().length,
      memoryBytes: os.totalmem(),
      node: process.version,
      platform: os.platform(),
    },
    routes,
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(`Wrote ${OUTPUT_PATH} from ${reports.length} Lighthouse runs.`);
}

await main();

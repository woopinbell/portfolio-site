import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

// [INTV:PERF] 이 스크립트는 Next.js 빌드 산출물(.next)을 직접 파싱해 라우트별 JS/CSS 전송량을
// 재고, performance/route-budgets.json에 커밋해둔 기준선(baseline) 대비 5%(BUDGET_GROWTH_FACTOR)
// 넘게 커지면 CI를 실패시키는 자체 성능 회귀 게이트다 — bundle-analyzer 같은 범용 도구 대신 직접
// 짠 이유는, "라우트별로, 기준선 대비 상대적으로" 추적해야 하는 이 프로젝트 특유의 요구(테마 5개 ×
// 8라우트 각각의 번들 크기를 개별 추적)에 맞춘 최소 구현이 더 간단했기 때문으로 보인다.
export const BUDGET_GROWTH_FACTOR = 1.05;

const DEFAULT_BUILD_DIRECTORY = ".next";
const DEFAULT_BASELINE_PATH = "performance/route-budgets.json";

function routeFromManifestKey(key) {
  if (key === "/page") {
    return "/";
  }

  return key.replace(/\/page$/, "");
}

// [INTV:TRAP] Next.js가 빌드 시 만드는 "RSC 클라이언트 레퍼런스 매니페스트" 파일은 정식 JSON이나
// ESM 모듈이 아니라 `globalThis.__RSC_MANIFEST[...] = {...};` 형태의 실행 가능한 JS 코드다 —
// 그래서 import로 불러올 수 없고, 대입문 오른쪽의 객체 리터럴 부분만 문자열로 잘라내 JSON.parse로
// 직접 해석해야 한다. 이 형식은 Next.js 내부 구현 세부사항이라 버전이 바뀌면 이 파서도 깨질 수
// 있다는 게 이 접근의 트레이드오프(공식 API가 없어 내부 포맷에 의존).
export function parseClientReferenceManifest(source, filename) {
  const assignment =
    /globalThis\.__RSC_MANIFEST\[[\s\S]+?\]\s*=\s*/.exec(source);
  const serialized = assignment
    ? source.slice(assignment.index + assignment[0].length).trim()
    : "";

  if (!assignment || !serialized.endsWith(";")) {
    throw new Error(`Cannot parse client reference manifest: ${filename}`);
  }

  return JSON.parse(serialized.slice(0, -1));
}

async function assetBytes(buildDirectory, assets) {
  const sizes = await Promise.all(
    [...new Set(assets)].map(async (asset) => {
      const assetPath = path.join(buildDirectory, asset.replace(/^\//, ""));
      return (await stat(assetPath)).size;
    }),
  );

  return sizes.reduce((total, size) => total + size, 0);
}

// [INTV:PERF] 라우트마다 실제로 브라우저가 받는 바이트 수 = 공유 JS(sharedJavaScript, 모든 라우트가
// 공통으로 로드하는 런타임)와 그 라우트 전용 JS/CSS를 더한 값이다. 공유분을 라우트마다 중복
// 계산해도 실제 다운로드는 브라우저 캐시로 한 번만 일어나지만, 이 스크립트는 "이 라우트를 처음
// 방문할 때 받는 총량"을 재는 게 목적이라 의도적으로 매 라우트에 공유 JS를 포함시킨다.
export async function collectRouteBundleMeasurements(
  buildDirectory = DEFAULT_BUILD_DIRECTORY,
) {
  const appPaths = JSON.parse(
    await readFile(
      path.join(buildDirectory, "server/app-paths-manifest.json"),
      "utf8",
    ),
  );
  const buildManifest = JSON.parse(
    await readFile(path.join(buildDirectory, "build-manifest.json"), "utf8"),
  );
  const sharedJavaScript = buildManifest.rootMainFiles ?? [];
  const measurements = {};

  for (const key of Object.keys(appPaths).sort()) {
    if (!key.endsWith("/page") || key.startsWith("/_")) {
      continue;
    }

    const route = routeFromManifestKey(key);
    const relativeManifestPath = `server/${appPaths[key].replace(
      /\.js$/,
      "_client-reference-manifest.js",
    )}`;
    const manifestPath = path.join(buildDirectory, relativeManifestPath);
    const manifest = parseClientReferenceManifest(
      await readFile(manifestPath, "utf8"),
      manifestPath,
    );
    const routeJavaScript = Object.values(manifest.entryJSFiles ?? {}).flat();
    const routeCss = Object.values(manifest.entryCSSFiles ?? {})
      .flat()
      .filter(({ inlined }) => !inlined)
      .map(({ path: assetPath }) => assetPath);

    measurements[route] = {
      cssBytes: await assetBytes(buildDirectory, routeCss),
      jsBytes: await assetBytes(buildDirectory, [
        ...sharedJavaScript,
        ...routeJavaScript,
      ]),
    };
  }

  return measurements;
}

// [INTV:PERF] evaluateRouteBudgets는 순수 함수(측정값 + 기준선 → 위반 목록)로 분리해뒀다 —
// performance-gates.test.ts가 실제 빌드나 파일시스템 없이 가짜 measurements/baseline만으로 이
// 판정 로직 자체를 단위 테스트할 수 있는 이유. 판정에는 두 종류가 있다: (1) 기존 라우트가 예산을
// 초과했는지, (2) 새 라우트가 생겼는데 기준선에 없는지(baseline 파일을 갱신하지 않고 새 라우트를
// 추가하면 이걸로 걸린다) — 반대로 라우트가 삭제됐는데 기준선에 남아있는 경우는 이 함수가
// 잡아내지 않는다는 점도 눈여겨볼 만하다.
export function evaluateRouteBudgets(measurements, baseline) {
  const violations = [];
  const baselineRoutes = baseline.routes ?? {};

  for (const [route, expected] of Object.entries(baselineRoutes)) {
    const actual = measurements[route];

    if (!actual) {
      violations.push({
        asset: "route",
        message: `${route}: route output is missing`,
        route,
      });
      continue;
    }

    for (const [property, asset] of [
      ["cssBytes", "css"],
      ["jsBytes", "js"],
    ]) {
      const allowedBytes = Math.floor(expected[property] * BUDGET_GROWTH_FACTOR);
      if (actual[property] > allowedBytes) {
        violations.push({
          actualBytes: actual[property],
          allowedBytes,
          asset,
          baselineBytes: expected[property],
          message: `${route}: ${asset} is ${actual[property]} bytes (limit ${allowedBytes})`,
          route,
        });
      }
    }
  }

  for (const route of Object.keys(measurements)) {
    if (!baselineRoutes[route]) {
      violations.push({
        asset: "baseline",
        message: `${route}: route does not have a committed baseline`,
        route,
      });
    }
  }

  return violations;
}

function printMeasurements(measurements) {
  for (const [route, sizes] of Object.entries(measurements)) {
    console.log(
      `${route}: js=${sizes.jsBytes} bytes, css=${sizes.cssBytes} bytes`,
    );
  }
}

// [INTV:ARCH] 이 스크립트는 두 가지 모드로 실행된다: --write-baseline 플래그가 있으면 지금
// 측정값을 새 기준선으로 저장하고(의도적으로 번들이 커진 변경을 반영할 때 사람이 명시적으로
// 실행), 없으면 기존 기준선과 비교해 위반이 있으면 실패한다(CI에서 매 빌드마다 자동 실행) —
// "기준을 갱신하는 것"과 "기준을 검증하는 것"을 같은 스크립트의 서로 다른 모드로 묶어둔 설계.
async function main() {
  const writeBaseline = process.argv.includes("--write-baseline");
  const measurements = await collectRouteBundleMeasurements();

  printMeasurements(measurements);

  if (writeBaseline) {
    const baseline = {
      schemaVersion: 1,
      growthLimitPercent: 5,
      source: "Next.js production client assets (uncompressed bytes)",
      routes: measurements,
    };
    await mkdir(path.dirname(DEFAULT_BASELINE_PATH), { recursive: true });
    await writeFile(
      DEFAULT_BASELINE_PATH,
      `${JSON.stringify(baseline, null, 2)}\n`,
      "utf8",
    );
    console.log(`Wrote ${DEFAULT_BASELINE_PATH}`);
    return;
  }

  const baseline = JSON.parse(
    await readFile(DEFAULT_BASELINE_PATH, "utf8"),
  );
  if (baseline.growthLimitPercent !== 5) {
    throw new Error("The committed route budget must use a five percent limit.");
  }

  const violations = evaluateRouteBudgets(measurements, baseline);
  if (violations.length > 0) {
    for (const violation of violations) {
      console.error(violation.message);
    }
    process.exitCode = 1;
    return;
  }

  console.log("All route JS/CSS bundles are within the five percent budget.");
}

// [INTV:TRAP] "이 모듈이 직접 실행됐는지, 다른 파일에 import됐는지" 판별하는 관용구 —
// performance-gates.test.ts는 이 파일의 함수들(evaluateRouteBudgets 등)만 import해서 쓰는데, 이
// 체크가 없으면 그 import만으로도 main()이 실행돼(빌드 산출물이 없는 테스트 환경에서) 곧바로
// 파일 읽기 에러로 테스트가 깨진다.
const isMain = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isMain) {
  await main();
}

// [INTV:ARCH] 이 vitest 테스트는 "vitest 밖에 있는 또 다른 테스트 도구(Playwright,
// tests/e2e/visual.spec.ts)"의 산출물을 검사한다 — Playwright의 시각적 회귀 테스트(visual
// regression: 스크린샷을 미리 저장해두고 이후 실행에서 픽셀 차이를 비교하는 방식)가 남기는 기준
// 스크린샷(.png) 파일 목록이, "테마 5개 × 데스크톱/모바일/프로젝트 페이지" 조합으로 예상되는
// 목록과 정확히 일치하는지 확인한다. 즉 누군가 스냅샷 파일을 빠뜨리거나 이름을 잘못 짓는 실수를,
// 실제로 무거운 Playwright 시각 테스트를 돌리지 않고도 파일 목록 비교만으로 빠르게(vitest 단위
// 테스트 속도로) 잡아낸다.
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { SITE_DESIGN_IDS } from "./config";

const snapshotDirectory = resolve(
  process.cwd(),
  "tests/e2e/visual.spec.ts-snapshots",
);

const expectedSnapshotManifest = SITE_DESIGN_IDS.flatMap((designId) => [
  `home-${designId}-chromium.png`,
  `home-${designId}-mobile-chrome.png`,
  `project-${designId}-chromium.png`,
]).sort();

describe("visual regression contract", () => {
  it("keeps the exact desktop and mobile snapshot manifest", () => {
    const actualSnapshotManifest = readdirSync(snapshotDirectory)
      .filter((fileName) => fileName.endsWith(".png"))
      .sort();

    expect(actualSnapshotManifest).toEqual(expectedSnapshotManifest);
  });
});

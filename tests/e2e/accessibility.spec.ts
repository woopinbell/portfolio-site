import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import presentationJson from "../../src/content/presentation.json";
import {
  designIds,
  enabledRoutes,
  withExplicitDesign,
  type DesignId,
} from "./site-matrix";

// [INTV:ARCH] @axe-core/playwright: 실제 렌더링된 페이지에 접근성 감사 엔진(axe-core)을 주입해
// WCAG 규칙 위반을 자동으로 스캔하는 도구 — 색상 대비, ARIA 속성 오용, 랜드마크 중복 등을 사람이
// 수동으로 하나하나 점검하지 않고도 잡아낸다. wcag22AATags는 검사할 기준 레벨(2.x 버전 × A/AA
// 등급)을 지정 — AAA는 제외하고 실무에서 흔히 목표로 삼는 AA까지만 강제한다.
const wcag22AATags = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22a",
  "wcag22aa",
] as const;

function formatViolations(
  designId: DesignId,
  path: string,
  violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"],
) {
  return violations
    .map(
      (violation) =>
        `${designId} ${path}: ${violation.id} (${violation.impact ?? "unknown"})\n${violation.nodes
          .map((node) => `  ${node.target.join(" ")}\n  ${node.failureSummary}`)
          .join("\n")}`,
    )
    .join("\n\n");
}

// [INTV:EDGE] axe 스캔 전에 먼저 랜드마크(main/banner=header/contentinfo=footer)가 정확히 하나씩만
// 있는지를 확인한다 — 이건 axe가 항상 잡아주는 종류의 문제가 아니라(랜드마크가 중복되거나 아예
// 없는 구조적 실수는 자동 도구가 놓치기 쉽다), site-shell.tsx의 PageShell 계약이 테마마다 일관되게
// 지켜지는지를 명시적으로 검증하는 부분이다.
async function expectAccessibleRoute(
  page: Page,
  path: string,
  designId: DesignId,
) {
  const response = await page.goto(withExplicitDesign(path, designId));

  expect(response?.ok()).toBe(true);
  await expect(page.locator(`[data-site-design="${designId}"]`)).toBeVisible();
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByRole("banner")).toHaveCount(1);
  await expect(page.getByRole("contentinfo")).toHaveCount(1);

  const results = await new AxeBuilder({ page })
    .withTags([...wcag22AATags])
    .analyze();

  // [INTV:EDGE] 실패 메시지(두 번째 인자)로 formatViolations를 넘겨서, 단순히 "실패함"이 아니라
  // "어느 요소가 어떤 규칙을 왜 위반했는지"까지 테스트 리포트에 바로 나오게 한다 — CI 로그만 보고도
  // axe 대시보드를 따로 열지 않고 원인을 알 수 있게 하는 배려(toEqual([])로 "위반 없음"을 표현하는
  // 것도, 실패 시 실제 위반 배열 전체가 diff로 보이게 하려는 선택).
  expect(
    results.violations,
    formatViolations(designId, path, results.violations),
  ).toEqual([]);
}

for (const designId of designIds) {
  // [INTV:PERF] test.slow(): 한 테스트 안에서 라우트를 여러 개 순회하며 매번 axe 스캔을 도는 건
  // Playwright의 기본 타임아웃보다 오래 걸릴 수 있어, 이 표시로 타임아웃 배수를 늘려준다 — 실패를
  // "느려서 타임아웃"과 "진짜 접근성 위반"으로 헷갈리지 않게 하는 장치.
  test(`${designId}: every enabled route passes WCAG 2.2 AA checks`, async ({
    page,
  }) => {
    test.slow();

    for (const { path } of enabledRoutes) {
      await expectAccessibleRoute(page, path, designId);
    }
  });

  // [INTV:EDGE] site-shell.tsx의 "스킵 링크" 기능을 실제 키보드 입력으로 검증한다 — 첫 Tab에
  // 스킵 링크가 포커스를 받는지(페이지 진입 시 첫 포커스 대상이어야 함), Enter를 누르면 실제로
  // #main-content로 포커스가 이동하는지(href="#..."만 있고 실제 이동이 안 되는 흔한 구현 실수를
  // 잡아낸다)를 axe 같은 자동 스캐너가 아니라 실제 키보드 시나리오로 확인 — 접근성 자동 검사
  // (axe)와 수동 시나리오 재현(키보드 조작) 두 층위를 함께 둔 이유가 여기 있다: 자동 스캐너는
  // "이 요소에 올바른 속성이 있는가"는 잡아도 "실제로 예상대로 동작하는가"까지는 보장하지 못한다.
  test(`${designId}: keyboard users can skip repeated navigation`, async ({
    page,
  }) => {
    await page.goto(withExplicitDesign("/", designId));

    const skipLink = page.getByRole("link", {
      name: presentationJson.ui.skipLinkLabel,
    });
    const main = page.getByRole("main");

    await page.keyboard.press("Tab");
    await expect(skipLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(main).toBeFocused();
  });
}

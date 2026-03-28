import { expect, test, type Page } from "@playwright/test";

import {
  designIds,
  firstEnabledProject,
  withExplicitDesign,
} from "./site-matrix";

const projectId = firstEnabledProject?.id;

if (!projectId) {
  throw new Error("Visual snapshots need one enabled project.");
}

// [INTV:EDGE] 스크린샷 비교(toHaveScreenshot)는 픽셀 단위로 이전 결과와 비교하므로, 페이지가 찍히는
// 매 순간 조금이라도 다르면(애니메이션 진행 중, 폰트가 아직 폴백 상태, 이미지가 아직 안 뜸) 실제
// 회귀가 없어도 "다르다"고 오탐(flaky)한다. 이 헬퍼가 스크린샷 전에 그 변동 요소들을 전부 제거한다:
// - reducedMotion: "reduce"로 CSS 애니메이션/트랜지션을 최대한 정지 상태로 유도(globals.css의
//   prefers-reduced-motion 대응이 실제로 켜진다).
// - waitUntil: "networkidle"로 네트워크 요청이 잠잠해질 때까지 기다림.
// - document.fonts.ready: 웹폰트 로딩이 끝날 때까지 대기(안 그러면 폴백 폰트로 찍힌 스크린샷과
//   실제 폰트로 찍힌 스크린샷이 매번 다르게 나온다).
// - 이미지 로딩 대기: image.complete가 아직 false인 이미지마다 load/error 이벤트를 기다린다 —
//   error도 resolve하는 이유는, 깨진 이미지 자체를 검증 대상으로 삼는 게 아니라 "로딩이 끝난
//   상태"까지만 보장하면 되기 때문(로딩이 영원히 안 끝나 테스트가 멈추는 것보다 낫다).
async function prepareStablePage(page: Page, path: string) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const response = await page.goto(path, { waitUntil: "networkidle" });

  expect(response?.ok()).toBe(true);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images, (image) => {
        if (image.complete) {
          return Promise.resolve();
        }

        return new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        });
      }),
    );
  });
}

for (const designId of designIds) {
  test(
    `${designId}: home visual`,
    { tag: "@visual" },
    async ({ page }, testInfo) => {
      await prepareStablePage(page, withExplicitDesign("/", designId));

      // [INTV:EDGE] maxDiffPixelRatio: 0.01 — 완전히 0(픽셀 하나도 안 다름)을 요구하지 않고 1%의
      // 오차를 허용한다. 서브픽셀 렌더링, 폰트 안티앨리어싱 등 OS/브라우저 버전 차이로 생기는
      // 미세한 차이까지 실패로 잡으면 이 테스트가 상시로 깨지는 "가짜 알람" 도구가 된다.
      await expect(page).toHaveScreenshot(`home-${designId}.png`, {
        animations: "disabled",
        fullPage: true,
        maxDiffPixelRatio: 0.01,
      });

      // [INTV:EDGE] 시각적 회귀 스크린샷은 프로젝트(브라우저/뷰포트 조합)마다 렌더링이 미묘하게
      // 달라 별도의 기준 이미지가 필요하다 — 이 프로젝트는 기준 이미지를 chromium(데스크톱)과
      // mobile-chrome 두 세트만 커밋해뒀으므로, 다른 브라우저 프로젝트(firefox, webkit 등)에서
      // 돌면 비교할 기준이 없어 항상 실패한다. 이 assertion이 "혹시 다른 프로젝트에서 이 테스트가
      // 실수로 실행됐다면" 그 사실을 명확한 에러로 드러낸다(설정 실수를 조용히 넘기지 않는다).
      expect(["chromium", "mobile-chrome"]).toContain(testInfo.project.name);
    },
  );

  test(
    `${designId}: project detail desktop visual`,
    { tag: "@visual" },
    async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "chromium", "Desktop reference only.");

      await prepareStablePage(
        page,
        withExplicitDesign(`/projects/${projectId}`, designId),
      );

      await expect(page).toHaveScreenshot(`project-${designId}.png`, {
        animations: "disabled",
        fullPage: true,
        maxDiffPixelRatio: 0.01,
      });
    },
  );
}

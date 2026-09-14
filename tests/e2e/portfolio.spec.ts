import { expect, test, type Locator, type Page } from "@playwright/test";

import contactJson from "../../src/content/contact.json";
import curationJson from "../../src/content/curation.json";
import experienceJson from "../../src/content/experience.json";
import interviewMapJson from "../../src/content/interview-map.json";
import journeyNarrativeJson from "../../src/content/journey-narrative.json";
import linksJson from "../../src/content/links.json";
import presentationJson from "../../src/content/presentation.json";
import profileJson from "../../src/content/profile.json";
import projectsJson from "../../src/content/projects.json";
import resumeJson from "../../src/content/resume.json";
import siteJson from "../../src/content/site.json";
import skillsJson from "../../src/content/skills.json";
import techStackJson from "../../src/content/tech-stack.json";
import {
  designIds,
  enabledRoutes,
  firstEnabledProject,
  withExplicitDesign,
  type DesignId,
} from "./site-matrix";

// [INTV:ARCH] 이 파일 전체를 관통하는 전제: "테마(디자인) 5개는 서로 완전히 다른 레이아웃/CSS를
// 쓰지만, 같은 콘텐츠 JSON을 렌더링해야 한다"는 계약을 검증하는 것이 목적이다. 그래서 고정 문자열을
// 하드코딩해 assert하지 않고, 실제 src/content/*.json에서 값을 읽어와 그 값이 렌더링된 DOM에
// 나타나는지 확인한다 — 콘텐츠가 바뀌어도 테스트를 따로 갱신할 필요가 없고, 반대로 "테마가 콘텐츠를
// 누락하고 렌더링하는" 실수를 잡아낸다.
// [INTV:TRAP] requireFixture: 테스트 픽스처(첫 프로젝트, 첫 이력서 프로젝트 등)를 find()로 찾은 뒤
// undefined 체크 없이 바로 쓰면, 콘텐츠 JSON이 나중에 바뀌어 그 항목이 사라졌을 때 테스트가 "왜
// 실패하는지 알 수 없는" TypeError(undefined의 속성 접근)로 깨진다 — 모듈 최상단에서 미리 fail-fast로
// 의미 있는 에러 메시지와 함께 던져, 실패 원인을 테스트 실행 즉시 명확히 드러낸다.
function requireFixture<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new Error(message);
  }

  return value;
}

const firstProject = requireFixture(
  firstEnabledProject,
  "The portfolio needs at least one enabled project.",
);
const firstProjectTechnology = requireFixture(
  techStackJson.find((technology) => technology.id === firstProject.stack[0]),
  "The first project technology must resolve in E2E fixtures.",
);
const firstResumeProject = requireFixture(
  projectsJson.items.find((project) => project.id === resumeJson.projectIds[0]),
  "The first resume project must resolve in E2E fixtures.",
);
const firstInterviewAnswer = interviewMapJson.tracks[0]?.items[0]?.answers[0];
const firstInterviewProject = requireFixture(
  projectsJson.items.find(
    (project) => project.id === firstInterviewAnswer?.projectId,
  ),
  "The first interview project must resolve in E2E fixtures.",
);

const templateLabels = new Map(
  presentationJson.templates.map((template) => [template.id, template.label]),
);

const projectsNavigation = siteJson.navigation.find(
  (item) => item.href === "/projects",
);

if (!projectsNavigation) {
  throw new Error("site.json must include a /projects navigation item.");
}

// [INTV:TRAP] 기본 테마(presentationJson.defaultHomeTemplate)로 이동할 때는 "?view=" 쿼리를
// 아예 지워야 한다(그냥 기본값을 명시적으로 채우는 게 아니라) — 실제 앱의 디자인 스위처 링크가
// "기본 테마로 돌아갈 땐 URL을 가장 짧고 정규화된 형태로 유지"하는 관례를 따르기 때문에, 이 헬퍼가
// 그 관례와 다르게 항상 view= 를 채워버리면 기대 href와 실제 href가 어긋나 모든 링크 비교 assertion이
// 깨진다.
function expectedInternalHref(
  path: string,
  designId: DesignId,
  contentDebug = false,
) {
  const url = new URL(path, "https://portfolio.test");

  if (designId === presentationJson.defaultHomeTemplate) {
    url.searchParams.delete("view");
  } else {
    url.searchParams.set("view", designId);
  }

  if (contentDebug) {
    url.searchParams.set("debug", "content");
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

function expectedActiveDesignNavigationHref(path: string, designId: DesignId) {
  return expectedInternalHref(path, designId);
}

// [INTV:EDGE] 마지막 scrollWidth <= innerWidth + 1 체크는 이 파일에서 가장 값싸게(추가 상호작용 없이)
// 가로 스크롤 오버플로우를 잡는 회귀 방지 장치다 — 테마 5개 각각의 CSS가 독립적으로 관리되다 보니
// 한 테마에서만 고정 너비 요소나 긴 텍스트가 뷰포트를 넘치게 만드는 실수가 나기 쉬운데, 매 라우트
// 방문마다 이 한 줄이 끼어 있어 "이 라우트에서 이 테마만 가로 스크롤 생김" 같은 버그를 조기에 잡는다
// (+1은 서브픽셀 반올림 오차 허용).
async function expectDesignRoute(
  page: Page,
  path: string,
  designId: DesignId,
) {
  const response = await page.goto(withExplicitDesign(path, designId));

  expect(response?.ok()).toBe(true);
  await expect(
    page.locator(`[data-site-design="${designId}"]`),
  ).toBeVisible();
  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  const activeLabel = templateLabels.get(designId);

  if (!activeLabel) {
    throw new Error(`Missing presentation copy for ${designId}.`);
  }

  await expect(
    page.getByLabel(
      presentationJson.ui.designSwitcherAriaTemplate.replace(
        "{label}",
        activeLabel,
      ),
    ),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
}

// [INTV:TRADE_OFF] exact 매칭과 contained 매칭을 분리해둔 이유 — 짧고 고유한 문자열(제목, 이름 등)은
// exact: true로 엄격히 맞춰 오탐(다른 텍스트의 부분 일치로 우연히 통과)을 막고, 긴 문단이나 다른
// 테마에서 줄바꿈/공백 삽입이 달라질 수 있는 본문은 exact: false로 완화해 "테마마다 마크업 구조가
// 달라도 내용만 같으면 통과"하게 한다 — 모든 곳에 exact: true를 쓰면 테마별 공백 처리 차이로 계속
// 깨지는 테스트가 되고, 모든 곳에 exact: false를 쓰면 오탐 위험이 커진다.
async function expectExactContent(page: Page, value: string) {
  await expect(
    page.locator("main").getByText(value, { exact: true }).first(),
  ).toBeVisible();
}

async function expectContainedContent(page: Page, value: string) {
  await expect(
    page.locator("main").getByText(value, { exact: false }).first(),
  ).toBeVisible();
}

// [INTV:EDGE] WCAG 2.5.5(Target Size)의 실무 기준값인 44x44 CSS px을 그대로 하드코딩한 접근성
// 어서션 헬퍼 — getBoundingClientRect는 실제 렌더링된 크기를 재므로, CSS에서 min-height/padding을
// 잘못 계산해 버튼이 44px보다 작아지는 회귀를 스타일 변경 즉시 잡아낸다. bounds.length가 0이면
// (셀렉터가 아예 아무것도 못 찾은 경우) "통과"가 아니라 별도로 실패시켜, 셀렉터 오타로 테스트가
// 아무것도 검증하지 않은 채 조용히 통과하는 것을 방지한다.
async function expectMinimumTouchTargets(locator: Locator) {
  const bounds = await locator.evaluateAll((elements) =>
    elements.map((element) => {
      const rectangle = element.getBoundingClientRect();
      return { height: rectangle.height, width: rectangle.width };
    }),
  );

  expect(bounds.length).toBeGreaterThan(0);
  for (const target of bounds) {
    expect(target.height).toBeGreaterThanOrEqual(44);
    expect(target.width).toBeGreaterThanOrEqual(44);
  }
}

// [INTV:ARCH] 라우트별로 "이 콘텐츠 JSON의 이 필드가 화면에 보여야 한다"를 매핑한, 이 파일의
// 핵심 어서션 테이블 — if/return 체인으로 구성된 이유는 라우트마다 참조하는 콘텐츠 JSON과 검증
// 항목의 개수/형태가 전혀 달라 하나의 공통 로직으로 일반화하기 어렵기 때문(억지로 데이터 테이블화
// 하면 오히려 라우트별 특수 케이스를 표현하기 더 장황해진다). designIds 루프가 이 함수를 테마마다
// 반복 호출하므로, 여기 적힌 어서션 각각이 "5개 테마 모두 같은 콘텐츠를 담고 있는가"를 검증하는
// 셈이다.
async function expectSharedRouteEvidence(page: Page, path: string) {
  if (path === "/") {
    await expectExactContent(page, profileJson.headline);
    await expectExactContent(page, firstProject.title);
    return;
  }

  if (path === "/projects") {
    await expectExactContent(page, firstProject.title);
    const firstGroup = projectsJson.groups.find(
      (group) => group.id === firstProject.groupId,
    );
    if (firstGroup) {
      await expectContainedContent(page, firstGroup.label);
    }
    return;
  }

  if (path.startsWith("/projects/")) {
    await expectExactContent(page, firstProject.title);
    await expectContainedContent(page, firstProjectTechnology.label);
    await expectExactContent(page, firstProject.highlights[0]);

    // [INTV:EDGE] toBeVisible()만으로는 <img>가 "DOM에 존재하고 CSS로 안 숨겨짐"만 보장할 뿐,
    // 실제 이미지 파일이 깨지지 않고 로드됐는지는 보장하지 않는다(alt 텍스트만 남고 이미지는
    // 404인 상태도 visible로 통과한다) — naturalWidth/naturalHeight > 0으로 브라우저가 실제
    // 픽셀 데이터를 디코딩했는지까지 확인해, "이미지 경로 오타/자산 누락"을 놓치지 않는다.
    const projectImage = page.locator("main img").first();
    await expect(projectImage).toBeVisible();
    expect(
      await projectImage.evaluate((image) => {
        const element = image as HTMLImageElement;
        const bounds = element.getBoundingClientRect();

        return (
          element.complete &&
          element.naturalWidth > 0 &&
          element.naturalHeight > 0 &&
          bounds.width > 0 &&
          bounds.height > 0
        );
      }),
    ).toBe(true);
    return;
  }

  if (path === "/about") {
    await expectExactContent(page, skillsJson.focusAreas[0].title);
    await expectExactContent(page, experienceJson[0].title);
    await expect(
      page.locator("main").getByAltText(profileJson.photo.alt),
    ).toBeVisible();

    if (siteJson.pages.curation) {
      await expectExactContent(page, curationJson.nextReview.title);
    }
    return;
  }

  if (path === "/resume") {
    await expectContainedContent(page, profileJson.availability);
    await expectContainedContent(page, resumeJson.summary[0]);
    await expectExactContent(page, resumeJson.notes[0]);
    await expectExactContent(page, firstResumeProject.title);
    await expectExactContent(page, resumeJson.training[0].name);
    await expectExactContent(page, experienceJson[0].title);
    return;
  }

  if (path === "/contact") {
    await expectExactContent(page, contactJson.availability);
    await expectExactContent(page, contactJson.notes[0]);
    const firstPreferredLink = contactJson.preferred[0];
    const firstPreferredLinkLabel = linksJson.find(
      (link) => link.id === firstPreferredLink,
    )?.label;
    if (firstPreferredLinkLabel) {
      await expectContainedContent(page, firstPreferredLinkLabel);
    }
    return;
  }

  if (path === "/journey") {
    await expectExactContent(page, journeyNarrativeJson.milestones[0].title);
    await expectContainedContent(page, journeyNarrativeJson.milestones[0].state);
    await expectExactContent(page, journeyNarrativeJson.currentPosition.title);
    await expectExactContent(page, journeyNarrativeJson.currentPosition.body);
    return;
  }

  if (path === "/interview-map") {
    await expectContainedContent(page, interviewMapJson.referenceRepo.label);
    await expectContainedContent(page, interviewMapJson.tracks[0].items[0].label);
    await expectContainedContent(page, firstInterviewProject.title);
    await expectExactContent(page, interviewMapJson.gaps.items[0]);
  }
}

for (const designId of designIds) {
  test(`${designId}: renders every enabled route on shared content`, async ({
    page,
  }) => {
    test.slow();

    for (const { path } of enabledRoutes) {
      await expectDesignRoute(page, path, designId);
      await expectSharedRouteEvidence(page, path);
    }
  });

}

// [INTV:EDGE] 브라우저 콘솔의 error 레벨 메시지를 가로채, 텍스트에 "hydration"/"server rendered
// HTML"/"did not match" 같은 React 특유의 문구가 있는지 정규식으로 걸러낸다 — 이 테스트가 실제로
// 검증하려는 건 "SSR로 그려진 HTML과 클라이언트가 재구성한 트리가 일치하는가"인데, Playwright의
// 기본 assertion으로는 hydration mismatch를 직접 감지할 수단이 없다(화면은 결국 클라이언트 렌더로
// 정상처럼 보이기 때문). 테마를 순서대로 5번 전환(round-robin)하며 매번 새로 마운트되는 순간에
// mismatch 경고가 뜨는지를 누적 수집해, 루프가 끝난 뒤 한 번에 "전혀 없어야 한다"고 판정한다.
test("design switching preserves the current route and content debug query", async ({
  page,
}) => {
  test.slow();
  const hydrationErrors: string[] = [];

  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /hydration|server rendered HTML|did not match/i.test(message.text())
    ) {
      hydrationErrors.push(message.text());
    }
  });

  for (const [index, sourceDesign] of designIds.entries()) {
    const targetDesign = designIds[(index + 1) % designIds.length];
    await expectDesignRoute(
      page,
      "/projects?debug=content",
      sourceDesign,
    );

    await page
      .locator('summary[aria-label^="Change site design"]')
      .click();
    const designNavigation = page.getByRole("navigation", {
      name: "Site design",
    });
    await expect(designNavigation).toBeVisible();

    const expectedHref = expectedInternalHref(
      "/projects",
      targetDesign,
      true,
    );
    await designNavigation.locator(`a[href="${expectedHref}"]`).click();

    await expect(page).toHaveURL(
      new RegExp(`${expectedHref.replace(/[?&]/g, "\\$&")}$`),
    );
    await expect(
      page.locator(`[data-site-design="${targetDesign}"]`),
    ).toBeVisible();
  }

  expect(hydrationErrors).toEqual([]);
});

// [INTV:ARCH] content-readiness.ts가 판정하는 "템플릿 모드 vs 프로덕션 모드"가 실제로 페이지
// 메타데이터(robots meta 태그)와 /robots.txt 응답 양쪽에 일관되게 반영되는지 검증한다 — 이 값을
// 픽스처로 미리 정해두지 않고 process.env.PORTFOLIO_CONTENT_MODE를 테스트 시점에 그대로 읽는
// 이유는, 이 테스트를 실제 CI가 프로덕션 빌드로 돌리는 조건과 템플릿(데모) 빌드로 돌리는 조건
// 양쪽에서 똑같은 코드로 재사용하기 위함(테스트가 실행 환경의 실제 모드를 그대로 따라간다).
test("content mode controls page metadata and robots.txt", async ({
  page,
  request,
}) => {
  const isProductionContent =
    process.env.PORTFOLIO_CONTENT_MODE === "production";
  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    isProductionContent ? /index.*follow/i : /noindex.*nofollow/i,
  );

  const robotsResponse = await request.get("/robots.txt");
  expect(robotsResponse.ok()).toBe(true);
  expect(await robotsResponse.text()).toMatch(
    isProductionContent
      ? /User-Agent:\s*\*[\s\S]*Allow:\s*\//i
      : /User-Agent:\s*\*[\s\S]*Disallow:\s*\//i,
  );
});

// [INTV:EDGE] ?view= 쿼리에 목록에 없는 임의의 값이 들어와도(오타, 만료된 북마크, 악의적 조작 등)
// 서버가 에러를 던지는 대신 알려진 테마(editorial)로 조용히 대체(fallback)하는지 확인한다 —
// designs/config.ts의 파싱 로직이 실제로 이 방어적 기본값 규칙을 지키는지를, 존재하지 않는 테마
// 이름을 직접 넣어보는 방식으로 검증하는 것이 가장 확실하다.
test("an invalid design query falls back to editorial", async ({ page }) => {
  const response = await page.goto("/?view=not-a-design");

  expect(response?.ok()).toBe(true);
  await expect(page.locator('[data-site-design="editorial"]')).toBeVisible();
  await expect(
    page.getByLabel(
      presentationJson.ui.designSwitcherAriaTemplate.replace(
        "{label}",
        templateLabels.get("editorial") ?? "editorial",
      ),
    ),
  ).toBeVisible();
});

// [INTV:EDGE] prefers-reduced-motion이 globals.css의 미디어쿼리에 "선언되어 있다"는 사실만으로는
// 실제로 모든 애니메이션이 꺼지는지 보장할 수 없다(테마별 CSS 모듈이 그 규칙을 상속/재정의하다가
// 빠뜨릴 수 있음) — 그래서 이 테스트는 emulateMedia로 실제 브라우저의 reduced-motion 상태를
// 켠 뒤, document의 모든 요소(및 ::before/::after 가상 요소까지)를 순회하며 getComputedStyle로
// 실측한 애니메이션/트랜지션 지속시간과 무한 반복 여부를 직접 집계한다 — CSS 소스를 정적으로
// 읽는 대신 "브라우저가 실제로 계산한 결과"를 신뢰의 근거로 삼는다(카운터 애니메이션이 셀렉터
// 우선순위에 밀려 실제로는 안 꺼지는 경우도 이렇게 해야 잡힌다).
test("reduced motion disables sustained presentation animation", async ({
  page,
}) => {
  test.slow();
  await page.emulateMedia({ reducedMotion: "reduce" });

  for (const designId of designIds) {
    await expectDesignRoute(page, "/", designId);
    const motionState = await page.evaluate(() => {
      const durationToMilliseconds = (value: string) => {
        const numeric = Number.parseFloat(value);
        return value.trim().endsWith("ms") ? numeric : numeric * 1000;
      };

      let maximumDuration = 0;
      let hasInfiniteAnimation = false;

      for (const element of document.querySelectorAll("*")) {
        for (const pseudoElement of [null, "::before", "::after"] as const) {
          const style = getComputedStyle(element, pseudoElement);
          const durations = [
            ...style.animationDuration.split(","),
            ...style.transitionDuration.split(","),
          ].map(durationToMilliseconds);
          maximumDuration = Math.max(maximumDuration, ...durations);
          hasInfiniteAnimation ||= style.animationIterationCount
            .split(",")
            .some((count) => count.trim() === "infinite");
        }
      }

      return {
        hasInfiniteAnimation,
        maximumDuration,
        runningInfiniteAnimations: document
          .getAnimations()
          .some(
            (animation) =>
              animation.playState === "running" &&
              animation.effect?.getTiming().iterations === Infinity,
          ),
        scrollBehavior: getComputedStyle(document.documentElement)
          .scrollBehavior,
      };
    });

    expect(motionState.maximumDuration).toBeLessThanOrEqual(1);
    expect(motionState.hasInfiniteAnimation).toBe(false);
    expect(motionState.runningInfiniteAnimations).toBe(false);
    expect(motionState.scrollBehavior).toBe("auto");
  }
});

// [INTV:EDGE] 모바일 한 화면 안에서 "메뉴 열기 -> 디자인 스위처 열고 시트 위치 확인 -> 닫기 -> 다시
// 메뉴로 이동 -> 포커스 링 확인" 전체 동선을 한 번에 엮은 시나리오 테스트 — 개별 컴포넌트 단위
// 테스트(accessibility.spec.ts, interaction-performance.spec.ts)가 각자 검증하는 조각들이 실제
// "사용자가 순서대로 조작할 때"도 서로 어긋나지 않고 이어지는지를 확인하는 것이 목적이다.
// sheetPosition 계산은 하단 시트(bottom sheet) UI가 실제로 뷰포트 하단에 딱 붙고(bottomGap) 좌우
// 밖으로 넘치지 않는지(rightOverflow)를 픽셀 단위로 검증하고, 키보드 Tab 이후 outline/boxShadow
// 검사는 "포커스가 시각적으로도 보이는지"(WCAG 2.4.7)까지 스크린샷 없이 계산된 스타일로 확인한다.
test("mobile navigation reaches projects without losing the active design", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"));
  test.slow();

  for (const designId of designIds) {
    await expectDesignRoute(page, "/", designId);
    const mobileNavigation = page.locator(
      `nav[aria-label="${presentationJson.ui.mobileNavigationAriaLabel}"]`,
    );
    const menu = page
      .locator("details")
      .filter({ has: mobileNavigation })
      .locator(":scope > summary");
    const switcher = page.getByLabel(
      presentationJson.ui.designSwitcherAriaTemplate.replace(
        "{label}",
        templateLabels.get(designId) ?? designId,
      ),
    );

    await expect(menu).toBeVisible();
    await expect(switcher).toBeVisible();
    await expectMinimumTouchTargets(menu);
    await expectMinimumTouchTargets(switcher);

    await switcher.click();
    const designNavigation = page.getByRole("navigation", {
      name: presentationJson.ui.designNavigationAriaLabel,
    });
    await expect(designNavigation).toBeVisible();
    await expectMinimumTouchTargets(designNavigation.getByRole("link"));
    const closeDesignSheet = designNavigation.getByRole("button", {
      name: presentationJson.ui.designSwitcherCloseLabel,
    });
    await expect(closeDesignSheet).toBeVisible();
    await expectMinimumTouchTargets(closeDesignSheet);
    const sheetBounds = await designNavigation.boundingBox();
    expect(sheetBounds).not.toBeNull();
    const sheetPosition = await page.evaluate(
      ({ bottom, left, right }) => ({
        bottomGap: Math.abs(window.innerHeight - bottom),
        left,
        rightOverflow: Math.max(0, right - window.innerWidth),
      }),
      {
        bottom: (sheetBounds?.y ?? 0) + (sheetBounds?.height ?? 0),
        left: sheetBounds?.x ?? 0,
        right: (sheetBounds?.x ?? 0) + (sheetBounds?.width ?? 0),
      },
    );
    expect(sheetPosition.bottomGap).toBeLessThanOrEqual(2);
    expect(sheetPosition.left).toBeGreaterThanOrEqual(0);
    expect(sheetPosition.rightOverflow).toBeLessThanOrEqual(1);
    await closeDesignSheet.click();
    await expect(designNavigation).toBeHidden();
    await expect(switcher).toBeFocused();

    await menu.click();
    await expect(mobileNavigation).toBeVisible();
    const expectedHref = expectedActiveDesignNavigationHref(
      "/projects",
      designId,
    );
    const projectsLink = mobileNavigation
      .locator(`a[href="${expectedHref}"]`)
      .first();

    await expect(projectsLink).toBeVisible();
    await expect(projectsLink).toContainText(projectsNavigation.label);
    await expectMinimumTouchTargets(mobileNavigation.getByRole("link"));
    await menu.focus();
    await page.keyboard.press("Tab");
    const firstMobileLink = mobileNavigation.getByRole("link").first();
    await expect(firstMobileLink).toBeFocused();
    expect(
      await firstMobileLink.evaluate((element) => {
        const style = getComputedStyle(element);
        return (
          style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0
        ) || style.boxShadow !== "none";
      }),
    ).toBe(true);
    await projectsLink.click();
    await expect(page).toHaveURL(
      new RegExp(`${expectedHref.replace(/[?&]/g, "\\$&")}$`),
    );
    await expect(
      page.locator(`[data-site-design="${designId}"]`),
    ).toBeVisible();
  }
});

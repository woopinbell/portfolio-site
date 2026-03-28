// [INTV:ARCH] @testing-library/react 사용법은 journey/page.test.tsx 상단 주석 참고.
// within(요소)는 문서 전체가 아니라 특정 요소(예: 이 디자인 스위처 <nav> 안쪽)로 검색 범위를
// 좁혀서 같은 텍스트/role이 여러 군데 있어도 원하는 영역 안에서만 찾게 해준다.
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { getFeaturedProjects, getPortfolioContent } from "@/lib/portfolio";

import Home from "./page";

const content = getPortfolioContent();
const designIds = [
  "design",
  "classic",
  "editorial",
  "brutalist",
  "cinematic",
] as const;

afterEach(() => cleanup());

describe("Home", () => {
  it("renders the same journey evidence in the two original presentations", async () => {
    const journeyTitles = content.journey.map((item) => item.title);

    render(
      await Home({
        searchParams: Promise.resolve({ view: "design" }),
      }),
    );

    for (const title of journeyTitles) {
      expect(screen.getAllByText(title, { exact: true }).length).toBeGreaterThan(
        0,
      );
    }

    cleanup();
    render(
      await Home({
        searchParams: Promise.resolve({ view: "classic" }),
      }),
    );

    for (const title of journeyTitles) {
      expect(screen.getAllByText(title, { exact: true }).length).toBeGreaterThan(
        0,
      );
    }
  });

  it("uses editorial when no design is requested", async () => {
    const { container } = render(await Home({}));

    expect(
      container.querySelector('[data-site-design="editorial"]'),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(
        "Change site design. Current design: Editorial",
      ),
    ).toHaveTextContent("Design 03/05");
  });

  // [INTV:ARCH] it.each(배열)(...): 5개 디자인 테마 각각에 대해 "테마를 바꿔도 콘텐츠와
  // 내비게이션 구조가 일관되게 렌더링되는지"를 같은 검증 로직으로 반복 실행 — 테마 하나를
  // 추가/삭제해도 이 테스트 목록을 손으로 늘리거나 줄일 필요 없이 위쪽 designIds 배열만
  // 바뀌면 된다.
  it.each(designIds)(
    "renders shared content through the %s full-site design",
    async (designId) => {
      const { container } = render(
        await Home({
          searchParams: Promise.resolve({ view: designId }),
        }),
      );
      const design = content.presentation.templates.find(
        (template) => template.id === designId,
      );
      const root = container.querySelector(
        `[data-site-design="${designId}"]`,
      );
      const featuredProject = getFeaturedProjects(content)[0] ?? content.projects[0];
      const projectsNavItem = content.site.navigation.find(
        (item) => item.href === "/projects",
      );
      const expectedProjectsHref =
        designId === "editorial" ? "/projects" : `/projects?view=${designId}`;

      expect(design).toBeDefined();
      expect(root).toBeInTheDocument();
      expect(
        screen.getAllByRole("heading", { level: 1 })[0],
      ).toHaveTextContent(/\S/);
      expect(
        screen.getByLabelText(
          `Change site design. Current design: ${design?.label}`,
        ),
      ).toBeInTheDocument();

      if (featuredProject) {
        expect(
          screen.getAllByText(featuredProject.title, { exact: true }).length,
        ).toBeGreaterThan(0);
      }

      expect(projectsNavItem).toBeDefined();
      const projectLinks = Array.from(root?.querySelectorAll("a") ?? []);
      expect(
        projectLinks.some(
          (link) => link.getAttribute("href") === expectedProjectsHref,
        ),
      ).toBe(true);

      const designNavigation = screen.getByRole("navigation", {
        hidden: true,
        name: "Site design",
      });
      expect(
        within(designNavigation).getAllByRole("link", { hidden: true }),
      ).toHaveLength(designIds.length);
    },
  );

  it("falls back to editorial for an unknown design", async () => {
    const { container } = render(
      await Home({
        searchParams: Promise.resolve({ view: "not-a-design" }),
      }),
    );

    expect(
      container.querySelector('[data-site-design="editorial"]'),
    ).toBeInTheDocument();
  });

  it("preserves content debug state across navigation and design changes", async () => {
    render(
      await Home({
        searchParams: Promise.resolve({
          debug: "content",
          view: "brutalist",
        }),
      }),
    );

    const designNavigation = screen.getByRole("navigation", {
      hidden: true,
      name: "Site design",
    });
    const editorialLink = within(designNavigation).getByRole("link", {
      hidden: true,
      name: /Editorial/,
    });
    const cinematicLink = within(designNavigation).getByRole("link", {
      hidden: true,
      name: /Cinematic/,
    });
    const brutalistRoot = document.querySelector(
      '[data-site-design="brutalist"]',
    );

    // [INTV:EDGE] 이 값들은 lib/portfolio/template-href.ts의 ?view=/&debug= 쿼리 조립 규칙이
    // 실제 렌더링 결과에도 정확히 반영되는지 검증한다 — editorial은 기본 테마라 view= 없이
    // debug=content만 붙고, cinematic처럼 기본이 아닌 테마로 이동하는 링크는 view=와 debug=가
    // 둘 다 붙어야 한다(template-href.ts의 shouldIncludeView 로직을 실제 DOM으로 검증).
    expect(editorialLink).toHaveAttribute("href", "/?debug=content");
    expect(cinematicLink).toHaveAttribute(
      "href",
      "/?view=cinematic&debug=content",
    );
    expect(
      Array.from(brutalistRoot?.querySelectorAll("a") ?? [])
        .some(
          (link) =>
            link.getAttribute("href") ===
            "/projects?view=brutalist&debug=content",
        ),
    ).toBe(true);
  });
});

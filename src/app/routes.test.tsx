import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { getPortfolioContent } from "@/lib/portfolio";

import AboutPage from "./about/page";
import ContactPage from "./contact/page";
import InterviewMapPage from "./interview-map/page";
import JourneyPage from "./journey/page";
import Home from "./page";
import ProjectDetailPage from "./projects/[projectId]/page";
import ProjectsPage from "./projects/page";
import ResumePage from "./resume/page";

afterEach(() => cleanup());

const content = getPortfolioContent();
const firstProject = content.projects[0];

if (!firstProject) {
  throw new Error("Route characterization requires at least one enabled project.");
}

// [INTV:ARCH] 각 라우트를 { currentPath, heading, renderPage } 객체로 표로 정리 — renderPage는
// 즉시 호출된 결과가 아니라 "호출하면 실행되는 함수"(썽크)로 넘겨서, 실제 페이지 렌더링은 아래
// it.each 콜백 안에서 필요한 시점에만 일어나게 미뤄둔다(배열을 만드는 시점에 8개 페이지를 전부
// 미리 렌더링해버리면, 그중 하나가 실패해도 원인 추적이 어려워지고 불필요한 렌더링 비용도
// 발생한다).
const routes = [
  {
    currentPath: "/",
    heading: content.profile.role,
    renderPage: () =>
      Home({
        searchParams: Promise.resolve({ debug: "content", view: "classic" }),
      }),
  },
  {
    currentPath: "/about",
    heading: "About",
    renderPage: () =>
      AboutPage({
        searchParams: Promise.resolve({ debug: "content", view: "classic" }),
      }),
  },
  {
    currentPath: "/contact",
    heading: "Contact",
    renderPage: () =>
      ContactPage({
        searchParams: Promise.resolve({ debug: "content", view: "classic" }),
      }),
  },
  {
    currentPath: "/interview-map",
    heading: "Interview Map",
    renderPage: () =>
      InterviewMapPage({
        searchParams: Promise.resolve({ debug: "content", view: "classic" }),
      }),
  },
  {
    currentPath: "/journey",
    heading: "Journey",
    renderPage: () =>
      JourneyPage({
        searchParams: Promise.resolve({ debug: "content", view: "classic" }),
      }),
  },
  {
    currentPath: "/projects",
    heading: "Project archive",
    renderPage: () =>
      ProjectsPage({
        searchParams: Promise.resolve({ debug: "content", view: "classic" }),
      }),
  },
  {
    currentPath: `/projects/${firstProject.id}`,
    heading: firstProject.title,
    renderPage: () =>
      ProjectDetailPage({
        params: Promise.resolve({ projectId: firstProject.id }),
        searchParams: Promise.resolve({ debug: "content", view: "classic" }),
      }),
  },
  {
    currentPath: "/resume",
    heading: "Resume",
    renderPage: () =>
      ResumePage({
        searchParams: Promise.resolve({ debug: "content", view: "classic" }),
      }),
  },
];

// [INTV:ARCH] "$currentPath"처럼 문자열 안에 $필드명을 쓰면, it.each가 routes 배열의 각
// 객체에서 그 필드값을 읽어 테스트 제목에 그대로 끼워 넣어준다(배열 형태 it.each의 %s
// 자리표시자와 같은 역할을 객체 형태에서 하는 방식). 8개 라우트 페이지 전부가 "1개의 h1,
// data-home-template 속성이 붙은 main, 콘텐츠 디버그 라벨, 디자인 스위처의 현재 항목 표시" 같은
// 공통 셸 규약을 지키는지 한 번에 검증하는 회귀 테스트 — 테마/페이지가 늘어나도 "모든 페이지가
// 지켜야 할 최소 계약"을 한곳에서 강제한다.
describe("portfolio routes", () => {
  it.each(routes)(
    "preserves the classic shell contract for $currentPath",
    async ({ currentPath, heading, renderPage }) => {
      const { container } = render(await renderPage());

      expect(
        screen.getByRole("heading", { level: 1, name: heading }),
      ).toBeInTheDocument();
      expect(container.querySelector("main")).toHaveAttribute(
        "data-home-template",
        "classic",
      );
      expect(
        screen.getAllByLabelText(/^Content source:/).length,
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByRole("link", { name: "Projects" })[0],
      ).toHaveAttribute("href", "/projects?view=classic&debug=content");

      const designNavigation = screen.getByRole("navigation", {
        hidden: true,
        name: "Site design",
      });
      expect(
        within(designNavigation).getByRole("link", {
          hidden: true,
          name: /Classic/,
        }),
      ).toHaveAttribute("aria-current", "page");
      expect(
        within(designNavigation).getByRole("link", {
          hidden: true,
          name: /Design/,
        }),
      ).toHaveAttribute(
        "href",
        `${currentPath}?view=design&debug=content`,
      );
    },
  );

  // [INTV:EDGE] ?view=classic&view=editorial처럼 같은 쿼리 키가 두 번 들어오면 Next는 이를
  // 문자열 배열로 넘겨준다 — lib/portfolio/selectors.ts의 resolveHomeTemplateId/resolveContentDebug가
  // 그 경우 배열의 첫 값만 쓰기로 한 정책을, 실제 렌더링 결과로 검증하는 테스트.
  it("uses the first value from repeated view and debug queries", async () => {
    const { container } = render(
      await AboutPage({
        searchParams: Promise.resolve({
          debug: ["content", "off"],
          view: ["classic", "editorial"],
        }),
      }),
    );

    expect(container.querySelector("main")).toHaveAttribute(
      "data-home-template",
      "classic",
    );
    expect(screen.getAllByLabelText(/^Content source:/).length).toBeGreaterThan(
      0,
    );
  });
});

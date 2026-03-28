import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import AboutPage from "@/app/about/page";
import ContactPage from "@/app/contact/page";
import Home from "@/app/page";
import InterviewMapPage from "@/app/interview-map/page";
import JourneyPage from "@/app/journey/page";
import ProjectDetailPage from "@/app/projects/[projectId]/page";
import ProjectsPage from "@/app/projects/page";
import ResumePage from "@/app/resume/page";
import { getPortfolioContent, type SiteDesignId } from "@/lib/portfolio";

const content = getPortfolioContent();
const project = content.projects[0];

if (!project) {
  throw new Error("Route view model tests require an enabled project.");
}

const designIds = [
  "design",
  "classic",
  "editorial",
  "brutalist",
  "cinematic",
] as const satisfies readonly SiteDesignId[];

const routes = [
  {
    id: "home",
    renderPage: (view: SiteDesignId) =>
      Home({ searchParams: Promise.resolve({ view }) }),
  },
  {
    id: "projects",
    renderPage: (view: SiteDesignId) =>
      ProjectsPage({ searchParams: Promise.resolve({ view }) }),
  },
  {
    id: "project-detail",
    renderPage: (view: SiteDesignId) =>
      ProjectDetailPage({
        params: Promise.resolve({ projectId: project.id }),
        searchParams: Promise.resolve({ view }),
      }),
  },
  {
    id: "about",
    renderPage: (view: SiteDesignId) =>
      AboutPage({ searchParams: Promise.resolve({ view }) }),
  },
  {
    id: "resume",
    renderPage: (view: SiteDesignId) =>
      ResumePage({ searchParams: Promise.resolve({ view }) }),
  },
  {
    id: "contact",
    renderPage: (view: SiteDesignId) =>
      ContactPage({ searchParams: Promise.resolve({ view }) }),
  },
  {
    id: "journey",
    renderPage: (view: SiteDesignId) =>
      JourneyPage({ searchParams: Promise.resolve({ view }) }),
  },
  {
    id: "interview-map",
    renderPage: (view: SiteDesignId) =>
      InterviewMapPage({ searchParams: Promise.resolve({ view }) }),
  },
];

afterEach(() => cleanup());

// [INTV:ARCH] describe/it은 그냥 평범한 함수 호출이라, 일반 for문 안에서 호출해도 된다 —
// 여기서는 바깥 for로 5개 디자인을 돌고, 안쪽 it.each로 8개 라우트를 돌려서 5 × 8 = 40개의
// 테스트 케이스를 배열 두 개만으로 만들어낸다(새 라우트나 디자인이 추가돼도 이 파일을 손댈
// 필요가 없다).
describe("route view model rendering", () => {
  for (const designId of designIds) {
    it.each(routes)(
      `keeps the ${designId} HTML boundary for $id`,
      async ({ renderPage }) => {
        const { container } = render(await renderPage(designId));

        expect(
          container.querySelector(`[data-site-design="${designId}"]`),
        ).toBeInTheDocument();
        if (designId === "design" || designId === "classic") {
          expect(
            container.querySelector(`[data-route-renderer="${designId}"]`),
          ).toBeInTheDocument();
        }
        expect(container.querySelector("h1")).toHaveTextContent(/\S/);
      },
    );
  }
});

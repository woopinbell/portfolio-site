import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { renderDesignRoute } from "@/designs/registry";
import { resolvePortfolioPageContext } from "@/lib/portfolio/page-context";
import { createProjectIndexViewModel } from "@/lib/portfolio/view-models";
import {
  getPortfolioContent,
  isSitePageEnabled,
  type RouteSearchParams,
} from "@/lib/portfolio";
import { createRouteMetadata } from "@/lib/site-metadata";

// [INTV:ARCH] about/page.tsx와 동일한 구조라 세부 주석은 그쪽 참고.
export function generateMetadata(): Metadata {
  const content = getPortfolioContent();
  if (!isSitePageEnabled("projects", content)) notFound();
  // [INTV:EDGE] 다른 라우트(about, resume 등)는 pages.<route>.hero를 바로 쓰는데 여기만
  // pages.projects.design.hero처럼 "design" 테마 하위로 한 단계 더 들어간다 — projects 페이지는
  // 히어로 문구가 디자인 테마별로 따로 정의돼 있고, 메타데이터(og:title 등)는 그중 "design" 테마
  // 값을 대표로 쓰기로 한 콘텐츠 스키마상의 선택.
  const hero = content.presentation.pages.projects.design.hero;

  return createRouteMetadata({
    description: hero.body,
    path: "/projects",
    site: content.site,
    title: hero.title,
  });
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams?: RouteSearchParams;
}) {
  const content = getPortfolioContent();
  if (!isSitePageEnabled("projects", content)) notFound();

  const { activeTemplate, contentDebug } =
    await resolvePortfolioPageContext({
      content,
      currentPath: "/projects",
      searchParams,
    });

  return renderDesignRoute(activeTemplate, {
    contentDebug,
    currentPath: "/projects",
    route: "projects",
    viewModel: createProjectIndexViewModel(content),
  });
}

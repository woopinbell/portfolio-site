import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { renderDesignRoute } from "@/designs/registry";
import { resolvePortfolioPageContext } from "@/lib/portfolio/page-context";
import { createResumeViewModel } from "@/lib/portfolio/view-models";
import {
  getPortfolioContent,
  isSitePageEnabled,
  type RouteSearchParams,
} from "@/lib/portfolio";
import { createRouteMetadata } from "@/lib/site-metadata";

// [INTV:ARCH] about/page.tsx와 동일한 구조라 세부 주석은 그쪽 참고.
export function generateMetadata(): Metadata {
  const content = getPortfolioContent();
  if (!isSitePageEnabled("resume", content)) notFound();
  const hero = content.presentation.pages.resume.hero;

  return createRouteMetadata({
    description: hero.body,
    path: "/resume",
    site: content.site,
    title: hero.title,
  });
}

export default async function ResumePage({
  searchParams,
}: {
  searchParams?: RouteSearchParams;
}) {
  const content = getPortfolioContent();
  if (!isSitePageEnabled("resume", content)) notFound();

  const { activeTemplate, contentDebug } =
    await resolvePortfolioPageContext({
      content,
      currentPath: "/resume",
      searchParams,
    });

  return renderDesignRoute(activeTemplate, {
    contentDebug,
    currentPath: "/resume",
    route: "resume",
    viewModel: createResumeViewModel(content),
  });
}

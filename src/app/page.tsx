import type { Metadata } from "next";
import { renderDesignRoute } from "@/designs/registry";
import { resolvePortfolioPageContext } from "@/lib/portfolio/page-context";
import { createHomeViewModel } from "@/lib/portfolio/view-models";
import {
  getPortfolioContent,
  type RouteSearchParams,
} from "@/lib/portfolio";
import { createRouteMetadata } from "@/lib/site-metadata";

// [INTV:ARCH] src/app/page.tsx는 Next.js App Router에서 루트 경로("/")를 나타내는 예약된
// 파일명. 다른 라우트(about 등)와 달리 isSitePageEnabled 체크가 없다 — 홈은 항상 노출되는
// 페이지라는 전제(site.json의 pages 플래그 목록에 home이 아예 없는 것과 일관됨).
type HomePageProps = {
  searchParams?: RouteSearchParams;
};

export function generateMetadata(): Metadata {
  const content = getPortfolioContent();

  return createRouteMetadata({
    description: content.site.description,
    path: "/",
    site: content.site,
    title: content.site.title,
  });
}

export default async function Home({ searchParams }: HomePageProps) {
  const { activeTemplate, content, contentDebug } =
    await resolvePortfolioPageContext({
      currentPath: "/",
      searchParams,
    });

  return renderDesignRoute(activeTemplate, {
    contentDebug,
    currentPath: "/",
    route: "home",
    viewModel: createHomeViewModel(content),
  });
}

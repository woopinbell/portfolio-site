import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { renderDesignRoute } from "@/designs/registry";
import { resolvePortfolioPageContext } from "@/lib/portfolio/page-context";
import { createContactViewModel } from "@/lib/portfolio/view-models";
import {
  getPortfolioContent,
  isSitePageEnabled,
  type RouteSearchParams,
} from "@/lib/portfolio";
import { createRouteMetadata } from "@/lib/site-metadata";

// [INTV:ARCH] about/page.tsx와 동일한 구조(라우트별 메타데이터 생성 + 서버 컴포넌트 + 테마
// 렌더링)라 세부 주석은 그쪽 참고.
export function generateMetadata(): Metadata {
  const content = getPortfolioContent();
  if (!isSitePageEnabled("contact", content)) notFound();

  return createRouteMetadata({
    description: content.contact.intro,
    path: "/contact",
    site: content.site,
    title: content.contact.title,
  });
}

export default async function ContactPage({
  searchParams,
}: {
  searchParams?: RouteSearchParams;
}) {
  const content = getPortfolioContent();
  if (!isSitePageEnabled("contact", content)) notFound();

  const { activeTemplate, contentDebug } =
    await resolvePortfolioPageContext({
      content,
      currentPath: "/contact",
      searchParams,
    });

  return renderDesignRoute(activeTemplate, {
    contentDebug,
    currentPath: "/contact",
    route: "contact",
    viewModel: createContactViewModel(content),
  });
}

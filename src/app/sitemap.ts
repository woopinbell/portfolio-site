import type { MetadataRoute } from "next";

import {
  resolvePortfolioContentMode,
  resolveProductionSiteUrl,
} from "@/lib/content-readiness";
import { getPortfolioContent } from "@/lib/portfolio";
import { createSitemap } from "@/lib/site-metadata";

// [INTV:ARCH] robots.ts와 같은 방식의 Next.js 예약 파일 — src/app/sitemap.ts가 반환하는 값이
// /sitemap.xml 응답이 된다.
export default function sitemap(): MetadataRoute.Sitemap {
  const mode = resolvePortfolioContentMode(
    process.env.PORTFOLIO_CONTENT_MODE,
  );
  const siteUrl =
    mode === "production"
      ? resolveProductionSiteUrl(process.env.SITE_URL)
      : undefined;

  return createSitemap({ content: getPortfolioContent(), mode, siteUrl });
}

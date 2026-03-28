import type { MetadataRoute } from "next";

import {
  resolvePortfolioContentMode,
  resolveProductionSiteUrl,
} from "@/lib/content-readiness";
import { createRobots } from "@/lib/site-metadata";

// [INTV:ARCH] src/app/robots.ts라는 파일 경로/이름 자체가 Next.js의 예약 컨벤션 — default
// export 함수가 반환하는 값으로 /robots.txt 응답을 자동 생성해준다(별도 라우트 등록이나 텍스트
// 파일 작성이 필요 없음). not-found.tsx처럼 파일명만으로 동작이 결정되는 Next 특수 파일 중
// 하나다.
export default function robots(): MetadataRoute.Robots {
  const mode = resolvePortfolioContentMode(
    process.env.PORTFOLIO_CONTENT_MODE,
  );
  const siteUrl =
    mode === "production"
      ? resolveProductionSiteUrl(process.env.SITE_URL)
      : undefined;

  return createRobots({ mode, siteUrl });
}

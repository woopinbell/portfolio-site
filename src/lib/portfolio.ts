// [INTV:ARCH] 이 파일은 실질적인 로직이 없는 "배럴(barrel) 파일" — src/lib/portfolio/ 아래 여러
// 모듈(types, content, selectors)에 흩어진 export를 한 군데로 모아 재노출한다. 덕분에 다른 파일들은
// `import { getPortfolioContent, type PortfolioProject, ... } from "@/lib/portfolio"`처럼 세부 파일
// 경로를 몰라도 하나의 경로에서 필요한 걸 다 가져올 수 있다 — 실제로 코드베이스 전반의 컴포넌트/
// 라우트가 이 경로를 쓴다. 내부 구현이 여러 파일로 쪼개져도 이 배럴 파일의 export 목록만 유지되면
// 소비하는 쪽 import 구문은 안 바뀐다는 게 이점.
export * from "./portfolio/types";
export { getEnabledLinks, getPortfolioContent } from "./portfolio/content";
export {
  getContentLinksByPlacement,
  getExternalLinkProps,
  getFeaturedProjects,
  getPreferredContactLinks,
  getProjectById,
  getProjectCardLinks,
  getProjectDetailLinks,
  getProjectLink,
  getProjectLinksForPlacement,
  getProjectMetricValue,
  getResumeProjects,
  getTemplateHref,
  isProjectLive,
  isSitePageEnabled,
  resolveContentDebug,
  resolveHomeTemplateId,
  resolveTechStackItem,
} from "./portfolio/selectors";

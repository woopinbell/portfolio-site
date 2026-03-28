// [INTV:ARCH] Playwright e2e 스펙들(visual.spec.ts, portfolio.spec.ts 등)이 "테마 5개 × 라우트 N개"
// 조합을 반복해서 테스트해야 하는데, 그 조합을 각 스펙 파일마다 따로 나열하면 라우트/테마가 추가될
// 때마다 여러 파일을 손봐야 한다 — 이 파일이 그 조합의 단일 진실 공급원 역할을 한다(src/designs 하위
// 테마 목록, site.json의 pages 플래그와 실제 콘텐츠를 반영해 "지금 활성화된" 라우트만 걸러낸다).
import projectsJson from "../../src/content/projects.json";
import siteJson from "../../src/content/site.json";

export const designIds = [
  "design",
  "classic",
  "editorial",
  "brutalist",
  "cinematic",
] as const;

export type DesignId = (typeof designIds)[number];

export const firstEnabledProject = projectsJson.items.find(
  (project) => project.enabled !== false,
);

if (!firstEnabledProject) {
  throw new Error("The portfolio needs at least one enabled project.");
}

const routeDefinitions = [
  { path: "/", pageId: undefined },
  { path: "/projects", pageId: "projects" },
  { path: `/projects/${firstEnabledProject.id}`, pageId: "projects" },
  { path: "/about", pageId: "about" },
  { path: "/resume", pageId: "resume" },
  { path: "/contact", pageId: "contact" },
  { path: "/journey", pageId: "journey" },
  { path: "/interview-map", pageId: "interviewMap" },
] as const;

// [INTV:EDGE] site.json에서 비활성화된 페이지(pages.<id> === false, selectors.ts의
// isSitePageEnabled와 같은 판정 규칙)로의 라우트는 e2e 테스트 대상에서도 제외한다 — 그렇지 않으면
// "테마 설정으로 끈 페이지"를 테스트가 방문 시도했다가 404로 실패하는, 콘텐츠 설정과 무관하게 늘
// 깨지는 테스트가 된다.
export const enabledRoutes = routeDefinitions.filter(
  ({ pageId }) => !pageId || siteJson.pages?.[pageId] !== false,
);

// [INTV:TRAP] URL 생성자에 더미 origin("https://portfolio.test")을 base로 넘기는 건 content-loader.ts의
// addInternalRouteIssue와 같은 트릭 — path가 상대 경로 문자열이라 그 자체로는 URL 생성자에 못 넣는다.
// searchParams.set으로 기존 쿼리를 안전하게 보존하면서 "view" 파라미터만 추가/교체한 뒤, 다시 상대
// 경로 형태(pathname+search+hash)로만 잘라 돌려준다 — 문자열을 직접 이어붙이면(`${path}?view=...`)
// path에 이미 쿼리스트링이 있는 경우 "?"가 중복되는 흔한 버그가 생긴다.
export function withExplicitDesign(path: string, designId: DesignId) {
  const url = new URL(path, "https://portfolio.test");
  url.searchParams.set("view", designId);
  return `${url.pathname}${url.search}${url.hash}`;
}

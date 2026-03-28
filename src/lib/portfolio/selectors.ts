import {
  getPortfolioContent,
  portfolioPresentation,
  portfolioTechStackById,
} from "./content";
import type {
  ContentLink,
  HomeTemplateId,
  LinkPlacement,
  LinkType,
  PortfolioContent,
  PortfolioProject,
  PresentationContent,
  ProjectMetricFilter,
  SitePageId,
  TechStackItem,
} from "./types";
import { createTemplateHref } from "./template-href";

// [INTV:EDGE] page-context.ts가 URL의 ?view= 쿼리값을 여기로 넘긴다. Next.js의 searchParams는
// 같은 키가 여러 번 나오면 string[]로 들어올 수 있어서(예: ?view=a&view=b) 배열이면 첫 값만 취하고,
// 그 값이 실제로 존재하는 테마 id와 일치하는지 검증한 뒤에만 신뢰한다 — 잘못되거나 존재하지 않는
// 값이면 항상 기본 테마로 안전하게 되돌아간다(사용자가 URL을 직접 조작해 ?view=nonexistent 같은
// 값을 넣어도 앱이 깨지지 않고 조용히 기본값으로 폴백하는, 신뢰할 수 없는 입력에 대한 방어).
export function resolveHomeTemplateId(
  value: string | string[] | undefined,
  content: PresentationContent = portfolioPresentation,
): HomeTemplateId {
  const templateId = Array.isArray(value) ? value[0] : value;

  if (
    templateId &&
    content.templates.some((template) => template.id === templateId)
  ) {
    return templateId as HomeTemplateId;
  }

  return content.defaultHomeTemplate;
}

export function resolveContentDebug(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) === "content";
}

// [INTV:TRADE_OFF] 옵셔널 체이닝(?.) + `!== false` 비교: pages 설정 자체가 없거나 해당 페이지 키가
// 없으면 언디파인드가 되는데, 언디파인드는 false와 같지 않으므로 결과적으로 "명시적으로 false라고
// 꺼둔 경우만 비활성, 그 외엔 기본 활성"이라는 화이트리스트가 아닌 블랙리스트 방식의 기능 플래그
// 판정이 된다 — 새 페이지를 추가했을 때 site.json의 pages 설정에 아직 그 키가 없어도 기본적으로
// 노출되는 쪽을 택한 설계(반대로 화이트리스트 방식이었다면 새 페이지마다 명시적으로 켜줘야 해서,
// 깜빡하면 새 페이지가 조용히 숨겨지는 실수가 더 쉽게 생긴다).
export function isSitePageEnabled(
  pageId: SitePageId,
  content: PortfolioContent = getPortfolioContent(),
) {
  return content.site.pages?.[pageId] !== false;
}

// [INTV:ARCH] template-href.ts의 createTemplateHref를 감싸면서, "기본 테마가 무엇인지"를 매번
// 인자로 안 받고 portfolioPresentation에서 바로 읽어와 채워주는 얇은 래퍼 — 순수 함수(createTemplateHref)와
// 콘텐츠에 의존하는 편의 함수를 분리해, 전자는 인자만으로 완전히 테스트 가능하게 유지.
export function getTemplateHref(
  href: string,
  templateId?: HomeTemplateId,
  options: { alwaysInclude?: boolean; contentDebug?: boolean } = {},
) {
  return createTemplateHref(
    href,
    templateId,
    portfolioPresentation.defaultHomeTemplate,
    options,
  );
}

// [INTV:EDGE] 콘텐츠에 등록되지 않은(오타 등으로) 기술 스택 id가 들어와도 앱이 죽지 않도록, 못
// 찾으면 그 id를 그대로 라벨로 쓰는 중립적인 기본값(fallback)을 돌려준다 — 알 수 없는 데이터에
// 대한 방어적 설계(예외를 던지는 대신 눈에 띄는 형태로나마 렌더링을 계속하게 해, 콘텐츠 오타 하나가
// 페이지 전체를 죽이지 않도록 한다).
export function resolveTechStackItem(
  id: string,
): TechStackItem {
  return (
    portfolioTechStackById.get(id) ?? {
      id,
      label: id,
      icon: "tool",
      color: "#9cc8b1",
    }
  );
}

// [INTV:ARCH] "프로젝트 지표(metric)"는 콘텐츠에서 필터 조건(특정 프로젝트 id들/그룹/태그/featured
// 여부/배포 상태)을 정의해두면 그 조건에 맞는 프로젝트 수를 자동으로 세어 홈/프로젝트 페이지의
// 통계 카드에 보여주는 구조다 — 숫자를 코드에 하드코딩하지 않고 필터 규칙만 콘텐츠로 관리하기
// 위한 설계(프로젝트를 추가/제외해도 통계 카드 숫자가 코드 변경 없이 자동으로 맞춰진다). 이 함수는
// 프로젝트 하나가 그 필터 조건에 맞는지 판정한다.
function projectMatchesMetricFilter(
  project: PortfolioProject,
  filter: ProjectMetricFilter | undefined,
) {
  if (!filter) {
    return true;
  }

  if (filter.projectIds && !filter.projectIds.includes(project.id)) {
    return false;
  }

  if (filter.groupIds && !filter.groupIds.includes(project.groupId)) {
    return false;
  }

  if (filter.tags && !filter.tags.every((tag) => project.tags.includes(tag))) {
    return false;
  }

  if (filter.featured !== undefined && Boolean(project.featured) !== filter.featured) {
    return false;
  }

  if (
    filter.deploymentStatuses &&
    !filter.deploymentStatuses.includes(project.deployment.status)
  ) {
    return false;
  }

  return true;
}

// [INTV:ARCH] 필터에 맞는 프로젝트를 모은 뒤, 지표의 집계 방식(aggregate)에 따라 "몇 개인지"를
// 셀지 "하이라이트를 모두 합쳐 몇 개인지"를 셀지를 고른다 — 메트릭 하나로 서로 다른 두 가지 숫자
// (프로젝트 개수 vs 성과 항목 총합)를 표현할 수 있게 한 것.
export function getProjectMetricValue(
  metricId: string,
  content: PortfolioContent = getPortfolioContent(),
) {
  const metric = content.projectMetrics.find((item) => item.id === metricId);

  if (!metric) {
    return 0;
  }

  const matchingProjects = content.projects.filter((project) =>
    projectMatchesMetricFilter(project, metric.filter),
  );

  if (metric.aggregate === "highlights") {
    return matchingProjects.reduce(
      (total, project) => total + project.highlights.length,
      0,
    );
  }

  return matchingProjects.length;
}

export function getFeaturedProjects(
  content: PortfolioContent = getPortfolioContent(),
) {
  return content.projects.filter((project) => project.featured);
}

export function getProjectById(
  projectId: string,
  content: PortfolioContent = getPortfolioContent(),
) {
  return content.projects.find((project) => project.id === projectId) ?? null;
}

export function getResumeProjects(
  content: PortfolioContent = getPortfolioContent(),
) {
  const byId = new Map(content.projects.map((project) => [project.id, project]));

  return content.resume.projectIds
    .map((projectId) => byId.get(projectId))
    // [INTV:TRAP] `(project): project is PortfolioProject => ...` 는 TS의 사용자 정의 타입 가드 —
    // filter가 단순 boolean 콜백이면 결과 배열의 타입은 여전히 (PortfolioProject | undefined)[]로
    // 남는데, 이렇게 "이 값이 참이면 PortfolioProject가 맞다"고 타입 단언을 겸한 반환 타입을 명시하면
    // filter 이후 배열에서 undefined가 사라진 PortfolioProject[]로 좁혀진다(존재하지 않는 projectId가
    // 섞여 있어도 안전하게 걸러냄). 이 타입 가드 없이 그냥 Boolean을 콜백으로 넘기면(.filter(Boolean))
    // 런타임 동작은 같지만 타입은 여전히 undefined를 포함한 채로 남아, 이후 코드에서 매번 불필요한
    // null 체크나 타입 단언이 필요해진다.
    .filter((project): project is PortfolioProject => Boolean(project));
}

export function getPreferredContactLinks(
  content: PortfolioContent = getPortfolioContent(),
) {
  const byId = new Map(content.links.map((link) => [link.id, link]));

  return content.contact.preferred
    .map((id) => byId.get(id))
    .filter((link): link is ContentLink => Boolean(link));
}

export function getProjectLink(project: PortfolioProject, type: LinkType) {
  return project.links.find((link) => link.type === type) ?? null;
}

export function isProjectLive(project: PortfolioProject) {
  return Boolean(
    project.deployment.status === "live" && getProjectLink(project, "demo"),
  );
}

export function getProjectCardLinks(project: PortfolioProject) {
  return getProjectLinksForPlacement(project, "card");
}

export function getProjectDetailLinks(project: PortfolioProject) {
  return getProjectLinksForPlacement(project, "detail");
}

// [INTV:ARCH] 같은 링크 목록이라도 "어디에 노출되는지"(placement: 카드 위인지 상세 페이지인지)에
// 따라 어떤 링크를 보여줄지가 다를 수 있어, 각 링크 데이터에 placements 배열을 두고 여기서 그
// 배치 위치가 포함되는지로 걸러낸다 — demo 링크는 실제로 배포돼 있을 때만(isProjectLive) 노출하는
// 예외 규칙도 이 함수 하나에 모여 있다.
export function getProjectLinksForPlacement(
  project: PortfolioProject,
  placement: LinkPlacement,
) {
  return project.links.filter((link) => {
    if (!link.placements?.includes(placement)) {
      return false;
    }

    if (link.type === "demo") {
      return isProjectLive(project);
    }

    return true;
  });
}

export function getContentLinksByPlacement(
  placement: LinkPlacement,
  content: PortfolioContent = getPortfolioContent(),
) {
  return content.links.filter((link) => link.placements?.includes(placement));
}

// [INTV:EDGE] components/portfolio/content-link.tsx의 ContentLinkView가 그대로 쓰는 헬퍼 — 외부
// 링크일 때만 rel="noreferrer" target="_blank"를 붙여준다(그 두 속성의 의미는 content-link.tsx
// 주석 참고).
export function getExternalLinkProps(link: ContentLink) {
  if (!link.external) {
    return {};
  }

  return {
    rel: "noreferrer",
    target: "_blank",
  };
}

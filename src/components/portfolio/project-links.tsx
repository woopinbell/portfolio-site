import { ArrowUpRightIcon, ExternalLinkIcon } from "@/components/icons";
import {
  getProjectCardLinks,
  getProjectDetailLinks,
  isProjectLive,
  type ContentLink,
  type HomeTemplateId,
  type PortfolioProject,
} from "@/lib/portfolio";
import { ContentLinkView } from "./content-link";

// [INTV:EDGE] 데모(배포) 링크는 실제로 프로젝트가 현재 운영 중일 때만 보여준다 — 소스코드
// 링크 등은 프로젝트 상태와 무관하게 항상 노출(죽은 데모 링크를 클릭하게 만들지 않기 위한 방어).
function isVisibleProjectLink(project: PortfolioProject, link: ContentLink) {
  if (link.type === "demo") {
    return isProjectLive(project);
  }

  return true;
}

// [INTV:ARCH] ProjectLinks(상세 페이지용)와 ProjectCardLinks(카드용) 둘 다 "링크 목록을
// 필터링해서 렌더링"하는 로직은 같고 어떤 링크 목록을 가져오는지(getProjectDetailLinks vs
// getProjectCardLinks)만 다르다 — 그 공통 렌더링 부분만 이 내부 헬퍼로 뽑아 중복을 없앴다.
function ProjectLinkList({
  contentDebug,
  homeTemplate,
  links,
}: {
  contentDebug?: boolean;
  homeTemplate?: HomeTemplateId;
  links: ContentLink[];
}) {
  if (!links.length) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => (
        <ContentLinkView
          className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background ${
            link.type === "demo"
              ? "border-accent bg-accent text-background hover:bg-accent-strong"
              : "border-line bg-surface text-muted hover:border-accent hover:text-foreground"
          }`}
          contentDebug={contentDebug}
          homeTemplate={homeTemplate}
          key={`${link.type}-${link.href}`}
          link={link}
        >
          {link.label}
          {link.external ? <ExternalLinkIcon /> : <ArrowUpRightIcon />}
        </ContentLinkView>
      ))}
    </div>
  );
}

export function ProjectLinks({
  contentDebug,
  excludeCaseStudy = false,
  homeTemplate,
  project,
}: {
  contentDebug?: boolean;
  excludeCaseStudy?: boolean;
  homeTemplate?: HomeTemplateId;
  project: PortfolioProject;
}) {
  const links = getProjectDetailLinks(project).filter(
    (link) =>
      (!excludeCaseStudy || link.type !== "case-study") &&
      isVisibleProjectLink(project, link),
  );

  return (
    <ProjectLinkList
      contentDebug={contentDebug}
      homeTemplate={homeTemplate}
      links={links}
    />
  );
}

export function ProjectCardLinks({
  contentDebug,
  homeTemplate,
  project,
}: {
  contentDebug?: boolean;
  homeTemplate?: HomeTemplateId;
  project: PortfolioProject;
}) {
  const links = getProjectCardLinks(project);

  return (
    <ProjectLinkList
      contentDebug={contentDebug}
      homeTemplate={homeTemplate}
      links={links}
    />
  );
}

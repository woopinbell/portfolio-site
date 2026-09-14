import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StructuredData } from "@/components/portfolio/structured-data";
import { renderDesignRoute } from "@/designs/registry";
import {
  resolvePortfolioContentMode,
  resolveProductionSiteUrl,
} from "@/lib/content-readiness";
import { resolvePortfolioPageContext } from "@/lib/portfolio/page-context";
import { createProjectDetailViewModel } from "@/lib/portfolio/view-models";
import {
  getPortfolioContent,
  getProjectById,
  isSitePageEnabled,
  type RouteSearchParams,
} from "@/lib/portfolio";
import {
  createProjectStructuredData,
  createRouteMetadata,
} from "@/lib/site-metadata";

// [INTV:ARCH] 폴더명의 대괄호 [projectId]는 Next.js의 동적 라우트 문법 — "/projects/아무값"이
// 전부 이 파일로 매칭되고, 그 "아무값"이 params.projectId로 전달된다.
type ProjectDetailPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams?: RouteSearchParams;
};

// [INTV:PERF] generateStaticParams: 빌드 시점에 이 동적 라우트가 가질 수 있는 실제 값 목록을
// Next에 알려줘서, 요청마다 즉석 렌더링하는 대신 프로젝트별 페이지를 정적 HTML로 미리
// 만들어두게(SSG) 하는 훅 — 이 훅이 없으면 프로젝트 상세 페이지가 매 요청마다 서버에서 다시
// 렌더링된다(콘텐츠가 자주 안 바뀌는 포트폴리오 페이지에는 정적 생성이 더 적합).
export function generateStaticParams() {
  return getPortfolioContent().projects.map((project) => ({
    projectId: project.id,
  }));
}

export async function generateMetadata({
  params,
}: Pick<ProjectDetailPageProps, "params">): Promise<Metadata> {
  const content = getPortfolioContent();
  // [INTV:TRAP] params가 Promise인 것은 Next.js 최신 버전의 변경사항 — 과거엔 동기 객체였지만
  // 지금은 await로 풀어써야 한다(page-context.ts의 searchParams와 같은 버전 변화).
  const { projectId } = await params;
  const project = getProjectById(projectId, content);

  if (!isSitePageEnabled("projects", content) || !project) {
    notFound();
  }

  return createRouteMetadata({
    description: project.summary,
    path: `/projects/${project.id}`,
    site: content.site,
    title: project.title,
    // [INTV:ARCH] "article" 타입은 og:type 등 SEO 메타데이터를 "개별 글/케이스 스터디" 성격으로
    // 표시하기 위한 값(일반 페이지와 구분).
    type: "article",
  });
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: ProjectDetailPageProps) {
  const content = getPortfolioContent();
  if (!isSitePageEnabled("projects", content)) notFound();

  const { projectId } = await params;
  const viewModel = createProjectDetailViewModel(content, projectId);
  if (!viewModel) notFound();

  const { activeTemplate, contentDebug } =
    await resolvePortfolioPageContext({
      content,
      currentPath: `/projects/${projectId}`,
      searchParams,
    });

  const mode = resolvePortfolioContentMode(
    process.env.PORTFOLIO_CONTENT_MODE,
  );
  // [INTV:EDGE] 프로젝트 개별 페이지에 대한 JSON-LD 구조화 데이터도 layout.tsx의 사이트 전역
  // 구조화 데이터와 같은 이유로 프로덕션 모드에서만 생성한다(미리보기 URL이 검색엔진에 노출되지
  // 않도록).
  const structuredData =
    mode === "production"
      ? createProjectStructuredData({
          content,
          project: viewModel.project,
          siteUrl: resolveProductionSiteUrl(process.env.SITE_URL),
        })
      : undefined;

  const designRoute = await renderDesignRoute(activeTemplate, {
    contentDebug,
    currentPath: `/projects/${viewModel.project.id}`,
    route: "project-detail",
    viewModel,
  });

  return (
    <>
      {structuredData ? <StructuredData data={structuredData} /> : null}
      {designRoute}
    </>
  );
}

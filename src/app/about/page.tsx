import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { renderDesignRoute } from "@/designs/registry";
import { resolvePortfolioPageContext } from "@/lib/portfolio/page-context";
import { createAboutViewModel } from "@/lib/portfolio/view-models";
import {
  getPortfolioContent,
  isSitePageEnabled,
  type RouteSearchParams,
} from "@/lib/portfolio";
import { createRouteMetadata } from "@/lib/site-metadata";

// [INTV:ARCH] Next.js App Router 관례: src/app/about/page.tsx 라는 파일 경로 자체가 "/about"
// 라우트를 만든다(파일 기반 라우팅). generateMetadata는 Next가 페이지를 렌더링하기 전에 호출해
// <head>의 title/description 등을 채우는 특수 export 함수.
export function generateMetadata(): Metadata {
  const content = getPortfolioContent();
  // [INTV:ARCH] isSitePageEnabled: 콘텐츠 설정(site.json)으로 페이지 노출 여부를 켜고 끌 수
  // 있게 만든 자체 기능 플래그. notFound()는 Next 전용 함수로, 호출 시 이 요청을 표준 404 페이지로
  // 처리하도록 던진다(예외 기반 흐름 제어).
  if (!isSitePageEnabled("about", content)) notFound();

  return createRouteMetadata({
    description: content.profile.summary,
    path: "/about",
    site: content.site,
    title: content.presentation.pages.about.hero.title,
  });
}

// [INTV:ARCH] 함수 앞에 "use client"가 없는 async 컴포넌트 = Next.js 서버 컴포넌트. 브라우저로
// JS가 전달되지 않고 서버에서 실행/렌더링되어 완성된 HTML만 내려간다 — async를 그대로 컴포넌트
// 함수에 쓸 수 있는 것도 이 덕분(클라이언트 컴포넌트는 async 함수 컴포넌트를 지원하지 않는다).
// searchParams는 Next가 페이지 컴포넌트에 자동으로 넘겨주는 프레임워크 prop(쿼리스트링을 담음).
export default async function AboutPage({
  searchParams,
}: {
  searchParams?: RouteSearchParams;
}) {
  const content = getPortfolioContent();
  if (!isSitePageEnabled("about", content)) notFound();

  // [INTV:ARCH] 이 프로젝트는 "디자인 테마"를 여러 개 갖고 있고(src/designs 참고), 요청마다
  // 어떤 테마를 렌더링할지를 이 헬퍼(resolvePortfolioPageContext)가 결정한다 — 프레임워크 기능이
  // 아니라 이 저장소 고유의 아키텍처. contentDebug는 ?debug=content 쿼리로 켜지는 디버그 오버레이용
  // 플래그(content-hint.tsx 참고).
  const { activeTemplate, contentDebug } =
    await resolvePortfolioPageContext({
      content,
      currentPath: "/about",
      searchParams,
    });

  // [INTV:ARCH] renderDesignRoute + createXViewModel: 원본 콘텐츠 데이터(content)를 그대로
  // 화면에 넘기지 않고, 화면 전용으로 가공된 "뷰 모델"(view-models.ts)로 한 번 변환한 뒤 선택된
  // 테마의 렌더러에 넘기는 구조 — 콘텐츠 스키마와 화면 표현을 분리해 테마를 여러 개 유지해도 각
  // 화면 컴포넌트가 스키마 변화에 덜 흔들리게 하려는 설계.
  return renderDesignRoute(activeTemplate, {
    contentDebug,
    currentPath: "/about",
    route: "about",
    viewModel: createAboutViewModel(content),
  });
}

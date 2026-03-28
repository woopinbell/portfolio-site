import type { Metadata } from "next";
import Link from "next/link";

import { ArrowRightIcon } from "@/components/icons";
import { PageShell } from "@/components/portfolio/site-shell";
import { getPortfolioContent } from "@/lib/portfolio";

// [INTV:ARCH] not-found.tsx는 Next.js App Router가 자동으로 인식하는 예약 파일명 —
// notFound()가 호출되거나 일치하는 라우트가 없을 때 이 컴포넌트가 렌더링된다. 별도 라우팅
// 설정 없이 파일 위치만으로 동작한다.
export const metadata: Metadata = {
  // [INTV:EDGE] 404 페이지가 검색엔진에 색인되거나 다른 페이지의 링크로 추천되지 않도록
  // 명시적으로 막는 SEO 설정.
  robots: { follow: false, index: false },
  title: "Page not found",
};

export default function NotFound() {
  const content = getPortfolioContent();

  // [INTV:ARCH] 다른 페이지들과 달리 renderDesignRoute(여러 디자인 테마 중 하나를 골라
  // 렌더링)를 거치지 않고 PageShell을 직접 사용한다 — 404 페이지는 테마별로 다르게 꾸밀 필요가
  // 없다는 판단으로, 항상 동일한 최소 셸로 고정한 것(현재 선택된 테마와 무관하게 404는 일관된
  // 모습을 유지).
  return (
    <PageShell
      homeTemplate={content.presentation.defaultHomeTemplate}
      profile={content.profile}
      site={content.site}
      ui={content.presentation.ui}
    >
      <section className="border-b border-line">
        <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 md:py-32">
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-accent">
            404
          </p>
          <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-tight text-foreground md:text-6xl">
            Page not found
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-muted">
            The address may be incorrect, or the page may no longer be part of
            this portfolio.
          </p>
          <Link
            className="mt-8 inline-flex h-11 items-center gap-2 rounded-md border border-accent bg-accent px-4 text-sm font-semibold text-background"
            href="/"
          >
            Return home
            <ArrowRightIcon />
          </Link>
        </div>
      </section>
    </PageShell>
  );
}

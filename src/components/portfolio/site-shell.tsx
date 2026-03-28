import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { DesignSwitcher } from "@/components/portfolio/design-switcher";
import {
  getTemplateHref,
  type HomeTemplateId,
  type PresentationContent,
  type PresentationTemplate,
  type ProfileContent,
  type SiteContent,
} from "@/lib/portfolio";

type TemplateSwitcherProps = {
  activeId: HomeTemplateId;
  contentDebug?: boolean;
  currentPath: string;
  defaultId: HomeTemplateId;
  templates: PresentationTemplate[];
};

// [INTV:EDGE] 현재 경로가 이 네비게이션 링크와 일치하는지 판단 — "/"는 정확히 일치할 때만,
// 나머지는 그 경로로 시작하는 하위 페이지까지 "현재 위치"로 쳐준다(예: /projects/foo 방문 중에도
// "Projects" 메뉴가 활성 상태로 보이도록). "/"를 다른 경로와 같은 startsWith 규칙으로 처리하면,
// 모든 경로가 "/"로 시작하므로 홈 메뉴가 항상 활성 상태로 보이는 버그가 생긴다.
function isCurrentNavigation(href: string, currentPath: string | undefined) {
  if (!currentPath) return false;
  if (href === "/") return currentPath === "/";
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export function SiteHeader({
  templateSwitcher,
  profile,
  site,
  ui,
}: {
  templateSwitcher?: TemplateSwitcherProps;
  profile: ProfileContent;
  site: SiteContent;
  ui: PresentationContent["ui"];
}) {
  return (
    <header
      className="sticky top-0 z-30 border-b border-line/90 bg-background/88 backdrop-blur"
      data-site-header
    >
      <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-2 sm:px-8">
        <Link
          className="text-sm font-semibold tracking-normal text-foreground"
          href={getTemplateHref("/", templateSwitcher?.activeId, {
            contentDebug: templateSwitcher?.contentDebug,
          })}
          prefetch={false}
        >
          {profile.handle}
        </Link>
        {/* 데스크톱 전용 가로 내비게이션 — md 브레이크포인트 미만에서는 숨기고 아래의 <details>
            메뉴로 대체 */}
        <nav
          aria-label={ui.primaryNavigationAriaLabel}
          className="hidden items-center gap-6 md:flex"
        >
          {site.navigation.map((item) => (
            <Link
              aria-current={
                isCurrentNavigation(item.href, templateSwitcher?.currentPath)
                  ? "page"
                  : undefined
              }
              className="text-sm font-medium text-muted transition hover:text-foreground"
              href={getTemplateHref(item.href, templateSwitcher?.activeId, {
                contentDebug: templateSwitcher?.contentDebug,
              })}
              key={item.href}
              prefetch={false}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {/* [INTV:ARCH] 모바일 전용 메뉴 — 여기서도 design-switcher.tsx와 같은 이유로 JS 상태
            없이 <details>/<summary>로 드롭다운을 구현. */}
        <details className="relative md:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center rounded border border-line px-3 text-xs font-semibold uppercase tracking-wide text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            {ui.menuLabel}
          </summary>
          <nav
            aria-label={ui.mobileNavigationAriaLabel}
            className="absolute right-0 top-[calc(100%+0.5rem)] grid min-w-52 gap-1 border border-line bg-surface p-2 shadow-xl"
          >
            {site.navigation.map((item) => (
              <Link
                aria-current={
                  isCurrentNavigation(item.href, templateSwitcher?.currentPath)
                    ? "page"
                    : undefined
                }
                className="flex min-h-11 items-center px-3 text-sm font-medium text-muted hover:bg-surface-soft hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                href={getTemplateHref(item.href, templateSwitcher?.activeId, {
                  contentDebug: templateSwitcher?.contentDebug,
                })}
                key={item.href}
                prefetch={false}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </details>
        {templateSwitcher ? (
          <DesignSwitcher
            activeId={templateSwitcher.activeId}
            contentDebug={templateSwitcher.contentDebug}
            currentPath={templateSwitcher.currentPath}
            defaultId={templateSwitcher.defaultId}
            templates={templateSwitcher.templates}
            ui={ui}
          />
        ) : null}
      </div>
    </header>
  );
}

export function SiteFooter({
  contentDebug,
  homeTemplate,
  site,
}: {
  contentDebug?: boolean;
  homeTemplate?: HomeTemplateId;
  site: SiteContent;
}) {
  return (
    <footer className="border-t border-line bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>{site.footer.note}</p>
        <Link
          className="inline-flex items-center gap-2 font-semibold text-foreground transition hover:text-accent-strong"
          href={getTemplateHref("/", homeTemplate, { contentDebug })}
          prefetch={false}
        >
          {site.footer.copyright}
          <ArrowRightIcon className="-rotate-45" />
        </Link>
      </div>
    </footer>
  );
}

// [INTV:ARCH] 모든 페이지(및 not-found.tsx)를 감싸는 공통 뼈대: 스킵 링크 + 헤더 + <main> +
// 푸터. 각 디자인 테마의 route 컴포넌트들이 이 PageShell 위에 콘텐츠(children)를 채워 넣는 구조
// (classic/design 테마만 재사용하고, editorial/brutalist/cinematic은 자체 셸을 쓴다 —
// editorial-route.tsx 참고).
export function PageShell({
  children,
  contentDebug,
  homeTemplate,
  profile,
  routeRenderer,
  site,
  templateSwitcher,
  ui,
}: {
  children: React.ReactNode;
  contentDebug?: boolean;
  homeTemplate?: HomeTemplateId;
  profile: ProfileContent;
  routeRenderer?: "classic" | "design";
  site: SiteContent;
  templateSwitcher?: TemplateSwitcherProps;
  ui: PresentationContent["ui"];
}) {
  return (
    <div
      className="min-h-screen bg-background text-foreground"
      data-route-renderer={routeRenderer}
      data-site-design={homeTemplate}
    >
      {/* [INTV:EDGE] "스킵 링크": 평소엔 화면 밖(top: -5rem)에 숨어 있다가 키보드로 포커스를
          받으면(:focus) 화면 안으로 들어와, 스크린리더/키보드 사용자가 매 페이지 헤더 내비게이션을
          일일이 거치지 않고 바로 본문(#main-content)으로 건너뛸 수 있게 해주는 접근성 관례. */}
      <a
        className="fixed left-4 top-[-5rem] z-[100] bg-foreground px-4 py-3 text-sm font-semibold text-background focus:top-4"
        href="#main-content"
      >
        {ui.skipLinkLabel}
      </a>
      <SiteHeader
        profile={profile}
        site={site}
        templateSwitcher={templateSwitcher}
        ui={ui}
      />
      <main data-home-template={homeTemplate} id="main-content" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter
        contentDebug={contentDebug}
        homeTemplate={homeTemplate}
        site={site}
      />
    </div>
  );
}

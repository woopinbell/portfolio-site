import type { SiteDesignId } from "@/lib/portfolio";
import type { PortfolioRouteViewModel } from "@/lib/portfolio/view-models";

// [INTV:ARCH] 5개 디자인 테마 중 "classic"과 "design" 두 개만 src/components/portfolio/site-shell.tsx의
// 공통 PageShell을 재사용하는 구조다(editorial/brutalist/cinematic은 각자 독자적인 셸을 구현 —
// 시각적으로 크게 다른 테마는 공유 셸에 억지로 맞추기보다 독립 구현이 더 단순했을 것). 이 함수는
// 그 두 테마가 PageShell에 넘길 props를 한곳에서 조립해주는 헬퍼라, Extract<SiteDesignId, "classic" |
// "design">로 designId 인자의 타입 자체를 이 두 값으로만 제한해둔다(다른 테마 id를 실수로 넘기면
// 컴파일 에러 — 함수 본문에서 런타임 체크를 하는 대신 시그니처만으로 오용을 막는다).
export function createDesignShellProps(
  content: PortfolioRouteViewModel,
  contentDebug: boolean,
  currentPath: string,
  designId: Extract<SiteDesignId, "classic" | "design">,
) {
  return {
    contentDebug,
    homeTemplate: designId,
    profile: content.profile,
    routeRenderer: designId,
    site: content.site,
    templateSwitcher: {
      activeId: designId,
      contentDebug,
      currentPath,
      defaultId: content.presentation.defaultHomeTemplate,
      templates: content.presentation.templates,
    },
    ui: content.presentation.ui,
    // [INTV:TRAP] as const: 이 객체의 각 필드를 string 같은 넓은 타입이 아니라 실제 리터럴 값
    // 그대로("classic" 등) 추론하게 고정한다 — 호출하는 쪽에서 이 반환값을 좁은 타입 그대로
    // 넘겨받아야 할 때(예: routeRenderer가 정확히 "classic"|"design"이어야 하는 곳) 유용하다.
    // as const 없이 재구현하면 homeTemplate/routeRenderer 같은 필드가 넓은 SiteDesignId(또는 string)
    // 타입으로 추론돼, 이 값을 정확한 리터럴 타입을 요구하는 다른 곳에 넘길 때 타입 에러가 난다.
  } as const;
}

import type { ComponentType, ReactElement } from "react";
import type { SiteDesignId } from "@/lib/portfolio";
import type { DesignRouteProps, DesignRouteRequestProps } from "./types";

// [INTV:ARCH] ComponentType<DesignRouteProps>: "DesignRouteProps를 받는 React 컴포넌트"라는
// 제네릭 타입 — 함수형이든 클래스형이든 상관없이 그런 props로 렌더링 가능한 컴포넌트를 가리킨다.
type DesignModule = {
  default: ComponentType<DesignRouteProps>;
};

// [INTV:PERF] 각 테마 폴더를 () => import(...) 형태(즉시 실행이 아니라 "실행하면 import하는 함수")로
// 등록해둔 것이 핵심 — import()를 함수 문법으로 쓰면 Next.js/번들러가 이걸 별도 청크로 분리해 "코드
// 스플리팅"한다. 즉 사용자가 실제로 보는 테마 하나의 코드만 그때그때 내려받고, 나머지 4개 테마의
// 코드는 초기 페이지 로딩에 포함되지 않는다 — 테마가 5개나 있어도 방문자가 매번 5개 분량의 JS를
// 받지 않도록 한 성능 최적화 설계.
// - [TRAP] 정적 import(`import { design } from "./design"`)로 재구현하면, 번들러가 그 모듈을
//   즉시 필요한 코드로 취급해 별도 청크로 분리하지 않는다 — 결국 방문자가 선택하지 않은 4개 테마의
//   코드까지 항상 초기 번들에 포함돼 다운로드된다. "동적 import 함수" 형태 자체가 코드 스플리팅의
//   신호가 된다는 걸 놓치기 쉽다.
const routeLoaders: Record<SiteDesignId, () => Promise<DesignModule>> = {
  design: () => import("./design"),
  classic: () => import("./classic"),
  editorial: () => import("./editorial"),
  brutalist: () => import("./brutalist"),
  cinematic: () => import("./cinematic"),
};

export async function renderDesignRoute(
  designId: SiteDesignId,
  props: DesignRouteRequestProps,
): Promise<ReactElement | null> {
  const loader = routeLoaders[designId];

  const { default: Renderer } = await loader();
  const rendererProps: DesignRouteProps = {
    content: props.viewModel,
    contentDebug: props.contentDebug,
    currentPath: props.currentPath,
    // [INTV:ARCH] props.viewModel.route === "project-detail"로 비교하는 순간, TS는 그 분기 안에서
    // viewModel의 타입을 "project-detail 변형"으로 좁혀서(narrowing) .project 필드가 실제로
    // 존재한다는 걸 알아챈다 — 판별 유니언(discriminated union)과 타입 좁히기가 함께 동작하는
    // 예시(types.ts의 ViewModelDesignRouteRequest가 route/viewModel 짝을 강제해둔 덕분에 이 비교
    // 하나로 안전하게 좁혀진다).
    project:
      props.viewModel.route === "project-detail"
        ? props.viewModel.project
        : undefined,
    route: props.route,
  };

  return <Renderer {...rendererProps} />;
}

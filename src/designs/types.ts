import type { PortfolioProject } from "@/lib/portfolio";
import type { PortfolioRouteViewModel } from "@/lib/portfolio/view-models";

// [INTV:ARCH] 이 사이트는 페이지("route")마다, 그리고 선택된 디자인 테마마다 다른 컴포넌트를
// 렌더링하는 구조다. 이 파일은 그 "테마 렌더러가 받는 props"의 타입 규칙을 정의한다.
export type PortfolioRouteId =
  | "home"
  | "projects"
  | "project-detail"
  | "about"
  | "resume"
  | "contact"
  | "journey"
  | "interview-map";

export type DesignRouteProps = {
  content: PortfolioRouteViewModel;
  contentDebug: boolean;
  currentPath: string;
  project?: PortfolioProject;
  route: PortfolioRouteId;
};

// [INTV:TRAP] PortfolioRouteViewModel은 route 필드로 구분되는 "판별 유니언"(discriminated union)
// 타입 — 즉 { route: "home", ... } | { route: "projects", ... } | ... 처럼 route 값에 따라 나머지
// 필드 구성이 달라지는 타입이다.
//
// 아래 매핑 타입(mapped type)은 "route in ...["route"]"로 그 유니언의 모든 route 값을 순회하면서,
// 각 Route 값에 대해 "route는 정확히 그 값이고, viewModel은 Extract<...>로 그 route에 해당하는
// 변형(variant)만 남긴 타입"이라는 객체 타입을 만든다. Extract<A, B>는 A 중에서 B 형태와 겹치는
// 것만 골라내는 TS 유틸리티 타입이다. 그렇게 만들어진 "route별 객체 타입들의 모음"을 마지막 줄의
// `[...]["route"]`(인덱스 접근)로 다시 하나로 합쳐, "route와 viewModel이 항상 서로 짝이 맞는
// 것끼리만" 허용되는 유니언 타입으로 되돌린다.
// 결과적으로 이 타입 덕분에, 예를 들어 route가 "home"인데 viewModel은 "projects"용 데이터를 넣는
// 실수를 컴파일 시점에 막아준다 — 런타임 방어 코드 없이 타입 시스템만으로 route/viewModel 불일치를
// 방지하는 설계. 단순히 `{ route: PortfolioRouteId; viewModel: PortfolioRouteViewModel }`로
// 선언했다면, route와 viewModel이 서로 무관하게 어떤 조합이든 통과되어 이 불일치를 컴파일 타임에
// 잡을 방법이 없다 — 이 매핑 타입 + 인덱스 접근 조합이 재구현 시 가장 놓치기 쉬운 핵심.
type ViewModelDesignRouteRequest = {
  [Route in PortfolioRouteViewModel["route"]]: {
    contentDebug: boolean;
    currentPath: string;
    route: Route;
    viewModel: Extract<PortfolioRouteViewModel, { route: Route }>;
  };
}[PortfolioRouteViewModel["route"]];

export type DesignRouteRequestProps = ViewModelDesignRouteRequest;

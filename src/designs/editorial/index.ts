// [INTV:ARCH] export { A as default, A } from "...": 같은 이름(EditorialRoute)을 default
// export와 named export 둘 다로 재노출한다 — designs/registry.tsx의 동적 import
// (`import("./editorial")`)는 default를 기대하고, 다른 곳에서 타입/구현을 직접 이름으로 가져오고
// 싶을 때는 named export를 쓸 수 있게 양쪽을 다 열어둔 것.
export { EditorialRoute as default, EditorialRoute } from "./editorial-route";
export type { EditorialRouteName, EditorialRouteProps } from "./editorial-route";

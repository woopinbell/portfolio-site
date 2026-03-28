// [INTV:ARCH] designs/editorial/index.ts와 같은 목적의 재노출 파일 — designs/registry.tsx의
// 동적 import가 기대하는 default export와, 다른 곳에서 이름으로 바로 가져다 쓸 수 있는 named
// export를 동시에 제공한다.
export { BrutalistRoute, BrutalistRoute as default } from "./brutalist-route";

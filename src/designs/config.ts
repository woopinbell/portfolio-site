import type { SiteDesignId } from "@/lib/portfolio";

// [INTV:ARCH] 이 사이트가 지원하는 5개 디자인 테마의 "레지스트리" — 각 테마의 식별자와, 디자인
// 스위처 UI에 보여줄 대표 색상 3개(swatch)를 정의한다. 실제 테마별 레이아웃/스타일 구현은 이 파일이
// 아니라 ./design, ./classic 등 각 하위 폴더에 있고, 이 파일은 어떤 테마들이 "존재하는지"에 대한
// 메타데이터만 담당한다 — 메타데이터(어떤 테마가 있는지)와 구현(그 테마를 어떻게 렌더링하는지,
// registry.tsx)을 분리해, 새 테마를 스위처 UI에 등록하는 것과 실제로 구현하는 걸 독립적으로 다룰
// 수 있게 한다.
export type SiteDesignDefinition = {
  id: SiteDesignId;
  swatch: [string, string, string];
};

export const SITE_DESIGNS: SiteDesignDefinition[] = [
  {
    id: "design",
    swatch: ["#f7faf8", "#008c89", "#4f46e5"],
  },
  {
    id: "classic",
    swatch: ["#1f2023", "#9cc8b1", "#7aa7ff"],
  },
  {
    id: "editorial",
    swatch: ["#f2ebdd", "#171614", "#d64b32"],
  },
  {
    id: "brutalist",
    swatch: ["#f4f0e8", "#2e5bff", "#e6ff3f"],
  },
  {
    id: "cinematic",
    swatch: ["#0a0b0e", "#d9d2c4", "#c98a4a"],
  },
];

export const SITE_DESIGN_IDS = SITE_DESIGNS.map((design) => design.id);

export function getSiteDesignDefinition(id: SiteDesignId) {
  return SITE_DESIGNS.find((design) => design.id === id) ?? SITE_DESIGNS[0];
}

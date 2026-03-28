import type { CSSProperties } from "react";
import type { TechStackItem } from "@/lib/portfolio";
import { TechIcon } from "./tech-icon";

export function TechMarquee({
  ariaLabel,
  items,
}: {
  ariaLabel: string;
  items: TechStackItem[];
}) {
  const visibleItems = items.slice(0, 18);

  return (
    <div aria-label={ariaLabel} className="stack-marquee">
      <div className="stack-marquee-viewport">
        {/* [INTV:ARCH] globals.css의 .stack-marquee 주석에서 설명한 무한 스크롤 트릭의 구현부:
            같은 목록을 두 벌 나란히 렌더링해서 첫 번째 벌이 정확히 한 벌 너비만큼 왼쪽으로 사라질
            때 두 번째 벌이 그 자리를 이어받아 끊김 없이 보이게 한다. */}
        <TechMarqueeTrack items={visibleItems} />
        {/* [INTV:EDGE] 두 번째(복제된) 트랙은 시각적으로만 필요하고 정보상 중복이므로
            aria-hidden으로 스크린리더에서 숨긴다. */}
        <TechMarqueeTrack ariaHidden items={visibleItems} />
      </div>
    </div>
  );
}

function TechMarqueeTrack({
  ariaHidden = false,
  items,
}: {
  ariaHidden?: boolean;
  items: TechStackItem[];
}) {
  return (
    <ul aria-hidden={ariaHidden} className="stack-marquee-track">
      {items.map((item) => (
        <li
          className="stack-marquee-card"
          key={`${ariaHidden ? "ghost" : "live"}-${item.id}`}
          style={{ "--stack-color": item.color } as CSSProperties}
        >
          <span className="stack-marquee-icon">
            <TechIcon color={item.color} icon={item.icon} />
          </span>
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

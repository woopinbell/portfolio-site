import type { CSSProperties } from "react";
import { resolveTechStackItem } from "@/lib/portfolio";
import { TechIcon } from "./tech-icon";

export function StackList({
  items,
  limit,
}: {
  items: string[];
  limit?: number;
}) {
  const visibleItems = typeof limit === "number" ? items.slice(0, limit) : items;

  return (
    <ul className="flex flex-wrap gap-2">
      {visibleItems.map((item) => {
        const stack = resolveTechStackItem(item);

        return (
          // [INTV:TRAP] group/stack: Tailwind의 "이름 붙은 group" 기능 — 보통 group-hover는
          // 가장 가까운 조상의 hover만 감지하는데, 이름을 붙이면(group/stack) 중첩된 group이
          // 있어도 어떤 조상의 hover에 반응할지 명시적으로 지정할 수 있다. 아래 아이콘의
          // group-hover/stack:opacity-100이 바로 "이 li가 hover될 때"를 가리키는 짝이다 — 이름
          // 없이 그냥 group을 쓰면, 이 li 안에 또 다른 group이 중첩될 경우 어느 hover에 반응하는지
          // 모호해진다.
          <li
            className="tech-chip group/stack inline-flex items-center gap-2 rounded-full border border-line bg-surface px-2.5 py-1.5 text-[0.72rem] font-medium text-muted transition duration-200 hover:-translate-y-0.5 hover:border-accent/55 hover:bg-surface-hover hover:text-foreground"
            key={item}
            // [INTV:TRAP] React의 style 객체 타입(CSSProperties)은 기본적으로 "--stack-color"
            // 같은 CSS 커스텀 프로퍼티(변수) 키를 허용하지 않기 때문에, 타입 검사만 통과시키려고
            // `as CSSProperties`로 강제 단언한다 — 실제로는 잘 동작하는 유효한 인라인 스타일이다.
            // 이렇게 설정한 값은 아래 className의 var(--stack-color)에서 읽힌다.
            style={{ "--stack-color": stack.color } as CSSProperties}
          >
            <span className="text-[var(--stack-color)] opacity-75 transition duration-200 group-hover/stack:opacity-100">
              <TechIcon color={stack.color} icon={stack.icon} />
            </span>
            {stack.label}
          </li>
        );
      })}
    </ul>
  );
}

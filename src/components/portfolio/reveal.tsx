// [INTV:ARCH] "as" prop으로 렌더링할 태그 자체를 바꿔치기하는 흔한 React 패턴(polymorphic
// component) — 호출하는 쪽이 <div>가 필요한 문맥(섹션 감싸기)과 <li>가 필요한 문맥(목록 항목
// 감싸기) 둘 다에서 이 컴포넌트를 재사용할 수 있게 해준다.
// [INTV:TRAP] Component 변수에 대문자로 시작하는 이름을 담아야 JSX가 이를 커스텀 태그가 아니라
// 실제 HTML 태그명으로 인식한다 — 소문자 변수(component)에 담으면 React가 그 문자열 그대로를
// 알 수 없는 HTML 태그로 취급해버린다(StatCard.tsx의 Icon, editorial-route.tsx의 List와 같은
// 규칙).
export function Reveal({
  as = "div",
  children,
  className = "",
  delay = 0,
}: {
  as?: "div" | "li";
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const Component = as;

  // [INTV:ARCH] globals.css의 .reveal-item은 blur/opacity/transform이 걸린 "숨김" 스타일이고
  // .is-visible이 그걸 해제하는데, 여기서는 그 is-visible을 스크롤 감지 없이 처음부터 고정으로
  // 붙인다. delay만 각 항목마다 다르게 줘서 여러 개가 동시에 마운트될 때 하나씩 순서대로 나타나는
  // 효과를 노린 것(스크롤 재진입 시 다시 숨는 방식은 아니다 — IntersectionObserver 없이 CSS
  // transition-delay만으로 순차 등장을 구현하는 가벼운 접근).
  return (
    <Component
      className={`reveal-item is-visible ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Component>
  );
}

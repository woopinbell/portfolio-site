"use client";

// [INTV:ARCH] 클릭 이벤트 핸들러(onClick)로 DOM을 직접 조작해야 하니 클라이언트 컴포넌트여야
// 한다.
export function DesignSwitcherClose({ label }: { label: string }) {
  return (
    <button
      aria-label={label}
      onClick={(event) => {
        // [INTV:ARCH] closest(): 클릭된 요소에서 시작해 조상 방향으로 올라가며 <details> 태그를
        // 찾는 DOM API. 이 버튼이 어떤 <details> 안에 있는지 React state 없이 DOM 트리 탐색만으로
        // 찾아내는 방식(design-switcher.tsx가 상태를 React가 아니라 브라우저 네이티브 위젯에
        // 맡긴 설계와 짝을 이룬다).
        const details = event.currentTarget.closest("details");
        // [INTV:TRAP] ":scope > summary": CSS의 :scope는 "지금 탐색을 시작한 요소 자신"을
        // 가리켜서, details의 자손 전체가 아니라 바로 아래(direct child)의 summary만 정확히
        // 짚어낸다 — :scope 없이 그냥 "summary"로 찾으면 중첩된 details 안의 다른 summary까지
        // 잘못 걸릴 수 있다.
        const summary = details?.querySelector<HTMLElement>(":scope > summary");

        // [INTV:EDGE] <details>는 open 속성이 있고 없음으로 펼침/접힘이 결정되는 네이티브 HTML
        // 위젯 — 이 속성을 지워서 "닫기 버튼" 역할을 하고, 이어서 summary(토글 버튼 역할)로
        // 포커스를 되돌려 키보드 사용자가 포커스를 잃지 않도록(접근성) 처리한다.
        details?.removeAttribute("open");
        summary?.focus();
      }}
      type="button"
    >
      <span aria-hidden="true">×</span>
    </button>
  );
}

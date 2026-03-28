// [INTV:ARCH] 이 프로젝트 전반(project-card, journey-list, section-heading 등 다수 컴포넌트)에서
// 반복적으로 쓰이는 "콘텐츠 디버그 힌트" 컴포넌트. ?debug=content 쿼리(template-href.ts 참고)로
// 켜지는 디버그 모드가 켜져 있을 때만, 화면에 보이는 텍스트가 실제로 어느 콘텐츠 JSON 파일의 어느
// 경로에서 왔는지(path)를 라벨로 표시해준다. 콘텐츠를 수정하는 사람(비개발자일 수도 있음)이 "이
// 문구를 고치려면 어느 파일을 열어야 하는지" 바로 알 수 있게 하려는 목적의 자체 기능이며, 평소
// (디버그 모드가 꺼진 프로덕션)에는 완전히 렌더링에서 빠진다 — 이후 이 컴포넌트가 쓰이는 다른
// 파일들에서는 이 설명을 반복하지 않는다.
export function ContentHint({
  enabled,
  path,
}: {
  enabled?: boolean;
  path: string;
}) {
  if (!enabled) {
    return null;
  }

  return (
    <span
      aria-label={`Content source: ${path}`}
      className="mb-2 inline-flex w-fit rounded border border-warm/50 bg-warm/10 px-2 py-1 font-mono text-[0.68rem] font-semibold text-warm"
    >
      수정: {path}
    </span>
  );
}

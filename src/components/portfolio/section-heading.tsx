import { ContentHint } from "./content-hint";

// [INTV:ARCH] 여러 페이지에서 반복되는 "섹션 제목 + 설명" 레이아웃을 하나로 통일한 컴포넌트.
// body/contentHint는 없을 수도 있어 선택적으로만 렌더링한다(contentHint 동작은 content-hint.tsx
// 참고).
export function SectionHeading({
  body,
  contentDebug,
  contentHint,
  title,
}: {
  body?: string;
  contentDebug?: boolean;
  contentHint?: string;
  title: string;
}) {
  return (
    <div className="max-w-2xl">
      {contentHint ? (
        <ContentHint enabled={contentDebug} path={contentHint} />
      ) : null}
      <h2 className="text-3xl font-semibold tracking-normal text-foreground md:text-4xl">
        {title}
      </h2>
      {body ? (
        <p className="mt-4 text-sm leading-6 text-muted md:text-base">{body}</p>
      ) : null}
    </div>
  );
}

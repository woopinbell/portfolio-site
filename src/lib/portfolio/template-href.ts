import type { HomeTemplateId } from "./types";

// [INTV:ARCH] 이 사이트의 "디자인 테마 전환"과 "콘텐츠 디버그 모드"는 서버 상태나 쿠키가 아니라
// URL 쿼리스트링(?view=테마id, ?debug=content)으로 표현된다 — 그래서 모든 내부 링크(Link href)는
// 그냥 경로 문자열이 아니라 이 함수를 거쳐 현재 선택된 테마/디버그 상태를 쿼리로 이어붙인 href를
// 받는다. 이렇게 하면 사용자가 어떤 링크를 눌러 페이지를 이동해도 지금 보고 있던 테마가 유지된다
// (서버 상태 없이 URL만으로 UI 상태를 표현하는 설계 — 쿠키/세션 저장소 없이도 링크 하나만 공유하면
// 특정 테마로 바로 진입시킬 수 있고, 서버 컴포넌트에서도 클라이언트 상태 동기화 없이 URL만 읽으면
// 된다는 이점).
export function createTemplateHref(
  href: string,
  templateId: HomeTemplateId | undefined,
  defaultTemplateId: HomeTemplateId,
  options: { alwaysInclude?: boolean; contentDebug?: boolean } = {},
) {
  // 외부 링크(http로 시작)나 프로토콜 상대 링크(//로 시작)에는 내부 쿼리 규칙을 적용하지 않고 그대로 반환
  if (!templateId || !href.startsWith("/") || href.startsWith("//")) {
    return href;
  }

  // [INTV:TRAP] "#섹션" 같은 해시(앵커) 부분은 쿼리스트링과 별개로 URL 맨 끝에 붙어야 하므로, 쿼리를
  // 조작하기 전에 경로+쿼리 부분과 해시 부분을 미리 분리해둔다 — 이 분리 없이 URLSearchParams로
  // 곧바로 파싱하면 해시 안의 "#"나 그 뒤 텍스트까지 쿼리 문자열의 일부로 잘못 섞여 들어갈 수 있다.
  const hashIndex = href.indexOf("#");
  const withoutHash = hashIndex === -1 ? href : href.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : href.slice(hashIndex);
  const [pathname, query] = withoutHash.split("?", 2);
  // URLSearchParams: 쿼리스트링을 파싱/조립해주는 브라우저(및 Node) 표준 API
  const params = new URLSearchParams(query);
  // [INTV:ARCH] 기본 테마로 이동할 때는 ?view=를 굳이 안 붙여서 기본 URL을 깔끔하게 유지한다 —
  // alwaysInclude로 강제할 수도 있음(디버그/테스트 등에서 "지금 이 값이 기본값이어도 명시적으로
  // 드러내고 싶은" 경우를 위한 탈출구).
  const shouldIncludeView =
    options.alwaysInclude || templateId !== defaultTemplateId;

  if (shouldIncludeView) {
    params.set("view", templateId);
  } else {
    params.delete("view");
  }

  // [INTV:ARCH] components/portfolio/content-hint.tsx의 ContentHint들을 화면에 노출시키는 것이
  // 바로 이 ?debug=content 플래그.
  if (options.contentDebug) {
    params.set("debug", "content");
  }

  const queryString = params.toString();

  return `${pathname}${queryString ? `?${queryString}` : ""}${hash}`;
}

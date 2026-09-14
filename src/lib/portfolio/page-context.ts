import { getPortfolioContent } from "./content";
import { resolveContentDebug, resolveHomeTemplateId } from "./selectors";
import type {
  PortfolioContent,
  RouteSearchParams,
} from "./types";

// [INTV:ARCH] 템플릿 리터럴 타입: 일반 문자열 리터럴 유니언("/"|"/about"|...)에 `/projects/${string}`
// 처럼 패턴을 섞을 수 있다 — "/projects/" 뒤에 어떤 문자열이 와도 되지만 그 외의 임의 경로는 타입
// 에러가 나게 만드는 TS 기능(단순 string 타입으로 뒀다면 존재하지 않는 라우트 경로를 실수로 넘겨도
// 컴파일 타임에 안 잡힌다).
export type PortfolioPagePath =
  | "/"
  | "/about"
  | "/contact"
  | "/interview-map"
  | "/journey"
  | "/projects"
  | "/resume"
  | `/projects/${string}`;

// [INTV:ARCH] 이 함수가 template-href.ts에서 만든 "?view=/?debug=" URL 규칙의 짝(읽는 쪽)이다 —
// 요청에 실려온 쿼리스트링을 해석해서 "이번 요청에는 어떤 디자인 테마를 렌더링할지(activeTemplate)"와
// "콘텐츠 디버그 모드를 켤지"를 정하고, 각 src/app/*/page.tsx가 이 결과를 그대로 renderDesignRoute에
// 넘긴다 — 거의 모든 페이지 컴포넌트가 공유하는 공통 진입 로직을 여기 한 곳에 모아둔 것(각 페이지가
// 쿼리 파싱/테마 결정 로직을 반복하지 않고 이 헬퍼 하나만 호출).
export async function resolvePortfolioPageContext({
  content = getPortfolioContent(),
  currentPath,
  searchParams,
}: {
  content?: PortfolioContent;
  currentPath: PortfolioPagePath;
  searchParams?: RouteSearchParams;
}) {
  // [INTV:TRAP] Next.js 최신 버전에서 searchParams는 Promise로 전달되므로 await로 풀어써야 한다
  // (app 라우트 페이지들에서도 반복되는 패턴) — 예전 버전처럼 동기 객체로 가정하고 바로 query.view로
  // 접근하면 Promise 자체의 프로퍼티(undefined)를 읽게 되는 버전 차이 함정.
  const query = searchParams ? await searchParams : {};
  const activeTemplate = resolveHomeTemplateId(
    query.view,
    content.presentation,
  );
  const contentDebug = resolveContentDebug(query.debug);

  return {
    activeTemplate,
    content,
    contentDebug,
    // [INTV:ARCH] shellProps는 designs/shell-props.ts의 createDesignShellProps와 형태가 겹치는데,
    // 이건 이 페이지들이 그쪽 헬퍼를 쓰기 전 단계에서 이미 필요한 곳(예: not-found.tsx처럼 정상
    // 페이지 흐름을 안 타는 곳)에 바로 쓸 수 있게 미리 조립해둔 것.
    shellProps: {
      contentDebug,
      homeTemplate: activeTemplate,
      profile: content.profile,
      site: content.site,
      ui: content.presentation.ui,
      templateSwitcher: {
        activeId: activeTemplate,
        contentDebug,
        currentPath,
        defaultId: content.presentation.defaultHomeTemplate,
        templates: content.presentation.templates,
      },
    },
  };
}

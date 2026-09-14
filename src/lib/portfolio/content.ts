import { portfolioSource } from "../content-loader";
import type {
  ContactContent,
  ContentLink,
  CurationContent,
  ExperienceItem,
  InterviewMapContent,
  JourneyItem,
  JourneyNarrativeContent,
  PortfolioContent,
  PortfolioProject,
  PresentationContent,
  ProfileContent,
  ProjectGroup,
  ProjectMetric,
  ResumeContent,
  SiteContent,
  SkillsContent,
  TechStackItem,
} from "./types";

// [INTV:ARCH] portfolioSource(content-loader.ts에서 JSON들을 읽어 합친 원본 객체)는 TS 입장에서
// 느슨한 타입으로 추론되므로, 이 파일 전체가 `as XxxContent`로 "이 필드는 실제로 이 도메인 타입
// 모양이다"라고 재선언한다 — JSON 콘텐츠를 앱이 신뢰하는 강한 타입 세계로 편입시키는 경계가 이
// 파일이라고 보면 된다. content-loader.ts가 zod로 이미 런타임 검증까지 마쳤기 때문에 여기서의
// `as` 단언은 "검증 안 된 걸 억지로 믿는" 위험한 단언이 아니라, 이미 보장된 사실을 타입 시스템에
// 다시 알려주는 것에 가깝다.
const site = portfolioSource.site as SiteContent;
const profile = portfolioSource.profile as ProfileContent;
const projectGroups = portfolioSource.projects.groups
  .slice()
  .sort((left, right) => left.order - right.order) as ProjectGroup[];
const projectMetrics = portfolioSource.projects.metrics as ProjectMetric[];
const projectGroupById = new Map(
  projectGroups.map((group) => [group.id, group]),
);
// [INTV:PERF] 원본 프로젝트 데이터는 groupId(예: "web")만 갖고 있는데, 화면에 바로 쓸 수 있는
// 사람이 읽는 category 라벨(예: "Web Projects")을 그룹 정의에서 찾아 미리 채워 넣는다 — 이후
// 컴포넌트들이 매번 그룹을 다시 조회할 필요가 없다(이 모듈이 최초 로드될 때 딱 한 번만 매핑을
// 계산해두고, 이후 모든 호출은 이미 채워진 값을 재사용).
const projects = portfolioSource.projects.items.map((project) => ({
  ...project,
  category: projectGroupById.get(project.groupId)?.label ?? project.groupId,
})) as PortfolioProject[];
// [INTV:TRAP] 원본과 목표 타입이 구조적으로 거의 겹치지 않을 때는 TS가 `as`로 바로 단언하는 걸
// 막는데, 일단 `unknown`을 거치면(as unknown as X) 그 안전장치를 우회해 "내가 확실히 안다"고 강제할
// 수 있다 — 이중 단언은 두 타입이 서로 많이 다르다는 신호이기도 하다(남용하면 실제로는 안 맞는
// 타입을 억지로 통과시켜 런타임 버그를 숨길 수 있으니, 여기서처럼 콘텐츠가 이미 zod로 검증된
// 경우에만 신중히 쓸 것).
const presentationSource = portfolioSource.presentation as unknown as PresentationContent;
// [INTV:ARCH] satisfies: `as`나 `: 타입` 표기와 달리, 값의 추론된 타입은 그대로 유지하면서 "이
// 타입 요건을 만족하는지"만 검사해준다 — 아래 pages.projects.groups처럼 원본에 없던 필드를 새로
// 만들어 끼워 넣는 코드에서, 결과가 PresentationContent 모양에 맞는지 컴파일 시점에 확인하면서도
// 실제 리터럴 타입 정보는 잃지 않기 위해 사용.
export const portfolioPresentation = {
  ...presentationSource,
  pages: {
    ...presentationSource.pages,
    projects: {
      ...presentationSource.pages.projects,
      // [INTV:ARCH] 프로젝트 그룹의 라벨/설명을 프레젠테이션 콘텐츠 쪽 스키마(category/body)에
      // 맞게 다시 매핑해서 주입 — projects.json이 소유한 그룹 정의(label/description)를 presentation
      // 쪽 필드명(category/body)으로 바꿔 편입시키는, 두 콘텐츠 파일 간의 경계를 여기서 명시적으로
      // 연결.
      groups: projectGroups.map((group) => ({
        category: group.label,
        body: group.description,
      })),
    },
  },
} satisfies PresentationContent;
const skills = portfolioSource.skills as SkillsContent;
const techStack = portfolioSource.techStack as TechStackItem[];
const experience = portfolioSource.experience as ExperienceItem[];
// [INTV:TRAP] 날짜 문자열(ISO 형식이라 사전순 정렬이 곧 시간순 정렬과 같음)로 1차 정렬하고, 날짜가
// 같으면 제목으로 2차 정렬해 정렬 결과가 매번 같은 순서로 안정적으로 나오게 한다(localeCompare:
// 문자열을 로케일 규칙대로 비교하는 표준 메서드) — 2차 정렬 기준이 없으면, 같은 날짜의 여러 항목이
// 원본 배열 순서에 우연히 의존하게 되어 콘텐츠 파일에서 순서만 바뀌어도 화면 출력 순서가 흔들릴
// 수 있다.
const journey = (portfolioSource.journey as JourneyItem[]).slice().sort((left, right) => {
  const dateOrder = left.date.localeCompare(right.date);

  if (dateOrder !== 0) {
    return dateOrder;
  }

  return left.title.localeCompare(right.title);
});
const links = portfolioSource.links as ContentLink[];
const contact = portfolioSource.contact as ContactContent;
const resume = portfolioSource.resume as ResumeContent;
const journeyNarrative = portfolioSource.journeyNarrative as JourneyNarrativeContent;
const interviewMap = portfolioSource.interviewMap as InterviewMapContent;
const curation = portfolioSource.curation as CurationContent;
export const portfolioTechStackById = new Map(
  techStack.map((item) => [item.id, item]),
);

export function getEnabledLinks(contentLinks: ContentLink[] = links) {
  return contentLinks.filter((link) => link.enabled !== false);
}

// [INTV:ARCH] 이 함수가 사실상 "콘텐츠 저장소의 공개 API"다 — 거의 모든 페이지/컴포넌트가 이 함수를
// 통해서만 콘텐츠를 읽는다(portfolio.ts 배럴 파일이 재노출하는 진입점).
export function getPortfolioContent(
  // [INTV:TRAP] 예전 시그니처와의 호환을 위해 남겨둔 인자 — 지금은 실제로 쓰이지 않는다. 시그니처를
  // 갑자기 바꾸면 이 함수를 인자와 함께 호출하던 기존 코드가 전부 깨지므로, 무해한 매개변수로
  // 남겨 하위 호환을 유지한 것.
  _legacyEnvironment?: Readonly<Record<string, string | undefined>>,
): PortfolioContent {
  // [INTV:TRAP] void expr: 값을 평가만 하고 버린다는 의미의 연산자 — 여기서는 "이 매개변수를
  // 의도적으로 쓰지 않는다"는 걸 린터에게 명시적으로 알려서 "사용하지 않는 변수" 경고를 피하기
  // 위한 관용구(밑줄 접두사 `_legacyEnvironment`만으로 린트 규칙을 못 피하는 설정일 때 흔히 쓰는 보완책).
  void _legacyEnvironment;

  // [INTV:ARCH] 모듈 최상단의 projects/links는 콘텐츠 전체(비활성 항목 포함)를 담고 있고, 실제로
  // 화면에 노출할 때는 매 호출마다 enabled !== false인 것만 다시 걸러낸다 — "원본 카탈로그"와
  // "노출용으로 걸러진 결과"를 분리해둔 설계(원본을 필터링해서 덮어써버리면, 나중에 "비활성 항목도
  // 포함한 전체 목록"이 필요해질 때 원본 데이터 자체가 남아있지 않게 된다).
  const resolvedProjects = projects
    .filter((project) => project.enabled !== false)
    .map((project) => ({
      ...project,
      links: project.links.filter((link) => link.enabled !== false),
    }));

  return {
    site,
    profile,
    projects: resolvedProjects,
    projectGroups,
    projectMetrics,
    presentation: portfolioPresentation,
    skills,
    techStack,
    experience,
    journey,
    journeyNarrative,
    interviewMap,
    curation,
    links: getEnabledLinks(),
    contact,
    resume,
  };
}

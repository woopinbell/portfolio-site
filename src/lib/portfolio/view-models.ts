import {
  getContentLinksByPlacement,
  getPreferredContactLinks,
  getProjectDetailLinks,
  getProjectMetricValue,
} from "./selectors";
import type {
  ContentLink,
  CurationCategory,
  InterviewMapAnswer,
  InterviewMapItem,
  InterviewMapTrack,
  JourneyItem,
  JourneyMilestone,
  PortfolioContent,
  PortfolioProject,
  ProjectGroup,
  ProjectImage,
  ProjectMetric,
  TechStackItem,
} from "./types";

// [INTV:ARCH] 이 파일의 역할: PortfolioContent(콘텐츠 원본 전체)를 그대로 화면에 넘기는 대신, 각
// 라우트(홈/프로젝트 목록/프로젝트 상세 등)가 실제로 필요한 필드만 추리고, Map으로 연결해야 하는
// 관계(예: journey 항목 ↔ 연결된 project)를 미리 다 풀어서 "화면 전용" 객체로 한 번 가공해둔다 —
// 이게 designs 하위 여러 파일에서 보이는 createXViewModel / XViewModel이다. 콘텐츠 스키마가 바뀌어도
// 뷰 컴포넌트가 직접 원본 구조를 파고들지 않게 완충해주는 계층(콘텐츠 저장 형태와 화면 표현 형태를
// 분리하는 View Model 패턴).
type RouteViewModelBase = {
  footerLinks: ContentLink[];
  presentation: PortfolioContent["presentation"];
  profile: PortfolioContent["profile"];
  site: PortfolioContent["site"];
};

type SharedContentKey = "presentation" | "profile" | "site";

// [INTV:TRADE_OFF] 일부 레거시 렌더러가 여전히 로컬 헬퍼를 PortfolioContent 타입으로 취급하고
// 있어서, 이 뷰 모델에 없는 원본 필드를 never로 표시해두면 그 헬퍼들이 뷰 모델 안의 필드를 복사해
// 넣지 않고도 타입 호환을 유지할 수 있다. 구체적으로:
// - Pick<PortfolioContent, VisibleContentKey>로 "이 라우트에서 실제로 쓰는 콘텐츠 필드"만 골라
//   포함시키고,
// - 매핑 타입(`[Key in Exclude<...>]: never`)으로 "이 라우트에서 안 쓰는 나머지 PortfolioContent
//   필드들"은 타입 상으로는 존재하되 값은 절대 가질 수 없는 never 타입으로 선언해둔다.
// 이렇게 하면 이 뷰 모델을 예전처럼 "PortfolioContent 통째로"라고 생각하고 짠 일부 헬퍼 코드와도
// 타입이 호환되면서(필드가 다 "있다"고 인식됨), 실제 런타임 객체에는 해당 필드를 채워 넣지 않아도
// 된다 — 다만 그 대가로 아래 createXViewModel 함수들 끝에 `as HomeViewModel` 같은 타입 단언이
// 필요해진다(never로 선언된 필드까지 실제로 채운 것처럼 컴파일러를 설득할 수 없기 때문). 처음부터
// 이 하위 호환을 요구하지 않았다면, Pick만으로 더 단순하게 짤 수 있었을 트레이드오프.
type RouteViewModel<
  VisibleContentKey extends keyof PortfolioContent,
  RouteFields extends object,
> = RouteViewModelBase &
  Pick<PortfolioContent, VisibleContentKey> &
  RouteFields & {
    readonly [Key in Exclude<
      keyof PortfolioContent,
      SharedContentKey | VisibleContentKey
    >]: never;
  };

export type ProjectGroupViewModel = ProjectGroup & {
  projects: PortfolioProject[];
};

export type ProjectMetricViewModel = ProjectMetric & {
  value: number;
};

export type CurationCategoryViewModel = CurationCategory & {
  projects: PortfolioProject[];
};

// [INTV:ARCH] route: "home"처럼 각 뷰 모델에 고정된 문자열 리터럴 필드를 갖게 해서, 이 타입들을
// 하나로 묶은 PortfolioRouteViewModel(아래)이 route 값으로 서로 구분되는 판별 유니언이 되게 한다 —
// designs/types.ts, designs/registry.tsx에서 route/viewModel 짝을 강제하는 메커니즘이 바로 이
// 구조에 의존한다(zod의 discriminatedUnion과 같은 "타입 필드로 분기"라는 아이디어를, 런타임 검증이
// 필요 없는 순수 타입 레벨에서 재구현한 것).
export type HomeViewModel = RouteViewModel<
  "contact" | "journey" | "journeyNarrative" | "skills" | "techStack",
  {
    route: "home";
    currentYear: number;
    featuredProjects: PortfolioProject[];
    featuredOrAllProjects: PortfolioProject[];
    heroLinks: ContentLink[];
    leadProject: PortfolioProject | null;
    metricValues: Record<string, number>;
    metrics: ProjectMetricViewModel[];
    preferredContactLinks: ContentLink[];
    projectCount: number;
    recentJourney: PortfolioContent["journey"];
  }
>;

export type ProjectIndexViewModel = RouteViewModel<
  "contact" | "projects",
  {
    route: "projects";
    archiveGroupEntries: [string, PortfolioProject[]][];
    archiveGroups: ProjectGroupViewModel[];
    archiveProjects: PortfolioProject[];
    featuredProjects: PortfolioProject[];
    groupEntries: [string, PortfolioProject[]][];
    groups: ProjectGroupViewModel[];
    metricValues: Record<string, number>;
    metrics: ProjectMetricViewModel[];
  }
>;

export type ProjectDetailViewModel = RouteViewModel<
  never,
  {
    route: "project-detail";
    detailLinks: ContentLink[];
    project: PortfolioProject;
    stackItems: TechStackItem[];
    supportingImages: ProjectImage[];
  }
>;

export type AboutViewModel = RouteViewModel<
  "contact" | "curation" | "experience" | "journey" | "skills",
  {
    route: "about";
    curationCategories: CurationCategoryViewModel[];
  }
>;

export type ResumeViewModel = RouteViewModel<
  "experience" | "resume",
  {
    route: "resume";
    resumeProjects: PortfolioProject[];
  }
>;

export type ContactViewModel = RouteViewModel<
  "contact",
  {
    route: "contact";
    cinematicLinks: ContentLink[];
    contactPlacementLinks: ContentLink[];
    preferredLinks: ContentLink[];
    preferredOrContactLinks: ContentLink[];
  }
>;

export type JourneyMilestoneViewModel = JourneyMilestone & {
  anchorProjects: PortfolioProject[];
};

export type JourneyItemViewModel = JourneyItem & {
  project: PortfolioProject | null;
};

export type JourneyViewModel = RouteViewModel<
  "journey" | "journeyNarrative",
  {
    route: "journey";
    milestones: JourneyMilestoneViewModel[];
    timelineItems: JourneyItemViewModel[];
  }
>;

export type InterviewMapAnswerViewModel = InterviewMapAnswer & {
  project: PortfolioProject | null;
};

// [INTV:ARCH] Omit<T, "필드">: T의 모든 필드 중 지정한 것만 뺀 나머지를 그대로 가져오는 유틸리티
// 타입 — 여기서는 InterviewMapItem의 answers 필드만 "project가 채워진 버전
// (InterviewMapAnswerViewModel[])"으로 바꿔치기하기 위해, 우선 answers를 뺀 나머지를 그대로
// 재사용하고 새 answers 타입을 덧붙인다.
export type InterviewMapItemViewModel = Omit<InterviewMapItem, "answers"> & {
  answers: InterviewMapAnswerViewModel[];
};

export type InterviewMapTrackViewModel = Omit<InterviewMapTrack, "items"> & {
  items: InterviewMapItemViewModel[];
};

export type InterviewMapViewModel = RouteViewModel<
  "interviewMap",
  {
    route: "interview-map";
    tracks: InterviewMapTrackViewModel[];
  }
>;

export type PortfolioRouteViewModel =
  | HomeViewModel
  | ProjectIndexViewModel
  | ProjectDetailViewModel
  | AboutViewModel
  | ResumeViewModel
  | ContactViewModel
  | JourneyViewModel
  | InterviewMapViewModel;

// [INTV:ARCH] 모든 라우트 뷰 모델이 공통으로 갖는 필드(footerLinks/presentation/profile/site)를
// 한 번만 계산해서 아래 각 createXViewModel이 스프레드(...)로 이어붙여 쓴다 — 라우트마다 반복될
// 코드를 줄인 것.
function createRouteViewModelBase(
  content: PortfolioContent,
): RouteViewModelBase {
  return {
    footerLinks: getContentLinksByPlacement("footer", content),
    presentation: content.presentation,
    profile: content.profile,
    site: content.site,
  };
}

// [INTV:EDGE] 프로젝트 목록을 groupId 기준으로 묶어서, 콘텐츠에 명시적으로 정의된 그룹
// (content.projectGroups)에는 그 정의(라벨/설명/순서)를 그대로 붙이고, 프로젝트 데이터에는 있지만
// 그룹 정의가 따로 없는 groupId는 "정의되지 않은 그룹"으로 즉석에서 만들어 뒤에 이어붙인다(라벨은
// 소속 프로젝트의 category로 대체) — 콘텐츠 작성자가 그룹 정의를 깜빡 빠뜨려도 화면에서 프로젝트가
// 누락되지 않도록 한 방어적 설계(content-loader.ts의 참조 무결성 검사가 groupId 존재 자체는
// 강제하지만, "그룹 정의 누락"까지 빌드 실패로 막지는 않으므로 여기서도 한 번 더 방어).
function resolveProjectGroups(
  content: PortfolioContent,
  projects: PortfolioProject[],
) {
  const projectsByGroup = new Map<string, PortfolioProject[]>();

  for (const project of projects) {
    projectsByGroup.set(project.groupId, [
      ...(projectsByGroup.get(project.groupId) ?? []),
      project,
    ]);
  }

  const configuredGroups = content.projectGroups
    .map((group) => ({
      ...group,
      projects: projectsByGroup.get(group.id) ?? [],
    }))
    .filter((group) => group.projects.length > 0);
  const configuredGroupIds = new Set(
    configuredGroups.map((group) => group.id),
  );
  const unconfiguredGroups = [...projectsByGroup.entries()]
    .filter(([groupId]) => !configuredGroupIds.has(groupId))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([groupId, groupedProjects], index) => ({
      description: "",
      id: groupId,
      label: groupedProjects[0]?.category ?? groupId,
      order: content.projectGroups.length + index,
      projects: groupedProjects,
    }));

  return [...configuredGroups, ...unconfiguredGroups];
}

export function createHomeViewModel(
  content: PortfolioContent,
  now: Date = new Date(),
): HomeViewModel {
  const featuredProjects = content.projects.filter(
    (project) => project.featured,
  );
  const featuredOrAllProjects =
    featuredProjects.length > 0 ? featuredProjects : content.projects;
  // [INTV:ARCH] Object.fromEntries: [키, 값] 쌍의 배열을 일반 객체로 바꿔주는 표준 메서드 —
  // metric.id를 키로, 계산된 값을 값으로 하는 { metricId: number } 형태의 조회용 객체를 만든다.
  const metricValues = Object.fromEntries(
    content.projectMetrics.map((metric) => [
      metric.id,
      getProjectMetricValue(metric.id, content),
    ]),
  );
  const metrics = content.projectMetrics.map((metric) => ({
    ...metric,
    value: metricValues[metric.id] ?? 0,
  }));

  return {
    ...createRouteViewModelBase(content),
    contact: content.contact,
    currentYear: now.getFullYear(),
    featuredOrAllProjects,
    featuredProjects,
    heroLinks: getContentLinksByPlacement("hero", content),
    leadProject: featuredOrAllProjects[0] ?? null,
    metricValues,
    metrics,
    preferredContactLinks: getPreferredContactLinks(content),
    projectCount: content.projects.length,
    journey: content.journey,
    journeyNarrative: content.journeyNarrative,
    // [INTV:TRAP] slice(-4): 배열 끝에서부터 4개를 가져옴(음수 인덱스는 끝에서부터 센다) → 최신
    // 4개를 얻은 뒤 reverse()로 "가장 최근이 먼저" 순서로 뒤집는다(journey 배열 자체는 오래된 순으로
    // 정렬돼 있으므로) — slice만 하고 reverse를 빼먹으면 "최신 4개"가 아니라 "그중 가장 오래된 것부터"
    // 순서로 보여지는 실수가 흔하다.
    recentJourney: content.journey.slice(-4).reverse(),
    route: "home",
    skills: content.skills,
    techStack: content.techStack,
    // [INTV:TRAP] 위 RouteViewModel 타입 설명에서 언급한 대로, never로 선언된(이 라우트에서 안
    // 쓰는) 필드들을 실제로 채우지 않고도 타입을 맞추기 위한 단언 — 아래 다른 createXViewModel
    // 함수들도 전부 동일한 이유로 끝에 as를 붙인다. 이 as를 빼면 TypeScript가 "never 타입 필드가
    // 빠졌다"고 컴파일 에러를 낸다(실제로는 의도적으로 안 채우는 것인데도).
  } as HomeViewModel;
}

export function createProjectIndexViewModel(
  content: PortfolioContent,
): ProjectIndexViewModel {
  const featuredProjects = content.projects.filter(
    (project) => project.featured,
  );
  const archiveProjects = content.projects.filter(
    (project) => !project.featured,
  );

  const archiveGroups = resolveProjectGroups(content, archiveProjects);
  const groups = resolveProjectGroups(content, content.projects);
  const metrics = content.projectMetrics.map((metric) => ({
    ...metric,
    value: getProjectMetricValue(metric.id, content),
  }));

  return {
    ...createRouteViewModelBase(content),
    archiveGroupEntries: archiveGroups.map((group) => [
      group.label,
      group.projects,
    ]),
    archiveGroups,
    archiveProjects,
    contact: content.contact,
    featuredProjects,
    groupEntries: groups.map((group) => [group.label, group.projects]),
    groups,
    metricValues: Object.fromEntries(
      metrics.map((metric) => [metric.id, metric.value]),
    ),
    metrics,
    projects: content.projects,
    route: "projects",
  } as ProjectIndexViewModel;
}

export function createProjectDetailViewModel(
  content: PortfolioContent,
  projectId: string,
): ProjectDetailViewModel | null {
  const project = content.projects.find((item) => item.id === projectId);

  if (!project) {
    return null;
  }

  const stackById = new Map(
    content.techStack.map((item) => [item.id, item]),
  );

  return {
    ...createRouteViewModelBase(content),
    detailLinks: getProjectDetailLinks(project),
    project,
    route: "project-detail",
    stackItems: project.stack.map(
      (id) =>
        stackById.get(id) ?? {
          color: "#9cc8b1",
          icon: "tool",
          id,
          label: id,
        },
    ),
    // [INTV:EDGE] 대표 스크린샷(project.screenshot)과 URL이 같은 이미지는 screenshots 갤러리에서
    // 제외해 같은 사진이 두 번 보이지 않게 한다.
    supportingImages: project.screenshots.filter(
      (image) => image.src !== project.screenshot.src,
    ),
  } as ProjectDetailViewModel;
}

export function createAboutViewModel(
  content: PortfolioContent,
): AboutViewModel {
  const projectById = new Map(
    content.projects.map((project) => [project.id, project]),
  );

  return {
    ...createRouteViewModelBase(content),
    contact: content.contact,
    curation: content.curation,
    curationCategories: content.curation.categories.map((category) => ({
      ...category,
      projects: category.projectIds
        .map((projectId) => projectById.get(projectId))
        .filter((project): project is PortfolioProject => Boolean(project)),
    })),
    experience: content.experience,
    journey: content.journey,
    route: "about",
    skills: content.skills,
  } as AboutViewModel;
}

export function createResumeViewModel(
  content: PortfolioContent,
): ResumeViewModel {
  const projectById = new Map(
    content.projects.map((project) => [project.id, project]),
  );

  return {
    ...createRouteViewModelBase(content),
    experience: content.experience,
    resume: content.resume,
    resumeProjects: content.resume.projectIds
      .map((projectId) => projectById.get(projectId))
      .filter((project): project is PortfolioProject => Boolean(project)),
    route: "resume",
  } as ResumeViewModel;
}

export function createContactViewModel(
  content: PortfolioContent,
): ContactViewModel {
  const contactPlacementLinks = getContentLinksByPlacement("contact", content);
  const preferredLinks = getPreferredContactLinks(content);
  const preferredOrContactLinks =
    preferredLinks.length > 0 ? preferredLinks : contactPlacementLinks;

  return {
    ...createRouteViewModelBase(content),
    cinematicLinks: preferredOrContactLinks,
    contact: content.contact,
    contactPlacementLinks,
    preferredLinks,
    preferredOrContactLinks,
    route: "contact",
  } as ContactViewModel;
}

export function createJourneyViewModel(
  content: PortfolioContent,
): JourneyViewModel {
  const projectById = new Map(
    content.projects.map((project) => [project.id, project]),
  );

  return {
    ...createRouteViewModelBase(content),
    journey: content.journey,
    journeyNarrative: content.journeyNarrative,
    milestones: content.journeyNarrative.milestones.map((milestone) => ({
      ...milestone,
      anchorProjects: milestone.anchorProjectIds
        .map((projectId) => projectById.get(projectId))
        .filter((project): project is PortfolioProject => Boolean(project)),
    })),
    route: "journey",
    timelineItems: content.journey.map((item) => ({
      ...item,
      project: item.projectId ? (projectById.get(item.projectId) ?? null) : null,
    })),
  } as JourneyViewModel;
}

export function createInterviewMapViewModel(
  content: PortfolioContent,
): InterviewMapViewModel {
  const projectById = new Map(
    content.projects.map((project) => [project.id, project]),
  );

  return {
    ...createRouteViewModelBase(content),
    interviewMap: content.interviewMap,
    route: "interview-map",
    tracks: content.interviewMap.tracks.map((track) => ({
      ...track,
      items: track.items.map((item) => ({
        ...item,
        answers: item.answers.map((answer) => ({
          ...answer,
          project: projectById.get(answer.projectId) ?? null,
        })),
      })),
    })),
  } as InterviewMapViewModel;
}

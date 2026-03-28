import type {
  PresentationContentSource,
  ProjectGroup,
  ProjectMetric,
} from "../content-schema";

// [INTV:ARCH] 이 파일 전체는 src/content/*.json 각 파일이 실제로 어떤 모양인지를 TS 타입으로
// 정의해둔 "콘텐츠 스키마"다 — 대부분 필드 목록만 나열하는 평범한 타입 선언이라 개별 타입마다
// 주석을 달지 않았고, 아래처럼 TS 특유의 표현(재노출/인덱스 접근 타입 등)이 쓰인 곳에만 주석을
// 달았다.
// [INTV:TRAP] `export type { ... } from`처럼 type 키워드가 붙은 재노출은 "값"이 아니라 "타입 선언"만
// 그대로 다시 내보낸다는 뜻 — 일반 export와 구분해두면 번들러가 타입 전용 import를 실제 런타임
// 코드에서 안전하게 제거할 수 있다(type 키워드 없이 재노출하면, 번들러가 이게 값인지 타입인지
// 확신 못 해 불필요한 런타임 import가 번들에 남을 수 있다).
export type {
  PortfolioProjectSource,
  ProjectGroup,
  ProjectMetric,
  ProjectMetricFilter,
  ProjectsContentSource,
} from "../content-schema";

export type NavigationItem = {
  label: string;
  href: string;
};

export type SiteContent = {
  title: string;
  description: string;
  language: string;
  brand: string;
  socialImage?: string;
  pages?: Record<SitePageId, boolean>;
  navigation: NavigationItem[];
  footer: {
    note: string;
    copyright: string;
  };
};

export type SitePageId =
  | "projects"
  | "about"
  | "resume"
  | "contact"
  | "journey"
  | "interviewMap"
  | "curation";

export type ProfilePrinciple = {
  title: string;
  body: string;
};

export type ProfilePhoto = {
  src: string;
  alt: string;
};

export type ProfileContent = {
  name: string;
  koreanName: string;
  handle: string;
  role: string;
  headline: string;
  summary: string;
  location: string;
  availability: string;
  photo?: ProfilePhoto;
  principles: ProfilePrinciple[];
};

export type LinkType =
  | "case-study"
  | "demo"
  | "email"
  | "github"
  | "resume"
  | "source"
  | "website";

export type LinkPlacement = "hero" | "contact" | "card" | "detail" | "footer";

export type ContentLink = {
  id?: string;
  type: LinkType;
  label: string;
  href: string;
  external?: boolean;
  enabled?: boolean;
  placements?: LinkPlacement[];
};

export type DeploymentStatus =
  | "archived"
  | "case-study-only"
  | "live"
  | "offline"
  | "private"
  | "source-only";

export type DeploymentState = {
  status: DeploymentStatus;
  label: string;
  showBadge?: boolean;
};

export type ProjectImage = {
  src: string;
  alt: string;
};

export type ProjectArchitecture = {
  summary: string;
  items: string[];
};

export type PortfolioProject = {
  id: string;
  order: string;
  title: string;
  groupId: string;
  tags: string[];
  category: string;
  featured?: boolean;
  enabled?: boolean;
  period: string;
  role: string;
  summary: string;
  description: string;
  deployment: DeploymentState;
  screenshot: ProjectImage;
  screenshots: ProjectImage[];
  stack: string[];
  links: ContentLink[];
  highlights: string[];
  problem: string;
  solution: string;
  architecture: ProjectArchitecture;
  decisions: string[];
  tradeoffs: string[];
  results: string[];
};

export type SiteDesignId =
  | "design"
  | "classic"
  | "editorial"
  | "brutalist"
  | "cinematic";

export type HomeTemplateId = SiteDesignId;

export type PresentationTemplate = {
  id: HomeTemplateId;
  label: string;
  description: string;
};

export type HomeSectionId =
  | "contact"
  | "featured"
  | "journey"
  | "stack"
  | "technicalFocus"
  | "workMap";

export type SectionCopy = {
  actionLabel?: string;
  title: string;
  body?: string;
};

export type WorkMapCountKey =
  | "curriculumCount"
  | "productCount"
  | "reliabilityCount";

export type WorkMapCard = {
  id: string;
  label: string;
  body: string;
  countKey: WorkMapCountKey;
};

export type WorkMapPresentation = SectionCopy & {
  cards: WorkMapCard[];
};

export type HomeStatPresentation = {
  label: string;
  countKey: WorkMapCountKey;
};

export type DesignHomeHeroPresentation = {
  primaryActionLabel: string;
  leadLabel: string;
  leadActionLabel: string;
  stats: HomeStatPresentation[];
};

export type ClassicHomeHeroPresentation = {
  primaryActionLabel: string;
};

export type TerminalCommand = {
  command: string;
  output: string[];
};

export type TerminalPresentation = {
  title: string;
  bootLine: string;
  promptUser: string;
  promptPath: string;
  commands: TerminalCommand[];
};

// [INTV:ARCH] 인덱스 접근 타입(Indexed Access Type): 객체 타입 뒤에 `["필드명"]`을 붙이면 그 필드
// 하나의 타입만 뽑아낼 수 있다. PresentationContentSource라는 큰 스키마 타입 전체를 다시 선언하지
// 않고, 그 안의 home 필드 타입만 재사용하는 것(content-schema.ts에서 필드 구조가 바뀌면 이 타입도
// 자동으로 따라간다 — z.infer와 같은 "하나의 소스에서 파생" 철학). 아래 pages.xxx 계열 타입들도
// 전부 같은 방식이라 반복 설명하지 않는다.
export type HomePresentation = PresentationContentSource["home"];

export type ProjectGroupPresentation = {
  category: string;
  body: string;
};

export type ProjectPageCountKey =
  | "curriculumCount"
  | "projectCount"
  | "sourceOnlyCount";

export type ProjectPageContent = PresentationContentSource["pages"]["projects"];

export type ProjectDetailPageContent =
  PresentationContentSource["pages"]["projectDetail"];

export type AboutPageContent = PresentationContentSource["pages"]["about"];

export type JourneyPageContent = PresentationContentSource["pages"]["journey"];

export type InterviewMapPageContent =
  PresentationContentSource["pages"]["interviewMap"];

export type ResumePageContent = PresentationContentSource["pages"]["resume"];

export type ContactPageContent = PresentationContentSource["pages"]["contact"];

export type PresentationContent = PresentationContentSource;

export type TechStackIcon =
  | "api"
  | "box"
  | "c"
  | "check"
  | "cmake"
  | "cplusplus"
  | "database"
  | "docker"
  | "eslint"
  | "flow"
  | "json"
  | "nextjs"
  | "nodejs"
  | "playwright"
  | "postgresql"
  | "prisma"
  | "react"
  | "redis"
  | "shield"
  | "tailwind"
  | "terminal"
  | "tool"
  | "typescript"
  | "vitest";

export type TechStackItem = {
  id: string;
  label: string;
  icon: TechStackIcon;
  color: string;
};

export type SkillFocusArea = {
  title: string;
  body: string;
};

export type SkillGroup = {
  title: string;
  items: string[];
};

export type SkillsContent = {
  focusAreas: SkillFocusArea[];
  groups: SkillGroup[];
};

export type ExperienceItem = {
  period: string;
  title: string;
  body: string;
};

export type JourneyItem = {
  date: string;
  endDate: string | null;
  title: string;
  category: string;
  body: string;
  projectId: string | null;
  sourcePath: string | null;
};

export type ContactContent = {
  title: string;
  intro: string;
  availability: string;
  preferred: string[];
  notes: string[];
};

export type ResumeTraining = {
  name: string;
  period: string;
  description: string;
};

export type ResumeEducation = {
  name: string;
  period: string;
  description: string;
};

export type ResumeContent = {
  downloadUrl: string | null;
  summary: string[];
  projectIds: string[];
  training: ResumeTraining[];
  education: ResumeEducation[];
  notes: string[];
};

export type JourneyMilestone = {
  id: string;
  date: string;
  title: string;
  state: string;
  reason: string;
  result: string;
  anchorProjectIds: string[];
};

export type JourneyNarrativeContent = {
  intro: string;
  milestones: JourneyMilestone[];
  currentPosition: {
    title: string;
    body: string;
  };
};

export type InterviewMapReference = {
  label: string;
  href: string;
};

export type InterviewMapAnswer = {
  projectId: string;
  depth: string;
};

export type InterviewMapItem = {
  label: string;
  reference: string;
  answers: InterviewMapAnswer[];
};

export type InterviewMapTrack = {
  id: string;
  label: string;
  body: string;
  items: InterviewMapItem[];
};

export type InterviewMapContent = {
  intro: string;
  referenceRepo: InterviewMapReference;
  tracks: InterviewMapTrack[];
  gaps: {
    title: string;
    body: string;
    items: string[];
  };
};

export type CurationCategory = {
  id: string;
  label: string;
  rationale: string;
  projectIds: string[];
};

export type CurationOmissionItem = {
  title: string;
  body: string;
};

export type CurationCriteriaItem = {
  title: string;
  body: string;
};

export type CurationContent = {
  intro: string;
  criteria: {
    title: string;
    items: CurationCriteriaItem[];
  };
  categories: CurationCategory[];
  omissions: {
    title: string;
    body: string;
    items: CurationOmissionItem[];
  };
  nextReview: {
    title: string;
    body: string;
  };
};

export type PortfolioContent = {
  site: SiteContent;
  profile: ProfileContent;
  projects: PortfolioProject[];
  projectGroups: ProjectGroup[];
  projectMetrics: ProjectMetric[];
  presentation: PresentationContent;
  skills: SkillsContent;
  techStack: TechStackItem[];
  experience: ExperienceItem[];
  journey: JourneyItem[];
  journeyNarrative: JourneyNarrativeContent;
  interviewMap: InterviewMapContent;
  curation: CurationContent;
  links: ContentLink[];
  contact: ContactContent;
  resume: ResumeContent;
};

// [INTV:TRAP] Next.js 최신 버전에서 페이지 컴포넌트의 searchParams prop은 동기 객체가 아니라
// Promise로 전달된다(src/app 하위 각 page.tsx에서 반복해서 await searchParams로 풀어쓰는 이유) —
// 그 타입을 여기 한 곳에 정의해 공유한다.
export type RouteSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

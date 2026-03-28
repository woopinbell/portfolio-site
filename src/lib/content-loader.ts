// [INTV:ARCH] JSON 파일을 일반 모듈처럼 import할 수 있는 건 TS/번들러의 "JSON 모듈" 지원 덕분 —
// 빌드 시점에 그 파일의 내용이 JS 객체 리터럴로 바뀌어 번들에 포함된다(런타임에 fetch로 읽어오는
// 게 아님) — 콘텐츠가 바뀌면 재빌드가 필요하다는 뜻이고, 그 대가로 런타임 네트워크 왕복이나
// 파일시스템 접근 없이 즉시 사용 가능하다.
import contactJson from "@/content/contact.json";
import curationJson from "@/content/curation.json";
import experienceJson from "@/content/experience.json";
import interviewMapJson from "@/content/interview-map.json";
import journeyJson from "@/content/journey.json";
import journeyNarrativeJson from "@/content/journey-narrative.json";
import linksJson from "@/content/links.json";
import presentationJson from "@/content/presentation.json";
import profileJson from "@/content/profile.json";
import projectsJson from "@/content/projects.json";
import resumeJson from "@/content/resume.json";
import siteJson from "@/content/site.json";
import skillsJson from "@/content/skills.json";
import techStackJson from "@/content/tech-stack.json";
// [INTV:EDGE] zod: 런타임 스키마 검증 라이브러리. lib/portfolio/content.ts가 JSON을 `as Type`으로
// "믿고" 받아들이는 것과 달리, 이 파일은 실제로 각 JSON의 모양이 스키마(content-schema.ts에 정의됨)와
// 맞는지 실행 중에 검사한다 — 콘텐츠 파일을 사람이 손으로 고치다 실수해도(타입이 틀리거나 필수
// 필드를 빠뜨려도) 여기서 바로 걸러진다. `as Type` 단언만으로는 실제 JSON이 그 타입과 다르게
// 생겨도 컴파일은 통과하고 런타임에야(혹은 아예 발견 못 하고) 문제가 드러난다.
import { z } from "zod";

import {
  contactContentSchema,
  curationContentSchema,
  experienceContentSchema,
  interviewMapContentSchema,
  journeyContentSchema,
  journeyNarrativeContentSchema,
  linksContentSchema,
  presentationContentSchema,
  profileContentSchema,
  projectsContentSchema,
  resumeContentSchema,
  siteContentSchema,
  skillsContentSchema,
  techStackContentSchema,
} from "./content-schema";

export type ContentValidationIssue = {
  file: string;
  path: string;
  message: string;
};

const supportedDesignIdList = [
  "design",
  "classic",
  "editorial",
  "brutalist",
  "cinematic",
] as const;
const supportedDesignIds = new Set<string>(supportedDesignIdList);

type NavigablePageId =
  | "projects"
  | "about"
  | "resume"
  | "contact"
  | "journey"
  | "interviewMap";

const internalNavigationPages = new Map<string, NavigablePageId>([
  ["/projects", "projects"],
  ["/about", "about"],
  ["/resume", "resume"],
  ["/contact", "contact"],
  ["/journey", "journey"],
  ["/interview-map", "interviewMap"],
] as const);

// [INTV:ARCH] 아래 loadPortfolioSource가 기본적으로는 실제 JSON 파일들을 읽지만, 이 타입으로 특정
// 필드만 다른 값으로 바꿔치기(override)할 수 있게 열어뒀다 — 테스트 코드에서 가짜 콘텐츠를 주입할
// 때 쓰기 위한 구조(portfolio.test.ts 등이 실제 content/*.json 없이도 검증 로직만 독립적으로
// 테스트할 수 있게 한다 — 의존성 주입).
export type PortfolioSourceOverrides = Partial<
  Record<
    | "site"
    | "profile"
    | "projects"
    | "presentation"
    | "skills"
    | "techStack"
    | "experience"
    | "journey"
    | "links"
    | "contact"
    | "resume"
    | "journeyNarrative"
    | "interviewMap"
    | "curation",
    unknown
  >
>;

export class PortfolioContentError extends Error {
  readonly issues: ContentValidationIssue[];

  constructor(issues: ContentValidationIssue[]) {
    const details = issues
      .map(({ file, path, message }) => `- ${file}:${path} ${message}`)
      .join("\n");

    super(`Portfolio content validation failed:\n${details}`);
    this.name = "PortfolioContentError";
    this.issues = issues;
  }
}

// [INTV:ARCH] content-readiness.ts의 appendPath와 같은 목적(JSONPath 스타일 경로 문자열 조립)의
// 별도 구현 — 여기서는 zod가 주는 오류 경로(PropertyKey[], 즉 string|number|symbol의 배열)를 한
// 번에 reduce로 접는다(두 파일이 서로 다른 시점/입력 형태에서 같은 개념을 각자 필요한 형태로 구현).
function jsonPath(path: PropertyKey[]) {
  if (path.length === 0) {
    return "$";
  }

  return path.reduce<string>((result, segment) => {
    if (typeof segment === "number") {
      return `${result}[${segment}]`;
    }

    const key = String(segment);
    return /^[a-zA-Z_$][\w$]*$/.test(key)
      ? `${result}.${key}`
      : `${result}[${JSON.stringify(key)}]`;
  }, "$" );
}

// [INTV:ARCH] 제네릭 <Schema extends z.ZodType>: 어떤 구체적인 zod 스키마가 들어오든, 그 스키마가
// "검증을 통과했을 때 만들어내는 타입"(z.output<Schema>)을 함수의 반환 타입으로 그대로 흘려보낸다 —
// 그래서 아래 loadPortfolioSource에서 이 함수를 siteContentSchema로 호출하면 결과가 site 콘텐츠
// 타입으로, projectsContentSchema로 호출하면 projects 콘텐츠 타입으로 자동으로 달라진다(호출부마다
// 반환 타입을 따로 써줄 필요가 없다).
// [INTV:EDGE] schema.safeParse(input): 검증 실패 시 예외를 던지는 parse()와 달리, safeParse는
// 성공/실패 여부와 함께 에러 목록을 값으로 돌려준다 — 그 값을 이 프로젝트 자체의 에러 형식
// (ContentValidationIssue)으로 변환해서 던진다(zod의 원본 에러 형태를 그대로 밖으로 노출하지
// 않고, 이 프로젝트가 정의한 일관된 이슈 형식으로 감싸는 계층).
function parseContentFile<Schema extends z.ZodType>(
  file: string,
  schema: Schema,
  input: unknown,
): z.output<Schema> {
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    throw new PortfolioContentError(
      parsed.error.issues.map((issue) => ({
        file,
        path: jsonPath(issue.path),
        message: issue.message,
      })),
    );
  }

  return parsed.data;
}

function findDuplicates(values: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }

    seen.add(value);
  }

  return duplicates;
}

function addDuplicateIssues(
  issues: ContentValidationIssue[],
  file: string,
  path: string,
  label: string,
  values: string[],
) {
  for (const duplicate of findDuplicates(values)) {
    issues.push({
      file,
      path,
      message: `Duplicate ${label} "${duplicate}".`,
    });
  }
}

function addMissingReferenceIssue(
  issues: ContentValidationIssue[],
  file: string,
  path: string,
  referenceType: string,
  reference: string,
  knownReferences: Set<string>,
) {
  if (!knownReferences.has(reference)) {
    issues.push({
      file,
      path,
      message: `Unknown ${referenceType} "${reference}".`,
    });
  }
}

// [INTV:EDGE] 콘텐츠 안의 내부 링크(href가 "/"로 시작)가 실제로 존재하고 활성화된 라우트를
// 가리키는지 검증한다 — 예를 들어 links.json에 "/project"(오타, 실제로는 "/projects")라고 적혀
// 있으면 여기서 잡아낸다. 존재하지 않는 페이지로의 링크, 비활성화된 페이지로의 링크, 존재하지
// 않거나 비활성화된 프로젝트로의 링크까지 이 함수 하나가 전부 검사한다 — 깨진 내부 링크를 런타임
// 404로 사용자가 마주치기 전에 빌드 시점에 잡아내는 방어.
function addInternalRouteIssue({
  enabledProjectIds,
  file,
  href,
  issues,
  path,
  routeKind,
  site,
}: {
  enabledProjectIds: Set<string>;
  file: string;
  href: string;
  issues: ContentValidationIssue[];
  path: string;
  routeKind: "link" | "navigation";
  site: z.output<typeof siteContentSchema>;
}) {
  if (!href.startsWith("/") || href.startsWith("//")) {
    return;
  }

  // [INTV:TRAP] href는 "/projects/foo?x=1" 같은 상대 경로 문자열이라 그 자체로는 URL 생성자에 못
  // 넣는다(new URL("/foo")는 base 없이 예외를 던진다) — 실제로는 절대 쓰이지 않을 더미 origin
  // (.invalid는 content-readiness.ts의 isReservedHostname과 같은 이유로 예약된 도메인)을 base로
  // 넘겨서 URL 파서의 힘을 빌려 쿼리스트링/해시를 다 떼어내고 깨끗한 pathname만 뽑아내는 흔한
  // 트릭이다 — 직접 문자열을 잘라 pathname을 구하려 하면 쿼리스트링/해시 경계 처리에서 놓치기 쉬운
  // 엣지 케이스가 많다.
  const pathname = new URL(href, "https://portfolio.invalid").pathname;
  if (pathname === "/") {
    return;
  }

  const projectMatch = pathname.match(/^\/projects\/([^/]+)\/?$/);
  const pageId = projectMatch
    ? "projects"
    : internalNavigationPages.get(pathname);

  if (!pageId) {
    issues.push({
      file,
      path,
      message: `Unsupported internal ${routeKind} route "${pathname}".`,
    });
    return;
  }

  if (site.pages?.[pageId] === false) {
    issues.push({
      file,
      path,
      message: `Internal ${routeKind} route "${pathname}" points to disabled page "${pageId}".`,
    });
  }

  if (projectMatch) {
    const projectId = decodeURIComponent(projectMatch[1]);
    if (!enabledProjectIds.has(projectId)) {
      issues.push({
        file,
        path,
        message: `Internal ${routeKind} route "${pathname}" points to unknown or disabled project "${projectId}".`,
      });
    }
  }
}

export function loadPortfolioSource(overrides: PortfolioSourceOverrides = {}) {
  const input = {
    site: siteJson,
    profile: profileJson,
    projects: projectsJson,
    presentation: presentationJson,
    skills: skillsJson,
    techStack: techStackJson,
    experience: experienceJson,
    journey: journeyJson,
    links: linksJson,
    contact: contactJson,
    resume: resumeJson,
    journeyNarrative: journeyNarrativeJson,
    interviewMap: interviewMapJson,
    curation: curationJson,
    ...overrides,
  };

  const site = parseContentFile("src/content/site.json", siteContentSchema, input.site);
  const profile = parseContentFile(
    "src/content/profile.json",
    profileContentSchema,
    input.profile,
  );
  const projects = parseContentFile(
    "src/content/projects.json",
    projectsContentSchema,
    input.projects,
  );
  const presentation = parseContentFile(
    "src/content/presentation.json",
    presentationContentSchema,
    input.presentation,
  );
  const skills = parseContentFile(
    "src/content/skills.json",
    skillsContentSchema,
    input.skills,
  );
  const techStack = parseContentFile(
    "src/content/tech-stack.json",
    techStackContentSchema,
    input.techStack,
  );
  const experience = parseContentFile(
    "src/content/experience.json",
    experienceContentSchema,
    input.experience,
  );
  const journey = parseContentFile(
    "src/content/journey.json",
    journeyContentSchema,
    input.journey,
  );
  const links = parseContentFile(
    "src/content/links.json",
    linksContentSchema,
    input.links,
  );
  const contact = parseContentFile(
    "src/content/contact.json",
    contactContentSchema,
    input.contact,
  );
  const resume = parseContentFile(
    "src/content/resume.json",
    resumeContentSchema,
    input.resume,
  );
  const journeyNarrative = parseContentFile(
    "src/content/journey-narrative.json",
    journeyNarrativeContentSchema,
    input.journeyNarrative,
  );
  const interviewMap = parseContentFile(
    "src/content/interview-map.json",
    interviewMapContentSchema,
    input.interviewMap,
  );
  const curation = parseContentFile(
    "src/content/curation.json",
    curationContentSchema,
    input.curation,
  );

  // [INTV:ARCH] 여기서부터 끝까지는 "참조 무결성" 검사 구간이다 — 관계형 DB의 외래키 제약과 비슷한
  // 개념을, 여러 개의 독립된 JSON 파일들 사이에서 빌드 시점에 수동으로 검증한다. 예: projects.json의
  // 각 프로젝트가 가리키는 groupId가 실제로 존재하는 그룹인지, journey.json의 projectId가 실제
  // 존재하는(그리고 활성화된) 프로젝트인지 등. 콘텐츠가 여러 개의 독립된 JSON 파일로 쪼개져 있어서
  // DB의 FK 제약 같은 자동 무결성 보장이 없다 — 이 검증 블록이 그 역할을 애플리케이션 레벨에서
  // 대신한다.
  // - [FLOW] 1. 먼저 "유효한 id들의 집합"(groupIds, enabledProjectIds, stackIds 등)을 전부 모아둠
  //   -> 2. 각 파일을 순회하며 그 집합에 없는 참조(addMissingReferenceIssue)나 중복 id
  //   (addDuplicateIssues)를 찾아냄 -> 3. issues 배열에 전부 모은 뒤 마지막에 한꺼번에 판정
  const issues: ContentValidationIssue[] = [];
  const groupIds = new Set(projects.groups.map((group) => group.id));
  const enabledProjectIds = new Set(
    projects.items
      .filter((project) => project.enabled !== false)
      .map((project) => project.id),
  );
  const stackIds = new Set(techStack.map((item) => item.id));
  const tagIds = new Set(
    projects.items
      .filter((project) => project.enabled !== false)
      .flatMap((project) => project.tags),
  );
  const enabledLinkIds = new Set(
    links.flatMap((link) =>
      link.id !== undefined && link.enabled !== false ? [link.id] : [],
    ),
  );

  addDuplicateIssues(
    issues,
    "src/content/projects.json",
    "$.groups",
    "project group id",
    projects.groups.map((group) => group.id),
  );
  addDuplicateIssues(
    issues,
    "src/content/projects.json",
    "$.groups",
    "project group order",
    projects.groups.map((group) => String(group.order)),
  );
  addDuplicateIssues(
    issues,
    "src/content/projects.json",
    "$.metrics",
    "project metric id",
    projects.metrics.map((metric) => metric.id),
  );
  addDuplicateIssues(
    issues,
    "src/content/projects.json",
    "$.items",
    "project id",
    projects.items.map((project) => project.id),
  );
  addDuplicateIssues(
    issues,
    "src/content/projects.json",
    "$.items",
    "project order",
    projects.items.map((project) => project.order),
  );
  addDuplicateIssues(
    issues,
    "src/content/tech-stack.json",
    "$",
    "technology id",
    techStack.map((item) => item.id),
  );
  addDuplicateIssues(
    issues,
    "src/content/links.json",
    "$",
    "link id",
    links.flatMap((link) => (link.id === undefined ? [] : [link.id])),
  );
  addDuplicateIssues(
    issues,
    "src/content/journey-narrative.json",
    "$.milestones",
    "milestone id",
    journeyNarrative.milestones.map((milestone) => milestone.id),
  );
  addDuplicateIssues(
    issues,
    "src/content/interview-map.json",
    "$.tracks",
    "interview track id",
    interviewMap.tracks.map((track) => track.id),
  );
  addDuplicateIssues(
    issues,
    "src/content/curation.json",
    "$.categories",
    "curation category id",
    curation.categories.map((category) => category.id),
  );
  addDuplicateIssues(
    issues,
    "src/content/presentation.json",
    "$.templates",
    "site design id",
    presentation.templates.map((template) => template.id),
  );
  addDuplicateIssues(
    issues,
    "src/content/site.json",
    "$.navigation",
    "navigation href",
    site.navigation.map((item) => item.href),
  );

  if (
    !presentation.templates.some(
      (template) => template.id === presentation.defaultHomeTemplate,
    )
  ) {
    issues.push({
      file: "src/content/presentation.json",
      path: "$.defaultHomeTemplate",
      message: `Default site design "${presentation.defaultHomeTemplate}" is not listed in templates.`,
    });
  }

  presentation.templates.forEach((template, templateIndex) => {
    if (!supportedDesignIds.has(template.id)) {
      issues.push({
        file: "src/content/presentation.json",
        path: `$.templates[${templateIndex}].id`,
        message: `Unsupported site design "${template.id}".`,
      });
    }
  });

  const configuredDesignIds = new Set(
    presentation.templates.map((template) => template.id),
  );
  supportedDesignIdList.forEach((designId) => {
    if (!configuredDesignIds.has(designId)) {
      issues.push({
        file: "src/content/presentation.json",
        path: "$.templates",
        message: `Missing supported site design "${designId}".`,
      });
    }
  });

  site.navigation.forEach((item, index) =>
    addInternalRouteIssue({
      enabledProjectIds,
      file: "src/content/site.json",
      href: item.href,
      issues,
      path: `$.navigation[${index}].href`,
      routeKind: "navigation",
      site,
    }),
  );

  links.forEach((link, index) =>
    addInternalRouteIssue({
      enabledProjectIds,
      file: "src/content/links.json",
      href: link.href,
      issues,
      path: `$[${index}].href`,
      routeKind: "link",
      site,
    }),
  );

  projects.items.forEach((project, projectIndex) => {
    addMissingReferenceIssue(
      issues,
      "src/content/projects.json",
      `$.items[${projectIndex}].groupId`,
      "project group id",
      project.groupId,
      groupIds,
    );

    addDuplicateIssues(
      issues,
      "src/content/projects.json",
      `$.items[${projectIndex}].tags`,
      "project tag",
      project.tags,
    );
    addDuplicateIssues(
      issues,
      "src/content/projects.json",
      `$.items[${projectIndex}].stack`,
      "technology reference",
      project.stack,
    );

    project.stack.forEach((stackId, stackIndex) =>
      addMissingReferenceIssue(
        issues,
        "src/content/projects.json",
        `$.items[${projectIndex}].stack[${stackIndex}]`,
        "technology id",
        stackId,
        stackIds,
      ),
    );

    project.links.forEach((link, linkIndex) =>
      addInternalRouteIssue({
        enabledProjectIds,
        file: "src/content/projects.json",
        href: link.href,
        issues,
        path: `$.items[${projectIndex}].links[${linkIndex}].href`,
        routeKind: "link",
        site,
      }),
    );

  });

  projects.metrics.forEach((metric, metricIndex) => {
    metric.filter?.projectIds?.forEach((projectId, projectIndex) =>
      addMissingReferenceIssue(
        issues,
        "src/content/projects.json",
        `$.metrics[${metricIndex}].filter.projectIds[${projectIndex}]`,
        "project id",
        projectId,
        enabledProjectIds,
      ),
    );
    metric.filter?.groupIds?.forEach((groupId, groupIndex) =>
      addMissingReferenceIssue(
        issues,
        "src/content/projects.json",
        `$.metrics[${metricIndex}].filter.groupIds[${groupIndex}]`,
        "project group id",
        groupId,
        groupIds,
      ),
    );
    metric.filter?.tags?.forEach((tag, tagIndex) =>
      addMissingReferenceIssue(
        issues,
        "src/content/projects.json",
        `$.metrics[${metricIndex}].filter.tags[${tagIndex}]`,
        "project tag",
        tag,
        tagIds,
      ),
    );
  });

  resume.projectIds.forEach((projectId, index) =>
    addMissingReferenceIssue(
      issues,
      "src/content/resume.json",
      `$.projectIds[${index}]`,
      "project id",
      projectId,
      enabledProjectIds,
    ),
  );
  journey.forEach((item, index) => {
    if (item.projectId !== null) {
      addMissingReferenceIssue(
        issues,
        "src/content/journey.json",
        `$[${index}].projectId`,
        "project id",
        item.projectId,
        enabledProjectIds,
      );
    }
  });
  journeyNarrative.milestones.forEach((milestone, milestoneIndex) =>
    milestone.anchorProjectIds.forEach((projectId, projectIndex) =>
      addMissingReferenceIssue(
        issues,
        "src/content/journey-narrative.json",
        `$.milestones[${milestoneIndex}].anchorProjectIds[${projectIndex}]`,
        "project id",
        projectId,
        enabledProjectIds,
      ),
    ),
  );
  interviewMap.tracks.forEach((track, trackIndex) =>
    track.items.forEach((item, itemIndex) =>
      item.answers.forEach((answer, answerIndex) =>
        addMissingReferenceIssue(
          issues,
          "src/content/interview-map.json",
          `$.tracks[${trackIndex}].items[${itemIndex}].answers[${answerIndex}].projectId`,
          "project id",
          answer.projectId,
          enabledProjectIds,
        ),
      ),
    ),
  );
  curation.categories.forEach((category, categoryIndex) =>
    category.projectIds.forEach((projectId, projectIndex) =>
      addMissingReferenceIssue(
        issues,
        "src/content/curation.json",
        `$.categories[${categoryIndex}].projectIds[${projectIndex}]`,
        "project id",
        projectId,
        enabledProjectIds,
      ),
    ),
  );
  contact.preferred.forEach((linkId, index) =>
    addMissingReferenceIssue(
      issues,
      "src/content/contact.json",
      `$.preferred[${index}]`,
      "link id",
      linkId,
      enabledLinkIds,
    ),
  );

  if (issues.length > 0) {
    throw new PortfolioContentError(issues);
  }

  return {
    site,
    profile,
    projects,
    presentation,
    skills,
    techStack,
    experience,
    journey,
    journeyNarrative,
    interviewMap,
    curation,
    links,
    contact,
    resume,
  };
}

// [INTV:ARCH] 모듈 최상위(함수 밖)에서 바로 호출 — 이 모듈이 처음 import되는 순간 모든 JSON 검증이
// 즉시 실행된다. 콘텐츠에 문제가 있으면 앱이 "나중에 그 페이지에 접속했을 때"가 아니라 "시작/빌드하는
// 즉시" 실패하게 만들어, 잘못된 콘텐츠가 운영 환경까지 조용히 넘어가는 걸 막는 설계 — "실패를
// 최대한 이르게, 명확하게 드러낸다"는 원칙을 빌드 파이프라인 레벨에 적용한 것.
export const portfolioSource = loadPortfolioSource();

// [INTV:ARCH] ReturnType<typeof 함수>: 함수의 반환 타입을 별도로 다시 적지 않고 함수 자체에서
// 그대로 추출하는 유틸리티 타입 — loadPortfolioSource의 반환 객체 모양이 바뀌면 이 타입도 자동으로
// 따라간다(별도 인터페이스로 타입을 다시 선언했다면, 함수 구현이 바뀔 때마다 그 인터페이스도 손으로
// 맞춰야 하는 이중 관리 부담이 생긴다).
export type PortfolioSource = ReturnType<typeof loadPortfolioSource>;

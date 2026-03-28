import type { PortfolioSource } from "./content-loader";

// [INTV:ARCH] 이 저장소는 "재사용 가능한 포트폴리오 템플릿"이다 — 누군가 이 코드를 받아 자기
// 정보로 채워 배포하는 걸 전제로 한다. 그래서 콘텐츠 모드가 두 가지: "template"(플레이스홀더 값이
// 남아 있어도 로컬 개발/미리보기는 정상 동작) / "production"(실제 배포 직전엔 "Your Name" 같은
// 견본 문구가 하나라도 남아있으면 빌드를 막는다). Dockerfile의 PORTFOLIO_CONTENT_MODE 빌드 인자가
// 바로 이 값을 결정한다 — 개발 중엔 콘텐츠를 다 채우지 않고도 화면을 확인할 수 있어야 하지만,
// 실제 배포에는 그 유연함이 오히려 "본인 정보를 안 채우고 그대로 배포하는" 사고로 이어질 수 있어
// 두 모드를 분리했다.
export type PortfolioContentMode = "template" | "production";

export type PortfolioReadinessEnvironment = {
  PORTFOLIO_CONTENT_MODE?: string;
  SITE_URL?: string;
};

export type PortfolioReadinessIssue = {
  file: string;
  path: string;
  message: string;
};

// [INTV:ARCH] mode가 "production"일 때만 siteUrl이 항상 채워진다는 걸 타입으로도 표현한 판별
// 유니언 — mode: "template"일 때 siteUrl을 optional(string | undefined)로 그냥 뒀다면, siteUrl을
// 쓰는 쪽 코드가 매번 null 체크를 해야 했을 것이다. 판별 유니언로 "production이면 siteUrl은
// 반드시 URL"이라는 관계를 타입으로 강제해, mode를 체크한 뒤에는 siteUrl 존재가 자동으로 보장된다.
// 아래에서 Extract<PortfolioReadinessResult, { mode: "production" }>로 "production인 경우"만 뽑아
// 쓴다(Extract는 유니언 중 주어진 형태와 겹치는 멤버만 골라내는 유틸리티 타입, view-models.ts의
// RouteViewModel 등과 같은 계열의 기법).
export type PortfolioReadinessResult =
  | { mode: "template"; siteUrl: undefined }
  | { mode: "production"; siteUrl: URL };

type ProductionReadinessResult = Extract<
  PortfolioReadinessResult,
  { mode: "production" }
>;

// [INTV:TRAP] `as const`(각 배열 원소를 넓은 string이 아닌 정확한 리터럴로 고정) + `satisfies`
// (그 결과가 오른쪽 타입 요건에 맞는지 검사만 하고 추론된 리터럴 타입은 유지)를 같이 써서, 이
// 목록이 "PortfolioSource의 실제 키 이름"과 "src/content/*.json 형태의 경로 문자열" 쌍으로만
// 이뤄져 있는지 컴파일 시점에 보장한다 — 키 이름에 오타가 있으면 여기서 바로 타입 에러가 난다.
// `as` 단언으로 재구현하면 이 컴파일 타임 검사 자체가 사라져, 오타가 나도 조용히 통과했다가
// 런타임에야(또는 영영 못 알아채고) 드러난다.
const contentFiles = [
  ["site", "src/content/site.json"],
  ["profile", "src/content/profile.json"],
  ["projects", "src/content/projects.json"],
  ["presentation", "src/content/presentation.json"],
  ["skills", "src/content/skills.json"],
  ["techStack", "src/content/tech-stack.json"],
  ["experience", "src/content/experience.json"],
  ["journey", "src/content/journey.json"],
  ["journeyNarrative", "src/content/journey-narrative.json"],
  ["interviewMap", "src/content/interview-map.json"],
  ["curation", "src/content/curation.json"],
  ["links", "src/content/links.json"],
  ["contact", "src/content/contact.json"],
  ["resume", "src/content/resume.json"],
] as const satisfies ReadonlyArray<
  readonly [keyof PortfolioSource, `src/content/${string}.json`]
>;

// [INTV:EDGE] 템플릿을 내려받은 사람이 실수로 안 고치고 넘어가기 쉬운 "견본 문구"들을 정규식으로
// 등록해둔다 — production 모드 검증 시 콘텐츠 전체를 재귀적으로 훑으며 이 패턴이 하나라도 남아있으면
// 빌드를 실패시킨다(Dockerfile의 `npm run build:verify`가 이 검사를 트리거하는 스크립트).
const placeholderMarkers = [
  { label: "Your Name", pattern: /\byour name\b/i },
  { label: "your-handle", pattern: /\byour-handle\b/i },
  { label: "Your City", pattern: /\byour city\b/i },
  {
    label: "Your Program or Practice",
    pattern: /\byour program(?: or practice)?\b/i,
  },
  { label: "hello@example.com", pattern: /\bhello@example\.com\b/i },
  { label: "Example Project", pattern: /\bexample[- ]project\b/i },
  { label: "placeholder", pattern: /\bplaceholder\b/i },
  { label: "Replace this/the", pattern: /\breplace (?:this|the)\b/i },
  { label: "starter", pattern: /\bstarter\b/i },
] as const;

export class PortfolioReadinessError extends Error {
  readonly issues: PortfolioReadinessIssue[];

  constructor(issues: PortfolioReadinessIssue[]) {
    const details = issues
      .map(({ file, path, message }) => `- ${file}:${path} ${message}`)
      .join("\n");

    super(`Portfolio production readiness failed:\n${details}`);
    this.name = "PortfolioReadinessError";
    this.issues = issues;
  }
}

export function resolvePortfolioContentMode(
  value: string | undefined,
): PortfolioContentMode {
  if (value === undefined || value === "" || value === "template") {
    return "template";
  }

  if (value === "production") {
    return "production";
  }

  throw new Error(
    `PORTFOLIO_CONTENT_MODE must be "template" or "production"; received ${JSON.stringify(value)}.`,
  );
}

// [INTV:ARCH] 에러 메시지에 쓸 "$.foo.bar[3]" 같은 JSONPath 스타일 경로 문자열을 한 단계씩
// 이어붙이는 헬퍼. 키가 평범한 식별자 형태(정규식으로 검사)면 점 표기(.bar)를, 공백이나 특수문자가
// 섞인 키라면 대괄호+따옴표 표기(["weird key"])를 쓴다 — 어느 쪽이든 JS에서 그 경로를 그대로
// 복붙해 접근할 수 있는 형태(에러 메시지를 읽는 사람이 바로 콘솔에서 시도해볼 수 있게 하는 배려).
function appendPath(path: string, key: string | number) {
  if (typeof key === "number") {
    return `${path}[${key}]`;
  }

  return /^[a-zA-Z_$][\w$]*$/.test(key)
    ? `${path}.${key}`
    : `${path}[${JSON.stringify(key)}]`;
}

function findPlaceholderMarker(value: string) {
  return placeholderMarkers.find(({ pattern }) => pattern.test(value));
}

// [INTV:ARCH] 콘텐츠 JSON의 값 하나(문자열/배열/객체 무엇이든)를 받아 재귀적으로 내려가며 모든
// 문자열 값을 검사하는 트리 순회 함수 — 콘텐츠 구조가 얼마나 깊이 중첩돼 있든(content-schema.ts를
// 보면 알 수 있듯 중첩이 상당히 깊다) 이 함수 하나로 전체를 훑을 수 있다. 스키마별로 순회 로직을
// 따로 짜는 대신, 타입 자체(string/array/object)로 분기하는 범용 순회를 택해 스키마가 바뀌어도
// 이 함수를 고칠 필요가 없다.
function collectPlaceholderIssues(
  value: unknown,
  file: string,
  path: string,
  issues: PortfolioReadinessIssue[],
) {
  if (typeof value === "string") {
    const marker = findPlaceholderMarker(value);
    if (marker) {
      issues.push({
        file,
        path,
        message: `Replace the template marker "${marker.label}" with production content.`,
      });
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      collectPlaceholderIssues(item, file, appendPath(path, index), issues),
    );
    return;
  }

  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) =>
      collectPlaceholderIssues(item, file, appendPath(path, key), issues),
    );
  }
}

function addProductionAssetIssue(
  issues: PortfolioReadinessIssue[],
  file: string,
  path: string,
  assetPath: string,
) {
  if (!assetPath.startsWith("/content/")) {
    issues.push({
      file,
      path,
      message: `Use a production asset under public/content instead of "${assetPath}".`,
    });
  }
}

// [INTV:EDGE] example.com/.net/.org와 .example/.invalid/.test 접미사는 IANA(인터넷 주소를 관리하는
// 기구)가 "문서/예제 전용으로 절대 실제 서비스에 쓰이지 않도록" 예약해둔 도메인이다(RFC 2606) —
// 실제 배포용 URL로 쓰이면 안 되는 견본 도메인이 남아있는지 걸러내기 위한 검사(content-loader.ts가
// URL 파서 트릭에 쓰는 .invalid 도메인도 이 RFC가 근거).
function isReservedHostname(hostname: string) {
  return (
    ["example.com", "example.net", "example.org"].some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    ) ||
    [".example", ".invalid", ".test"].some((suffix) =>
      hostname.endsWith(suffix),
    )
  );
}

function parsePublicSiteUrl(
  value: string | undefined,
  issues: PortfolioReadinessIssue[],
) {
  if (!value) {
    issues.push({
      file: "environment",
      path: "SITE_URL",
      message: "SITE_URL is required in production content mode.",
    });
    return undefined;
  }

  // [INTV:EDGE] URL 생성자: 문자열이 유효한 URL 형식인지 파싱하면서 검사하는 표준 웹 API. 형식이
  // 잘못되면 예외를 던지므로 try/catch로 감싸 "유효하지 않은 URL"이라는 결과로 변환한다(정규식으로
  // URL 형식을 직접 검증하는 것보다 표준 파서에 위임하는 편이 엣지 케이스를 더 정확히 잡는다).
  let siteUrl: URL;
  try {
    siteUrl = new URL(value);
  } catch {
    issues.push({
      file: "environment",
      path: "SITE_URL",
      message: "SITE_URL must be an absolute http(s) URL.",
    });
    return undefined;
  }

  const hostname = siteUrl.hostname.toLowerCase();
  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost");

  // [INTV:EDGE] username/password 체크: "https://user:pass@host" 형태로 URL에 인증정보가 박혀
  // 있는 걸 막는다 — 실수로 자격증명이 공개 URL 설정(SITE_URL, 소셜 메타 태그 등으로 노출될 값)에
  // 섞여 들어가는 걸 방지하기 위한 안전장치.
  if (
    !["http:", "https:"].includes(siteUrl.protocol) ||
    isLocal ||
    isReservedHostname(hostname) ||
    siteUrl.username !== "" ||
    siteUrl.password !== ""
  ) {
    issues.push({
      file: "environment",
      path: "SITE_URL",
      message:
        "SITE_URL must use a real public http(s) origin, not a local or placeholder address.",
    });
    return undefined;
  }

  return siteUrl;
}

export function resolveProductionSiteUrl(value: string | undefined) {
  const issues: PortfolioReadinessIssue[] = [];
  const siteUrl = parsePublicSiteUrl(value, issues);

  if (!siteUrl || issues.length > 0) {
    throw new PortfolioReadinessError(issues);
  }

  return siteUrl;
}

function isUsablePublicUrl(href: string) {
  if (findPlaceholderMarker(href)) {
    return false;
  }

  try {
    const url = new URL(href);
    const hostname = url.hostname.toLowerCase();

    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !isReservedHostname(hostname)
    );
  } catch {
    return false;
  }
}

function isUsableContactHref(href: string) {
  if (findPlaceholderMarker(href)) {
    return false;
  }

  return (
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    isUsablePublicUrl(href)
  );
}

export function validateProductionReadiness(
  content: PortfolioSource,
  environment: Pick<PortfolioReadinessEnvironment, "SITE_URL">,
): ProductionReadinessResult {
  const issues: PortfolioReadinessIssue[] = [];
  const siteUrl = parsePublicSiteUrl(environment.SITE_URL, issues);

  for (const [key, file] of contentFiles) {
    collectPlaceholderIssues(content[key], file, "$", issues);
  }

  if (!content.site.socialImage) {
    issues.push({
      file: "src/content/site.json",
      path: "$.socialImage",
      message: "Add a social image under public/content for production.",
    });
  } else {
    addProductionAssetIssue(
      issues,
      "src/content/site.json",
      "$.socialImage",
      content.site.socialImage,
    );
  }

  if (!content.profile.photo) {
    issues.push({
      file: "src/content/profile.json",
      path: "$.photo",
      message: "Add a profile image under public/content for production.",
    });
  } else {
    addProductionAssetIssue(
      issues,
      "src/content/profile.json",
      "$.photo.src",
      content.profile.photo.src,
    );
  }

  if (!content.resume.downloadUrl) {
    issues.push({
      file: "src/content/resume.json",
      path: "$.downloadUrl",
      message: "Add a downloadable resume under public/content for production.",
    });
  } else {
    addProductionAssetIssue(
      issues,
      "src/content/resume.json",
      "$.downloadUrl",
      content.resume.downloadUrl,
    );
  }

  const enabledProjects = content.projects.items.filter(
    (project) => project.enabled !== false,
  );

  if (enabledProjects.length === 0) {
    issues.push({
      file: "src/content/projects.json",
      path: "$.items",
      message: "Enable at least one real project for production.",
    });
  }

  content.projects.items.forEach((project, projectIndex) => {
    if (project.enabled === false) {
      return;
    }

    addProductionAssetIssue(
      issues,
      "src/content/projects.json",
      `$.items[${projectIndex}].screenshot.src`,
      project.screenshot.src,
    );
    project.screenshots.forEach((screenshot, screenshotIndex) =>
      addProductionAssetIssue(
        issues,
        "src/content/projects.json",
        `$.items[${projectIndex}].screenshots[${screenshotIndex}].src`,
        screenshot.src,
      ),
    );

    if (
      !project.links.some(
        (link) => link.enabled !== false && isUsablePublicUrl(link.href),
      )
    ) {
      issues.push({
        file: "src/content/projects.json",
        path: `$.items[${projectIndex}].links`,
        message: "Add at least one enabled public project URL for production.",
      });
    }
  });

  const hasContactMethod = content.links.some(
    (link) =>
      link.enabled !== false &&
      link.placements?.includes("contact") &&
      ["email", "github", "website"].includes(link.type) &&
      isUsableContactHref(link.href),
  );

  if (!hasContactMethod) {
    issues.push({
      file: "src/content/links.json",
      path: "$",
      message: "Enable at least one non-placeholder contact method for production.",
    });
  }

  if (!siteUrl || issues.length > 0) {
    throw new PortfolioReadinessError(issues);
  }

  return { mode: "production", siteUrl };
}

// [INTV:ARCH] 빌드 스크립트가 호출하는 최상위 진입점 — PORTFOLIO_CONTENT_MODE에 따라 "template"이면
// 검증을 건너뛰고, "production"이면 위의 모든 플레이스홀더/자산/연락 수단 체크를 전부 통과해야만
// 빌드가 계속된다(scripts/validate-content-readiness.ts가 이 함수를 호출하는 CLI 진입점).
export function validateBuildReadiness(
  content: PortfolioSource,
  environment: PortfolioReadinessEnvironment,
): PortfolioReadinessResult {
  const mode = resolvePortfolioContentMode(
    environment.PORTFOLIO_CONTENT_MODE,
  );

  if (mode === "template") {
    return { mode, siteUrl: undefined };
  }

  return validateProductionReadiness(content, environment);
}

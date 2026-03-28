import { resolve } from "node:path";

import contactJson from "@/content/contact.json";
import linksJson from "@/content/links.json";
import presentationJson from "@/content/presentation.json";
import projectsJson from "@/content/projects.json";
import resumeJson from "@/content/resume.json";
import siteJson from "@/content/site.json";
import { SITE_DESIGN_IDS } from "@/designs/config";
import { describe, expect, it } from "vitest";

// [INTV:ARCH] 이 파일이 테스트 스위트 전체의 첫 번째로 처리되는 파일이라, vitest 자체의 문법을
// 여기서 한 번에 정리해둔다 — 이후 다른 *.test.ts 파일들에서는 같은 설명을 반복하지 않는다.
// - describe(이름, fn): 관련된 테스트들을 하나의 그룹(스위트)으로 묶는다. 그룹 이름은 보고서에서
//   헤더로 표시됨.
// - it(설명, fn) (test()의 별칭): 테스트 케이스 하나. 설명은 "무엇을 보장하는지"를 문장처럼
//   서술한다.
// - expect(값).toXxx(...): "값이 이러해야 한다"는 단언(assertion). 실패하면 그 시점에 테스트가
//   실패 처리된다.
//   - toBe: 참조/원시값이 정확히 같은지(===) 비교. toEqual: 객체/배열의 내용이 깊게(deep) 같은지
//     비교(참조는 달라도 내용이 같으면 통과) — 아래 "clone boundaries" 테스트가 이 둘의 차이를
//     실제로 검증한다.
//   - expect.objectContaining({...})/arrayContaining([...])/stringContaining("..."): 정확히
//     일치가 아니라 "이 필드들/항목/부분 문자열이 포함되어 있으면 통과"라는 부분 일치 매처 —
//     결과 객체의 다른 필드까지 전부 나열하지 않아도 되게 해준다.
//   - expect.any(Constructor): "이 생성자의 인스턴스이기만 하면 통과"라는 타입 기반 와일드카드
//     매처.
//   - toBeInstanceOf/toThrow/toMatch(정규식)/toHaveLength/toHaveProperty: 각각 인스턴스 여부,
//     예외 발생 여부, 정규식 매칭, 배열/문자열 길이, 특정 속성 존재 여부를 검사.
import * as portfolio from "./portfolio";
import { validatePortfolioAssets } from "./content-assets";
import { loadPortfolioSource, PortfolioContentError } from "./content-loader";
import {
  getFeaturedProjects,
  getPortfolioContent,
  getProjectCardLinks,
  getProjectMetricValue,
  getResumeProjects,
  getTemplateHref,
  isProjectLive,
  resolveContentDebug,
  resolveHomeTemplateId,
  type PortfolioProject,
  type ProjectMetricFilter,
  type SiteDesignId,
} from "./portfolio";

const designIds = [
  "design",
  "classic",
  "editorial",
  "brutalist",
  "cinematic",
] as const satisfies readonly SiteDesignId[];

function projectMatchesFilter(
  project: PortfolioProject,
  filter: ProjectMetricFilter | undefined,
) {
  if (!filter) return true;

  return (
    (!filter.projectIds || filter.projectIds.includes(project.id)) &&
    (!filter.groupIds || filter.groupIds.includes(project.groupId)) &&
    (!filter.tags || filter.tags.every((tag) => project.tags.includes(tag))) &&
    (filter.featured === undefined ||
      Boolean(project.featured) === filter.featured) &&
    (!filter.deploymentStatuses ||
      filter.deploymentStatuses.includes(project.deployment.status))
  );
}

// [INTV:ARCH] 여러 테스트가 "이 함수를 호출하면 PortfolioContentError를 던져야 한다"를
// 검증해야 하는데, 매번 try/catch를 직접 쓰는 대신 이 헬퍼로 공통화했다 — 예외를 잡아 타입까지
// 확인한 뒤 그대로 돌려줘서, 호출하는 쪽에서 error.issues 같은 세부 필드를 이어서 검사할 수
// 있게 한다.
function captureContentError(run: () => unknown) {
  let caught: unknown;

  try {
    run();
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(PortfolioContentError);
  return caught as PortfolioContentError;
}

describe("portfolio content", () => {
  // [INTV:EDGE] "public module surface"(공개 API 표면) 테스트: lib/portfolio.ts(배럴 파일)가
  // 실제로 내보내는 이름 목록을 하드코딩된 목록과 비교한다 — 누군가 실수로 export를
  // 지우거나(다른 곳에서 쓰이는 함수가 조용히 사라짐) 의도치 않게 새 export를 추가하면 이
  // 테스트가 바로 실패해서 "공개 API가 바뀌었다"는 걸 알아챌 수 있다.
  it("preserves the public module surface and clone boundaries", () => {
    expect(Object.keys(portfolio).sort()).toEqual(
      [
        "getContentLinksByPlacement",
        "getEnabledLinks",
        "getExternalLinkProps",
        "getFeaturedProjects",
        "getPortfolioContent",
        "getPreferredContactLinks",
        "getProjectById",
        "getProjectCardLinks",
        "getProjectDetailLinks",
        "getProjectLink",
        "getProjectLinksForPlacement",
        "getProjectMetricValue",
        "getResumeProjects",
        "getTemplateHref",
        "isProjectLive",
        "isSitePageEnabled",
        "resolveContentDebug",
        "resolveHomeTemplateId",
        "resolveTechStackItem",
      ].sort(),
    );

    // [INTV:EDGE] "clone boundaries"(복제 경계) 검증: getPortfolioContent()를 두 번 호출한
    // 결과에서, 매 호출마다 새로 filter/map되는 배열들(projects, projects[0].links, links —
    // content.ts의 getPortfolioContent 안에서 .filter().map()으로 다시 만들어지는 부분)은 서로
    // 다른 참조(not.toBe)여야 하고, 모듈 로드 시 한 번만 만들어져 그대로 재사용되는 필드들(site,
    // profile, presentation, journey)은 같은 참조(toBe)를 유지해야 한다는 걸 확인한다 — "어디까지가
    // 매번 새로 계산되고 어디부터는 캐시되어 공유되는지"라는, 코드만 봐서는 알기 어려운 내부 구현
    // 세부사항을 테스트로 명문화해둔 것.
    const first = getPortfolioContent();
    const second = getPortfolioContent();

    expect(first).not.toBe(second);
    expect(first.projects).not.toBe(second.projects);
    expect(first.projects[0]).not.toBe(second.projects[0]);
    expect(first.projects[0].links).not.toBe(second.projects[0].links);
    expect(first.links).not.toBe(second.links);
    expect(first.site).toBe(second.site);
    expect(first.profile).toBe(second.profile);
    expect(first.presentation).toBe(second.presentation);
    expect(first.journey).toBe(second.journey);
  });

  it("loads and derives the reusable projects content model", () => {
    const source = validatePortfolioAssets(
      loadPortfolioSource(),
      resolve(process.cwd(), "public"),
    );
    const content = getPortfolioContent();
    const sourceGroups = new Map(
      source.projects.groups.map((group) => [group.id, group]),
    );

    expect(source.projects.groups.length).toBeGreaterThan(0);
    expect(source.projects.metrics.length).toBeGreaterThan(0);
    expect(source.projects.items.length).toBeGreaterThan(0);
    expect(new Set(source.projects.groups.map((group) => group.id)).size).toBe(
      source.projects.groups.length,
    );
    expect(new Set(source.projects.metrics.map((metric) => metric.id)).size).toBe(
      source.projects.metrics.length,
    );
    expect(new Set(source.projects.items.map((project) => project.id)).size).toBe(
      source.projects.items.length,
    );

    expect(content.projectGroups.map((group) => group.order)).toEqual(
      [...content.projectGroups.map((group) => group.order)].sort(
        (left, right) => left - right,
      ),
    );
    for (const project of content.projects) {
      expect(project.category).toBe(sourceGroups.get(project.groupId)?.label);
      expect(project.tags.length).toBeGreaterThan(0);
    }
  });

  it("exposes the complete five-design contract with editorial as the default", () => {
    const { presentation } = getPortfolioContent();

    expect(presentation.defaultHomeTemplate).toBe("editorial");
    expect(presentation.templates.map((template) => template.id)).toEqual(
      designIds,
    );
    expect(SITE_DESIGN_IDS).toEqual(designIds);

    const configurableSectionOrders = [
      presentation.home.editorial.sections,
      presentation.home.brutalist.sections,
      presentation.home.cinematic.sections,
    ];

    for (const sections of configurableSectionOrders) {
      expect(sections.length).toBeGreaterThan(0);
      expect(new Set(sections).size).toBe(sections.length);
    }

    expect(presentation.ui.skipLinkLabel).toMatch(/\S/);
    expect(presentation.ui.emptyStates.projectDetails).toMatch(/\S/);
  });

  it("keeps mutable assets in the documented content boundaries", () => {
    const content = getPortfolioContent();
    const assetPaths = [
      content.profile.photo?.src,
      content.resume.downloadUrl,
      ...content.projects.flatMap((project) => [
        project.screenshot.src,
        ...project.screenshots.map((image) => image.src),
      ]),
    ].filter((path): path is string => Boolean(path));

    expect(assetPaths.length).toBeGreaterThan(0);
    for (const path of assetPaths) {
      expect(path).toMatch(/^\/(?:content|template)\//);
    }

    expect(
      getPortfolioContent({
        NEXT_PUBLIC_DASHBOARD_URL: "https://environment-specific.example",
      }),
    ).toEqual(content);
  });

  it("reports missing assets with the source file and JSON path", () => {
    let caught: unknown;

    try {
      validatePortfolioAssets(
        loadPortfolioSource(),
        resolve(process.cwd(), ".missing-public-root"),
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(PortfolioContentError);
    const contentError = caught as PortfolioContentError;
    expect(contentError.issues.length).toBeGreaterThan(0);
    expect(
      contentError.issues.some(
        (issue) =>
          issue.file.startsWith("src/content/") &&
          issue.path.startsWith("$.") &&
          issue.message.includes("does not exist under public/"),
      ),
    ).toBe(true);
    expect(contentError.message).toContain("Portfolio content validation failed");
  });

  // [INTV:TRAP] structuredClone: 객체를 깊은 복사(deep copy)하는 표준 내장 함수 — import된
  // projectsJson 등은 여러 테스트가 공유하는 하나의 모듈 싱글턴이라, 여기서 직접 값을 바꾸면 그
  // 변경이 다른 테스트에도 새어나가 버린다(테스트 실행 순서에 따라 결과가 달라지는 flaky 테스트의
  // 흔한 원인). 그래서 항상 복제본을 만들어 마음껏 망가뜨린 뒤(중복 id를 추가하는 등)
  // loadPortfolioSource에 overrides로 주입해, "잘못된 콘텐츠를 주면 정확히 이런 에러가 나야
  // 한다"를 검증한다.
  it("rejects duplicate IDs, missing designs, and unsupported navigation", () => {
    const projects = structuredClone(projectsJson);
    projects.items.push(structuredClone(projects.items[0]));
    const presentation = structuredClone(presentationJson);
    presentation.templates = presentation.templates.slice(0, -1);
    const site = structuredClone(siteJson);
    site.navigation.push({ label: "Unknown", href: "/not-a-route" });

    const error = captureContentError(() =>
      loadPortfolioSource({ projects, presentation, site }),
    );

    expect(error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "src/content/projects.json",
          message: expect.stringContaining("Duplicate project id"),
        }),
        expect.objectContaining({
          file: "src/content/presentation.json",
          message: expect.stringContaining("Missing supported site design"),
        }),
        expect.objectContaining({
          file: "src/content/site.json",
          message: expect.stringContaining("Unsupported internal navigation route"),
        }),
      ]),
    );
  });

  it("rejects navigation and references to disabled content", () => {
    const projects = structuredClone(projectsJson);
    const disabledProjectId = projects.items[0].id;
    projects.items[0].enabled = false;
    const resume = structuredClone(resumeJson);
    resume.projectIds = [disabledProjectId];

    const links = structuredClone(linksJson);
    const preferredLink = links.find((link) => link.id !== undefined);
    expect(preferredLink?.id).toBeDefined();
    if (!preferredLink?.id) return;
    preferredLink.enabled = false;
    const contact = structuredClone(contactJson);
    contact.preferred = [preferredLink.id];

    const site = structuredClone(siteJson);
    site.pages.projects = false;

    const error = captureContentError(() =>
      loadPortfolioSource({ contact, links, projects, resume, site }),
    );

    expect(error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: expect.stringContaining("navigation"),
          message: expect.stringContaining("disabled page"),
        }),
        expect.objectContaining({
          file: "src/content/resume.json",
          message: expect.stringContaining(disabledProjectId),
        }),
        expect.objectContaining({
          file: "src/content/contact.json",
          message: expect.stringContaining(preferredLink.id),
        }),
      ]),
    );
  });

  it("rejects unsupported internal links and missing project routes", () => {
    const links = structuredClone(linksJson);
    links[0].href = "/not-a-route";
    links[0].external = false;

    const projects = structuredClone(projectsJson);
    const projectWithLinks = projects.items.find(
      (project) => project.links.length > 0,
    );
    expect(projectWithLinks).toBeDefined();
    if (!projectWithLinks) return;
    projectWithLinks.links[0].href = "/projects/not-a-project";
    projectWithLinks.links[0].external = false;

    const error = captureContentError(() =>
      loadPortfolioSource({ links, projects }),
    );

    expect(error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "src/content/links.json",
          message: expect.stringContaining("Unsupported internal link route"),
        }),
        expect.objectContaining({
          file: "src/content/projects.json",
          message: expect.stringContaining("unknown or disabled project"),
        }),
      ]),
    );
  });

  it("computes every declared metric from generic filters", () => {
    const content = getPortfolioContent();

    for (const metric of content.projectMetrics) {
      const matchingProjects = content.projects.filter((project) =>
        projectMatchesFilter(project, metric.filter),
      );
      const expectedValue =
        metric.aggregate === "highlights"
          ? matchingProjects.reduce(
              (total, project) => total + project.highlights.length,
              0,
            )
          : matchingProjects.length;

      expect(getProjectMetricValue(metric.id, content)).toBe(expectedValue);
    }

    expect(getProjectMetricValue("not-a-declared-metric", content)).toBe(0);
  });

  it("selects featured, resume, and card links from content flags", () => {
    const content = getPortfolioContent();
    const expectedResumeIds = content.resume.projectIds.filter((projectId) =>
      content.projects.some((project) => project.id === projectId),
    );

    expect(getFeaturedProjects(content)).toEqual(
      content.projects.filter((project) => project.featured),
    );
    expect(getResumeProjects(content).map((project) => project.id)).toEqual(
      expectedResumeIds,
    );

    for (const project of content.projects) {
      const hasEnabledDemo = project.links.some(
        (link) => link.type === "demo" && link.enabled !== false,
      );
      expect(isProjectLive(project)).toBe(
        project.deployment.status === "live" && hasEnabledDemo,
      );
      expect(getProjectCardLinks(project).every((link) =>
        link.placements?.includes("card"),
      )).toBe(true);
      expect(
        getProjectCardLinks(project).some((link) => link.type === "demo"),
      ).toBe(isProjectLive(project) && project.links.some(
        (link) => link.type === "demo" && link.placements?.includes("card"),
      ));
    }
  });

  it("keeps journey entries chronological without assuming owner copy", () => {
    const { journey } = getPortfolioContent();
    const dates = journey.map((item) => item.date);

    expect(dates).toEqual([...dates].sort());
  });

  it("resolves all supported designs and falls back to editorial", () => {
    const { presentation } = getPortfolioContent();

    for (const designId of designIds) {
      expect(resolveHomeTemplateId(designId, presentation)).toBe(designId);
      expect(resolveHomeTemplateId([designId], presentation)).toBe(designId);
    }

    expect(resolveHomeTemplateId("missing", presentation)).toBe("editorial");
    expect(resolveHomeTemplateId(undefined, presentation)).toBe("editorial");
    expect(resolveContentDebug("content")).toBe(true);
    expect(resolveContentDebug(["content"])).toBe(true);
    expect(resolveContentDebug("off")).toBe(false);
  });

  it("propagates designs and debug state on internal links only", () => {
    for (const designId of designIds) {
      expect(getTemplateHref("/projects", designId)).toBe(
        designId === "editorial"
          ? "/projects"
          : `/projects?view=${designId}`,
      );
    }

    expect(getTemplateHref("/projects?page=2#featured", "cinematic")).toBe(
      "/projects?page=2&view=cinematic#featured",
    );
    expect(getTemplateHref("/projects?view=classic", "editorial")).toBe(
      "/projects",
    );
    expect(
      getTemplateHref("/", "editorial", { alwaysInclude: true }),
    ).toBe("/?view=editorial");
    expect(
      getTemplateHref("/projects", "brutalist", { contentDebug: true }),
    ).toBe("/projects?view=brutalist&debug=content");
    expect(getTemplateHref("https://example.com", "classic")).toBe(
      "https://example.com",
    );
    expect(getTemplateHref("//example.com/project", "classic")).toBe(
      "//example.com/project",
    );
  });
});

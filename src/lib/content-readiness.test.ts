// vitest 기본 문법은 lib/portfolio.test.ts 상단 주석 참고.
import { loadPortfolioSource } from "@/lib/content-loader";
import { describe, expect, it } from "vitest";

import {
  PortfolioReadinessError,
  resolvePortfolioContentMode,
  validateBuildReadiness,
  validateProductionReadiness,
} from "./content-readiness";

function captureReadinessError(run: () => unknown) {
  let caught: unknown;

  try {
    run();
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(PortfolioReadinessError);
  return caught as PortfolioReadinessError;
}

// [INTV:ARCH] content-readiness.ts의 placeholderMarkers가 잡아내는 "견본 문구"들을 전부
// 그럴듯한 실제 값으로 치환하는 테스트 전용 헬퍼 — 이 저장소에 실제로 커밋된 콘텐츠(template
// 상태 그대로)만으로는 production 검증을 통과할 수 없으므로, "production 모드에서 실제로
// 통과하는 콘텐츠는 이런 모양이다"를 테스트 안에서 직접 만들어내기 위한 것. 재귀적으로 모든
// 문자열/배열/객체를 훑는 구조는 content-readiness.ts의 collectPlaceholderIssues와 같은 패턴.
function replaceTemplateMarkers(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replaceAll("Your Name", "Portfolio Owner")
      .replaceAll("your-handle", "portfolio-owner")
      .replaceAll("Your City", "Seoul")
      .replaceAll("Your Program or Practice", "Software Engineering Program")
      .replaceAll("hello@example.com", "owner@portfolio.dev")
      .replaceAll("Example Project", "Realtime Collaboration Project")
      .replaceAll("example-project", "realtime-collaboration")
      .replaceAll("placeholder", "preview")
      .replaceAll("Placeholder", "Preview")
      .replaceAll("starter", "published")
      .replaceAll("Replace this", "This section contains")
      .replaceAll("Replace the", "Update the")
      .replace("/template/", "/content/");
  }

  if (Array.isArray(value)) {
    return value.map(replaceTemplateMarkers);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        replaceTemplateMarkers(item),
      ]),
    );
  }

  return value;
}

// [INTV:ARCH] 위 replaceTemplateMarkers로 문구를 치환한 뒤, zod 스키마 검증(assetPath 형식
// 등)까지 통과하도록 이미지/다운로드 경로나 프로젝트 링크 같은 필드도 실제 값처럼 보이게 채워
// 넣어 "완전히 준비된" 콘텐츠를 만든다.
function createProductionReadyContent() {
  const content = replaceTemplateMarkers(
    structuredClone(loadPortfolioSource()),
  ) as ReturnType<typeof loadPortfolioSource>;

  content.site.socialImage = "/content/social-card.png";
  content.profile.photo = {
    src: "/content/profile/portrait.png",
    alt: "Portfolio Owner portrait",
  };
  content.resume.downloadUrl = "/content/resume/portfolio-owner.pdf";
  content.projects.items[0].links[0] = {
    ...content.projects.items[0].links[0],
    enabled: true,
    href: "https://github.com/portfolio-owner/realtime-collaboration",
    label: "Source",
  };

  return content;
}

describe("portfolio production readiness", () => {
  it("defaults to template mode and rejects unsupported values", () => {
    expect(resolvePortfolioContentMode(undefined)).toBe("template");
    expect(resolvePortfolioContentMode("template")).toBe("template");
    expect(resolvePortfolioContentMode("production")).toBe("production");

    expect(() => resolvePortfolioContentMode("preview")).toThrow(
      /PORTFOLIO_CONTENT_MODE.*template.*production/,
    );
  });

  it("allows the checked-in placeholders in template mode", () => {
    const result = validateBuildReadiness(loadPortfolioSource(), {
      PORTFOLIO_CONTENT_MODE: "template",
    });

    expect(result).toEqual({ mode: "template", siteUrl: undefined });
  });

  it("reports every production input category without masking later issues", () => {
    const error = captureReadinessError(() =>
      validateBuildReadiness(loadPortfolioSource(), {
        PORTFOLIO_CONTENT_MODE: "production",
      }),
    );

    expect(error.message).toContain("Portfolio production readiness failed");
    expect(error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "SITE_URL" }),
        expect.objectContaining({ path: "$.socialImage" }),
        expect.objectContaining({ path: "$.name" }),
        expect.objectContaining({ path: "$.photo.src" }),
        expect.objectContaining({ path: "$[0].href" }),
        expect.objectContaining({ path: "$.downloadUrl" }),
        expect.objectContaining({
          path: "$.items[0].screenshot.src",
        }),
        expect.objectContaining({ path: "$.items[0].links" }),
      ]),
    );
  });

  it("accepts complete content and a valid public site URL", () => {
    const content = createProductionReadyContent();

    expect(
      validateProductionReadiness(content, {
        SITE_URL: "https://portfolio.example.dev",
      }),
    ).toEqual({
      mode: "production",
      siteUrl: new URL("https://portfolio.example.dev"),
    });
  });

  it("rejects local and malformed production site URLs", () => {
    for (const siteUrl of [
      "not-a-url",
      "ftp://portfolio.example.dev",
      "http://localhost:3100",
      "https://example.com",
    ]) {
      const error = captureReadinessError(() =>
        validateProductionReadiness(createProductionReadyContent(), {
          SITE_URL: siteUrl,
        }),
      );

      expect(error.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: "SITE_URL" })]),
      );
    }
  });
});

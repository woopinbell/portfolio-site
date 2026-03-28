// vitest 기본 문법은 lib/portfolio.test.ts 상단 주석 참고.
import siteJson from "@/content/site.json";
import { describe, expect, it } from "vitest";

import { getPortfolioContent } from "./portfolio";
import {
  createPortfolioMetadata,
  createProjectStructuredData,
  createRobots,
  createRouteMetadata,
  createSiteStructuredData,
  createSitemap,
  serializeStructuredData,
} from "./site-metadata";

describe("site indexing metadata", () => {
  it("keeps template sites out of search results", () => {
    const metadata = createPortfolioMetadata({
      mode: "template",
      metadataBase: new URL("http://localhost:3100"),
      site: siteJson,
    });

    expect(metadata.robots).toEqual({ follow: false, index: false });
    expect(createRobots({ mode: "template" })).toEqual({
      rules: { disallow: "/", userAgent: "*" },
    });
  });

  it("indexes a production site from its configured canonical origin", () => {
    const metadataBase = new URL("https://portfolio.example.dev");
    const metadata = createPortfolioMetadata({
      mode: "production",
      metadataBase,
      site: { ...siteJson, socialImage: "/content/social-card.png" },
    });

    expect(metadata.metadataBase).toEqual(metadataBase);
    expect(metadata.alternates).toEqual({ canonical: "/" });
    expect(metadata.robots).toEqual({ follow: true, index: true });
    expect(metadata.openGraph).toEqual(
      expect.objectContaining({
        images: [{ url: "https://portfolio.example.dev/content/social-card.png" }],
      }),
    );
    expect(
      createRobots({ mode: "production", siteUrl: metadataBase }),
    ).toEqual({
      host: "https://portfolio.example.dev",
      rules: { allow: "/", userAgent: "*" },
      sitemap: "https://portfolio.example.dev/sitemap.xml",
    });
  });
});

describe("route metadata", () => {
  it("uses route content while keeping a query-free canonical path", () => {
    const metadata = createRouteMetadata({
      description: "A chronological view of the work.",
      path: "/journey",
      site: siteJson,
      title: "Journey",
    });

    expect(metadata).toEqual(
      expect.objectContaining({
        alternates: { canonical: "/journey" },
        description: "A chronological view of the work.",
        title: "Journey | Your Name",
      }),
    );
    expect(metadata.openGraph).toEqual(
      expect.objectContaining({
        description: "A chronological view of the work.",
        title: "Journey | Your Name",
        url: "/journey",
      }),
    );
  });
});

describe("sitemap", () => {
  it("does not publish template routes", () => {
    expect(
      createSitemap({
        content: getPortfolioContent(),
        mode: "template",
      }),
    ).toEqual([]);
  });

  it("lists enabled pages and project details from the production site URL", () => {
    const content = getPortfolioContent();
    if (!content.site.pages) {
      throw new Error("Sitemap test requires explicit page availability.");
    }
    // [INTV:EDGE] content.site.pages를 그대로 쓰지 않고 interviewMap만 false로 덮어써서 전달한다
    // — 이렇게 하면 "sitemap이 비활성화된 페이지를 실제로 제외하는가"를 현재 콘텐츠 설정값에
    // 의존하지 않고 항상 같은 방식으로 검증할 수 있다(interviewMap이 site.json에서 기본적으로
    // true든 false든 이 테스트의 통과 여부가 달라지지 않는다).
    const sitemap = createSitemap({
      content: {
        ...content,
        site: {
          ...content.site,
          pages: { ...content.site.pages, interviewMap: false },
        },
      },
      mode: "production",
      siteUrl: new URL("https://portfolio.example.dev"),
    });

    expect(sitemap.map(({ url }) => url)).toEqual([
      "https://portfolio.example.dev/",
      "https://portfolio.example.dev/projects",
      `https://portfolio.example.dev/projects/${content.projects[0]?.id}`,
      "https://portfolio.example.dev/about",
      "https://portfolio.example.dev/resume",
      "https://portfolio.example.dev/contact",
      "https://portfolio.example.dev/journey",
    ]);
  });
});

describe("structured data", () => {
  it("builds Person and WebSite records only from validated content", () => {
    const content = getPortfolioContent();
    const structuredData = createSiteStructuredData({
      content,
      siteUrl: new URL("https://portfolio.example.dev"),
    });

    expect(structuredData["@graph"]).toEqual([
      expect.objectContaining({
        "@id": "https://portfolio.example.dev/#person",
        "@type": "Person",
        description: content.profile.summary,
        name: content.profile.name,
      }),
      expect.objectContaining({
        "@id": "https://portfolio.example.dev/#website",
        "@type": "WebSite",
        description: content.site.description,
        name: content.site.brand,
      }),
    ]);
  });

  it("builds a project CreativeWork record without adding unsupported claims", () => {
    const content = getPortfolioContent();
    const project = content.projects[0];
    if (!project) throw new Error("Structured data test requires a project.");

    const structuredData = createProjectStructuredData({
      content,
      project,
      siteUrl: new URL("https://portfolio.example.dev"),
    });

    expect(structuredData).toEqual(
      expect.objectContaining({
        "@id": `https://portfolio.example.dev/projects/${project.id}#creative-work`,
        "@type": "CreativeWork",
        description: project.summary,
        name: project.title,
        url: `https://portfolio.example.dev/projects/${project.id}`,
      }),
    );
    expect(structuredData).not.toHaveProperty("award");
    expect(structuredData).not.toHaveProperty("aggregateRating");
  });

  // [INTV:EDGE] site-metadata.ts가 <, >, & 를 \uXXXX로 이스케이프하는 XSS 방어 로직의 핵심
  // 회귀 테스트 — "</script>" 라는 값이 JSON.stringify만 거쳐 dangerouslySetInnerHTML에 그대로
  // 박히면 실제 <script> 태그를 조기 종료시켜 뒤에 오는 내용을 임의 실행 가능한 마크업으로 만들 수
  // 있는데(스크립트 태그 브레이크아웃), 그 문자열이 유니코드 이스케이프 형태로 안전하게 바뀌는지만
  // 확인하면 충분하므로 전체 JSON-LD 구조가 아니라 이 좁은 입력 하나로 검증을 압축했다.
  it("escapes markup-significant characters before embedding JSON-LD", () => {
    expect(serializeStructuredData({ value: "</script>" })).toContain(
      "\\u003c/script\\u003e",
    );
  });
});

import type { Metadata, MetadataRoute } from "next";

import type { PortfolioSource } from "./content-loader";
import type { PortfolioContentMode } from "./content-readiness";
import type { PortfolioContent, PortfolioProject } from "./portfolio";

// [INTV:ARCH] 이 파일은 검색엔진/소셜 공유와 관련된 모든 메타데이터 생성 로직을 한곳에 모아둔 것 —
// 거의 모든 src/app 하위 page.tsx, layout.tsx, robots.ts, sitemap.ts, structured-data.tsx가 이
// 파일의 함수를 가져다 쓴다. Metadata / MetadataRoute.Robots / MetadataRoute.Sitemap: Next.js가
// 정의한 전용 타입으로, 이 타입에 맞는 객체를 반환하면 Next가 알아서 <head> 태그나 /robots.txt,
// /sitemap.xml 응답으로 바꿔준다(직접 XML/메타 태그 문자열을 조립할 필요가 없다).
type SiteContent = PortfolioSource["site"];

type RouteMetadataInput = {
  description: string;
  path: `/${string}` | "/";
  site: SiteContent;
  title: string;
  type?: "article" | "website";
};

type StructuredData = Record<string, unknown>;

function absoluteSiteUrl(path: string, siteUrl: URL) {
  return new URL(path, siteUrl.origin).toString();
}

// [INTV:ARCH] 홈("/")만 사이트 전체 타이틀을 그대로 쓰고, 나머지 페이지는 "페이지 제목 | 브랜드명"
// 형태로 조합한다 — 브라우저 탭/검색결과에 표시되는 제목 규칙을 한 곳에서 통일해둔 것(각 페이지가
// 직접 `${title} | ${brand}`를 조립하면, 표기 규칙이 바뀔 때마다 모든 페이지를 손대야 한다).
function routeTitle(path: string, title: string, site: SiteContent) {
  return path === "/" ? site.title : `${title} | ${site.brand}`;
}

// [INTV:ARCH] layout.tsx의 generateMetadata가 호출하는, 사이트 전역(홈 기본값) 메타데이터.
// openGraph/twitter 필드는 카카오톡·트위터(X)·슬랙 등에 링크를 공유했을 때 미리보기 카드에 쓰이는
// 정보를 정의하는 표준(Open Graph 프로토콜 / Twitter Card) — 일반적인 <title> 태그보다 한 단계
// 더 나아가 "이 링크가 다른 사이트에 공유됐을 때 어떻게 보일지"까지 제어하는 SEO/소셜 도메인
// 지식이다.
export function createPortfolioMetadata({
  metadataBase,
  mode,
  site,
}: {
  metadataBase: URL;
  mode: PortfolioContentMode;
  site: SiteContent;
}): Metadata {
  const socialImage = site.socialImage
    ? new URL(site.socialImage, metadataBase).toString()
    : undefined;
  // [INTV:EDGE] content-readiness.ts에서 설명한 "template vs production" 모드가 여기서 실제로
  // 쓰인다 — 아직 실제 콘텐츠로 채워지지 않은 template 모드에서는 검색엔진이 이 사이트를 색인하지
  // 못하도록 robots에서 막는다(예제/미완성 페이지가 구글 검색 결과에 노출되는 걸 방지 — 콘텐츠
  // 검증(content-readiness)과 검색엔진 노출 차단(robots)이 같은 모드 값 하나로 일관되게 연동된다).
  const shouldIndex = mode === "production";

  return {
    alternates: { canonical: "/" },
    description: site.description,
    metadataBase,
    openGraph: {
      description: site.description,
      images: socialImage ? [{ url: socialImage }] : undefined,
      title: site.title,
      type: "website",
      url: "/",
    },
    robots: { follow: shouldIndex, index: shouldIndex },
    title: site.title,
    twitter: {
      card: "summary_large_image",
      description: site.description,
      images: socialImage ? [socialImage] : undefined,
      title: site.title,
    },
  };
}

// [INTV:EDGE] 각 라우트(about, projects 등)의 generateMetadata가 호출하는 페이지별 버전 —
// createPortfolioMetadata와 거의 같은 구조를 페이지 단위로 재사용한다. alternates.canonical: 같은
// 콘텐츠가 여러 URL(예: ?view= 쿼리가 붙은 테마 전환 URL, template-href.ts 참고)로 접근 가능할 때,
// 검색엔진에게 "정식 대표 URL은 이거다"라고 알려주는 SEO 태그 — 그래서 테마 전환 쿼리스트링이
// 붙어도 canonical은 항상 쿼리 없는 깨끗한 path를 가리킨다. 이게 없으면 검색엔진이 같은 콘텐츠를
// 여러 URL 변형으로 각각 색인해(중복 콘텐츠) 검색 순위가 흩어질 수 있다.
export function createRouteMetadata({
  description,
  path,
  site,
  title,
  type = "website",
}: RouteMetadataInput): Metadata {
  const resolvedTitle = routeTitle(path, title, site);
  const images = site.socialImage
    ? [{ alt: site.title, url: site.socialImage }]
    : undefined;

  return {
    alternates: { canonical: path },
    description,
    openGraph: {
      description,
      images,
      title: resolvedTitle,
      type,
      url: path,
    },
    title: resolvedTitle,
    twitter: {
      card: "summary_large_image",
      description,
      images: site.socialImage ? [site.socialImage] : undefined,
      title: resolvedTitle,
    },
  };
}

// [INTV:ARCH] src/app/robots.ts가 그대로 호출해 /robots.txt 응답을 만든다. template 모드에서는
// 아직 실제 서비스가 아니므로 크롤러 전체를 차단(disallow "/")하고, production 모드에서만 실제
// 사이트맵 위치를 알려주며 허용한다.
export function createRobots({
  mode,
  siteUrl,
}: {
  mode: PortfolioContentMode;
  siteUrl?: URL;
}): MetadataRoute.Robots {
  if (mode === "template") {
    return { rules: { disallow: "/", userAgent: "*" } };
  }

  if (!siteUrl) {
    throw new Error("A production site URL is required to create robots.txt.");
  }

  return {
    host: siteUrl.origin,
    rules: { allow: "/", userAgent: "*" },
    sitemap: absoluteSiteUrl("/sitemap.xml", siteUrl),
  };
}

// [INTV:ARCH] src/app/sitemap.ts가 그대로 호출해 /sitemap.xml 응답을 만든다. 사이트맵은
// 검색엔진에게 "이 사이트에 이런 페이지들이 있다"고 목록을 미리 알려주는 파일 — 활성화된
// 페이지(isSitePageEnabled와 같은 site.pages 플래그)만 골라 넣고, 프로젝트 상세 페이지들은 목록에서
// 동적으로 전부 펼쳐 추가한다(비활성화된 페이지가 사이트맵에 남아있으면 검색엔진이 그 URL을
// 색인하려다 404를 만나게 된다).
export function createSitemap({
  content,
  mode,
  siteUrl,
}: {
  content: PortfolioContent;
  mode: PortfolioContentMode;
  siteUrl?: URL;
}): MetadataRoute.Sitemap {
  if (mode === "template") {
    return [];
  }

  if (!siteUrl) {
    throw new Error("A production site URL is required to create sitemap.xml.");
  }

  const routes = ["/"];
  const pages = content.site.pages;

  if (pages?.projects !== false) {
    routes.push("/projects");
    routes.push(...content.projects.map(({ id }) => `/projects/${id}`));
  }
  if (pages?.about !== false) routes.push("/about");
  if (pages?.resume !== false) routes.push("/resume");
  if (pages?.contact !== false) routes.push("/contact");
  if (pages?.journey !== false) routes.push("/journey");
  if (pages?.interviewMap !== false) routes.push("/interview-map");

  return routes.map((path) => ({ url: absoluteSiteUrl(path, siteUrl) }));
}

// [INTV:ARCH] JSON-LD(schema.org) 구조화 데이터: 검색엔진이 "이 페이지가 사람에 대한 정보다",
// "이 사이트의 저자는 누구다" 같은 걸 기계적으로 이해하도록 <script type="application/ld+json">에
// 심는 표준 형식. "@id"로 이 사이트의 Person과 WebSite 각각에 고유 식별자를 부여하고, WebSite의
// author가 그 Person의 "@id"를 참조하게 해서 — 두 개체가 서로 연결된 그래프(@graph)로 표현된다
// (createProjectStructuredData도 같은 personId를 author로 참조해, 사이트 전체의 Person 엔티티
// 하나에 여러 페이지의 구조화 데이터가 연결된다).
export function createSiteStructuredData({
  content,
  siteUrl,
}: {
  content: PortfolioContent;
  siteUrl: URL;
}): StructuredData {
  const personId = absoluteSiteUrl("/#person", siteUrl);
  const websiteId = absoluteSiteUrl("/#website", siteUrl);

  const person: StructuredData = {
    "@id": personId,
    "@type": "Person",
    description: content.profile.summary,
    jobTitle: content.profile.role,
    name: content.profile.name,
    url: absoluteSiteUrl("/", siteUrl),
  };

  if (content.profile.koreanName) {
    person.alternateName = content.profile.koreanName;
  }
  if (content.profile.photo) {
    person.image = absoluteSiteUrl(content.profile.photo.src, siteUrl);
  }

  return {
    "@context": "https://schema.org",
    "@graph": [
      person,
      {
        "@id": websiteId,
        "@type": "WebSite",
        author: { "@id": personId },
        description: content.site.description,
        inLanguage: content.site.language,
        name: content.site.brand,
        url: absoluteSiteUrl("/", siteUrl),
      },
    ],
  };
}

// [INTV:ARCH] 프로젝트 상세 페이지 전용 구조화 데이터 — schema.org의 "CreativeWork" 타입으로
// 표현해, 검색엔진이 이 페이지를 저자(위의 Person "@id"를 참조)가 있는 하나의 작품/사례로 이해할
// 수 있게 한다.
export function createProjectStructuredData({
  content,
  project,
  siteUrl,
}: {
  content: PortfolioContent;
  project: PortfolioProject;
  siteUrl: URL;
}): StructuredData {
  const projectPath = `/projects/${project.id}`;

  return {
    "@context": "https://schema.org",
    "@id": `${absoluteSiteUrl(projectPath, siteUrl)}#creative-work`,
    "@type": "CreativeWork",
    author: { "@id": absoluteSiteUrl("/#person", siteUrl) },
    description: project.summary,
    image: absoluteSiteUrl(project.screenshot.src, siteUrl),
    inLanguage: content.site.language,
    keywords: project.tags,
    name: project.title,
    url: absoluteSiteUrl(projectPath, siteUrl),
  };
}

// [INTV:EDGE] components/portfolio/structured-data.tsx가 이 결과를 <script dangerouslySetInnerHTML>로
// 그대로 페이지에 삽입하는데, JSON.stringify가 만든 문자열에 "</script>"나 "-->" 같은 패턴이 우연히
// 섞여 있으면(예: project.title이나 project.tags 같은 콘텐츠 값 안에) 브라우저가 그 지점에서 스크립트
// 태그가 끝난 걸로 오해해 나머지를 일반 HTML로 파싱해버릴 수 있다(HTML 삽입/XSS 위험). 그래서 <,
// >, & 세 문자를 유니코드 이스케이프(\uXXXX)로 바꿔 HTML 파서가 특수 의미로 해석할 여지를 없앤다
// — JSON 파서 입장에서는 < 같은 이스케이프도 정상적으로 "<"로 읽히므로 데이터 자체는 손상되지
// 않는다. 이 이스케이프를 빼먹으면, 콘텐츠 필드에 "</script><script>..." 같은 값이 들어올 경우
// 스크립트 인젝션이 성립하는 진짜 취약점이 된다.
export function serializeStructuredData(data: StructuredData) {
  return JSON.stringify(data)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}

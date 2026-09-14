import type { Metadata } from "next";
import localFont from "next/font/local";
import { headers } from "next/headers";
import type { CSSProperties } from "react";
import { StructuredData } from "@/components/portfolio/structured-data";
import {
  resolvePortfolioContentMode,
  resolveProductionSiteUrl,
} from "@/lib/content-readiness";
import { getPortfolioContent } from "@/lib/portfolio";
import {
  createPortfolioMetadata,
  createSiteStructuredData,
} from "@/lib/site-metadata";
import "./globals.css";

// [INTV:PERF] next/font/local: 로컬 폰트 파일을 최적화해서 로드하는 Next.js 전용 API.
// display:"optional"은 폰트가 늦게 도착하면 레이아웃이 흔들리지 않도록 아예 폴백 폰트로
// 확정해버리는 옵션(FOIT/FOUT 방지 전략 중 하나 — 폰트 로딩을 무한정 기다리다 레이아웃이
// 밀리는 대신, 늦으면 그냥 폴백으로 확정해 레이아웃 안정성을 우선한다). variable은 이 폰트를
// CSS 커스텀 프로퍼티(--font-geist-sans 등)로 노출해, globals.css의 font-family에서 참조하게
// 해준다.
const geistSans = localFont({
  display: "optional",
  src: "./fonts/Geist-Variable.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
});

// [INTV:PERF] preload:false — 이 폰트를 <head>에서 미리 fetch하지 않음. 모노스페이스 폰트는
// 본문 전반에 쓰이지 않는(코드/터미널 UI 한정) 폰트라 우선순위를 낮춰 초기 로딩 성능을 아끼려는
// 선택.
const geistMono = localFont({
  display: "optional",
  preload: false,
  src: "./fonts/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const koreanSerif = localFont({
  display: "optional",
  preload: false,
  src: "./fonts/SourceHanSerifKR-Variable.woff2",
  variable: "--font-noto-serif-kr",
  weight: "250 900",
});

const { site } = getPortfolioContent();
// [INTV:PERF] 사이트 언어가 한국어일 때만 한글 세리프 폰트(용량이 큼)를 실제로 적용 — 불필요한
// 언어에 무거운 웹폰트를 물리지 않으려는 성능상 설계 판단.
const usesKoreanSerif = site.language.toLowerCase().startsWith("ko");
const serifFallback = {
  "--font-noto-serif-kr": '"Iowan Old Style", Baskerville, Georgia, serif',
} as CSSProperties;

// [INTV:ARCH] generateMetadata: Next가 렌더링 전에 호출해 <head> 메타 태그를 만드는 특수
// export.
export async function generateMetadata(): Promise<Metadata> {
  const mode = resolvePortfolioContentMode(
    process.env.PORTFOLIO_CONTENT_MODE,
  );
  let metadataBase: URL;

  // [INTV:ARCH] og:image 등 상대 경로 메타데이터의 기준이 되는 절대 URL(metadataBase)을 정해야
  // 하는데, 프로덕션 빌드에서는 고정된 SITE_URL을 쓰고, 그 외(로컬/프리뷰)에서는 실제 요청이
  // 들어온 호스트를 그대로 써서 배포 환경마다 다시 빌드하지 않아도 미리보기 링크가 정확히
  // 동작하게 한다.
  if (mode === "production") {
    metadataBase = resolveProductionSiteUrl(process.env.SITE_URL);
  } else {
    // [INTV:ARCH] headers(): 서버 컴포넌트에서 현재 요청의 HTTP 헤더를 읽는 Next.js 전용
    // API(클라이언트에는 없음).
    const requestHeaders = await headers();
    // [INTV:EDGE] 리버스 프록시/로드밸런서를 거치면 원래 host/proto 정보가 x-forwarded-* 헤더에
    // 담겨 오므로 그걸 우선 신뢰하고, 없으면 표준 host 헤더로 폴백한다 — 프록시 뒤에서 그냥
    // request.url이나 host 헤더만 읽으면 실제 공개 도메인이 아니라 내부 프록시 주소가 잡히는
    // 흔한 배포 함정.
    const host =
      requestHeaders.get("x-forwarded-host") ??
      requestHeaders.get("host") ??
      "localhost:3100";
    const protocol =
      requestHeaders.get("x-forwarded-proto") ??
      (host.startsWith("localhost") || host.startsWith("127.0.0.1")
        ? "http"
        : "https");
    metadataBase = new URL(`${protocol}://${host}`);
  }

  return createPortfolioMetadata({ metadataBase, mode, site });
}

// [INTV:ARCH] App Router의 최상위 레이아웃 — 모든 페이지를 감싸는 공통 <html>/<body> 셸.
// children이 실제 페이지 내용.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const mode = resolvePortfolioContentMode(
    process.env.PORTFOLIO_CONTENT_MODE,
  );
  // [INTV:EDGE] 구조화 데이터(JSON-LD)는 검색엔진이 사이트를 이해하도록
  // <script type="application/ld+json">에 심는 SEO용 메타데이터. 프로덕션 모드에서만 생성하는
  // 이유는, 미리보기/로컬 환경 URL이 검색엔진 색인에 잘못 노출되는 걸 막기 위함(site-metadata.ts의
  // robots shouldIndex와 같은 template/production 분기 원칙).
  const siteStructuredData =
    mode === "production"
      ? createSiteStructuredData({
          content: getPortfolioContent(),
          siteUrl: resolveProductionSiteUrl(process.env.SITE_URL),
        })
      : undefined;

  return (
    <html
      lang={site.language}
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} ${usesKoreanSerif ? koreanSerif.variable : ""} h-full antialiased`}
      style={usesKoreanSerif ? undefined : serifFallback}
    >
      <body className="min-h-full flex flex-col">
        {siteStructuredData ? <StructuredData data={siteStructuredData} /> : null}
        {children}
      </body>
    </html>
  );
}

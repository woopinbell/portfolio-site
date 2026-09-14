import { expect, test, type Request } from "@playwright/test";

import {
  designIds,
  firstEnabledProject,
  withExplicitDesign,
} from "./site-matrix";

const firstProjectId = firstEnabledProject?.id;

if (!firstProjectId) {
  throw new Error("The performance check needs an enabled project.");
}

const initialRoutes = [
  { label: "home", path: "/" },
  {
    label: "project detail",
    path: `/projects/${firstProjectId}`,
  },
] as const;

// [INTV:PERF] 이 파일은 "성능을 재는" 테스트가 아니라 "성능에 나쁜 일이 몰래 일어나지 않는지"를
// 네트워크/CSSOM을 직접 들여다봐서 검증하는 테스트다 — Lighthouse 점수(performance-gates.test.ts)
// 나 번들 크기(route-budgets.mjs)로는 "Next.js가 링크를 보이는 순간 자동으로 다른 페이지를
// 미리 fetch(prefetch)해버리는지", "레이아웃에 쓰지도 않는데 모노스페이스 폰트가 로드되는지" 같은
// 세밀한 네트워크 동작까지는 못 잡는다.
for (const designId of designIds) {
  for (const route of initialRoutes) {
    test(`${designId} ${route.label} does not prefetch before user interaction`, async ({
      page,
    }) => {
      const prefetchedRoutes: string[] = [];
      const loadedFonts: string[] = [];

      // [INTV:EDGE] Next.js App Router의 <Link>는 뷰포트에 보이기만 해도 그 대상 페이지의 RSC
      // 페이로드를 자동으로 prefetch한다(요청 쿼리스트링에 "_rsc" 파라미터가 붙는다) — 이 사이트는
      // AppShell.tsx에서 이미 본 것과 달리, 내비게이션 링크가 많고 사용자가 실제로 클릭할 확률이
      // 낮은 포트폴리오 특성상 이 자동 prefetch가 불필요한 트래픽이 될 수 있어 의도적으로 막아둔
      // 것으로 보이고, 이 테스트가 그 "막힘"이 실제로 유지되는지 네트워크 요청을 가로채 확인한다.
      const recordPrefetch = (request: Request) => {
        const url = new URL(request.url());

        if (url.searchParams.has("_rsc")) {
          prefetchedRoutes.push(`${url.pathname}${url.search}`);
        }
        if (request.resourceType() === "font") {
          loadedFonts.push(url.pathname);
        }
      };

      page.on("request", recordPrefetch);
      const response = await page.goto(
        withExplicitDesign(route.path, designId),
      );

      expect(response?.ok()).toBe(true);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      // [INTV:TRAP] waitForTimeout(1_000): 이 테스트가 검증하려는 건 "아무 일도 안 일어남"(요청이
      // 없음)이라, 특정 이벤트를 기다리는 방식으로는 표현할 수 없다 — "무언가 일어나지 않았다"를
      // 확인하려면 결국 일정 시간을 흘려보내고 그 사이 아무 것도 안 왔는지 봐야 한다(음성 증명의
      // 어려움). 짧으면 아직 안 일어난 prefetch를 놓치고, 너무 길면 테스트가 느려지는 트레이드오프.
      await page.waitForTimeout(1_000);
      page.off("request", recordPrefetch);

      const monoUsers = await page.locator("body *").evaluateAll((elements) =>
        elements
          .map((element) => ({
            className:
              element instanceof HTMLElement ? element.className : undefined,
            fontFamily: getComputedStyle(element).fontFamily,
            tagName: element.tagName,
          }))
          .filter(({ fontFamily }) => /geist.?mono/i.test(fontFamily))
          .slice(0, 20),
      );

      // [INTV:EDGE] Geist Mono 폰트의 실제 파일 경로를, CSSOM(document.styleSheets)을 직접 순회해
      // @font-face 규칙의 src에서 뽑아낸다 — layout.tsx가 geistMono를 preload: false로 등록한
      // 이유(모노 폰트는 코드/터미널 UI 한정)가 실제로 지켜지는지 검증하려면, "이 폰트의 실제
      // 파일이 무엇인지"부터 페이지가 스스로 정의한 CSS에서 알아내야 한다(하드코딩된 파일명을
      // 기대하면 파일 해시가 바뀔 때마다 테스트가 깨진다).
      const { monoFontPaths, preloadedFontPaths } = await page.evaluate(() => {
        const monoSources = new Set<string>();

        for (const stylesheet of Array.from(document.styleSheets)) {
          let rules: CSSRuleList;

          // [INTV:EDGE] 다른 오리진(CDN 등)에서 로드된 스타일시트는 브라우저의 동일 출처 정책 때문에
          // cssRules 접근 자체가 예외를 던진다 — 이 페이지의 스타일시트가 전부 같은 오리진이어도,
          // 실행 환경에 따라 달라질 수 있는 이 예외를 방어적으로 건너뛴다.
          try {
            rules = stylesheet.cssRules;
          } catch {
            continue;
          }

          for (const rule of Array.from(rules)) {
            if (
              !(rule instanceof CSSFontFaceRule) ||
              !/geist.?mono/i.test(rule.style.getPropertyValue("font-family"))
            ) {
              continue;
            }

            const source = rule.style.getPropertyValue("src");
            const baseUrl = stylesheet.href ?? document.baseURI;
            const sourcePattern = /url\(\s*["']?([^"')]+)["']?\s*\)/g;

            for (const match of source.matchAll(sourcePattern)) {
              const sourceUrl = match[1];

              if (sourceUrl) {
                monoSources.add(new URL(sourceUrl, baseUrl).pathname);
              }
            }
          }
        }

        return {
          monoFontPaths: Array.from(monoSources),
          preloadedFontPaths: Array.from(
            document.querySelectorAll<HTMLLinkElement>(
              'link[rel~="preload"][as="font"]',
            ),
            (link) => new URL(link.href, document.baseURI).pathname,
          ),
        };
      });

      // [INTV:PERF] 세 겹의 검증: (1) RSC prefetch 요청이 전혀 없어야 하고, (2) Geist Mono
      // @font-face 자체는 CSS에 존재해야 하지만(글로벌하게 폰트가 등록은 되어 있어야 함), (3) 그
      // 폰트 파일이 <link rel="preload">로 미리 로드되지도, 실제 요청으로 로드되지도 않아야 한다
      // (design/editorial 테마에 한해서만 "실제 로드 안 됨"까지 검증하는 건, 이 두 테마만 모노
      // 폰트를 본문에 전혀 안 쓴다는 걸 이미 알고 있기 때문 — 다른 테마는 터미널 UI에서 실제로
      // 쓰므로 로드되는 게 정상이라 그 조건에서는 제외). monoUsers는 실패 시 "실제로 어떤 요소가
      // mono 폰트를 쓰고 있었는지"를 디버깅 정보로 남기기 위한 것.
      expect(prefetchedRoutes, designId).toEqual([]);
      expect(monoFontPaths, "Geist Mono @font-face source").not.toEqual([]);
      expect(
        preloadedFontPaths.filter((path) => monoFontPaths.includes(path)),
        `${designId}: Geist Mono preload`,
      ).toEqual([]);
      if (designId === "design" || designId === "editorial") {
        expect(
          loadedFonts.filter((path) => monoFontPaths.includes(path)),
          `${designId}: ${JSON.stringify(monoUsers)}`,
        ).toEqual([]);
      }
    });
  }
}

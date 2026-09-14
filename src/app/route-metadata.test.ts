import { describe, expect, it } from "vitest";

import { getPortfolioContent } from "@/lib/portfolio";

// [INTV:TRAP] `import { X as Y }`: 여기서 쓰는 리네이밍 import — 8개 페이지 파일이 전부 같은
// 이름(generateMetadata)으로 export하기 때문에, 한 파일에서 동시에 가져오려면 이렇게 각기 다른
// 이름을 붙여줘야 충돌하지 않는다(리네이밍 없이 그대로 import하면 마지막에 import한 것으로 전부
// 덮어써져 컴파일 에러가 난다).
import { generateMetadata as getAboutMetadata } from "./about/page";
import { generateMetadata as getContactMetadata } from "./contact/page";
import { generateMetadata as getInterviewMapMetadata } from "./interview-map/page";
import { generateMetadata as getJourneyMetadata } from "./journey/page";
import { generateMetadata as getHomeMetadata } from "./page";
import { generateMetadata as getProjectMetadata } from "./projects/[projectId]/page";
import { generateMetadata as getProjectsMetadata } from "./projects/page";
import { generateMetadata as getResumeMetadata } from "./resume/page";

const content = getPortfolioContent();
const project = content.projects[0];

if (!project) {
  throw new Error("Route metadata tests require at least one enabled project.");
}

describe("route metadata exports", () => {
  // [INTV:ARCH] it.each에 넘기는 각 튜플의 세 번째 값이 함수(generateMetadata 구현 자체)라는
  // 점이 특이하다 — 보통은 데이터값만 넘기지만, vitest는 무엇이든 넘길 수 있어서 "여러 페이지의
  // 서로 다른 함수를, 같은 검증 로직 하나로" 돌리는 데 함수 자체를 데이터처럼 쓴 것(8개 페이지마다
  // 거의 똑같은 assertion을 반복해서 적는 대신, 표 하나로 통합).
  it.each([
    ["/", content.site.title, getHomeMetadata],
    [
      "/projects",
      content.presentation.pages.projects.design.hero.title,
      getProjectsMetadata,
    ],
    ["/about", content.presentation.pages.about.hero.title, getAboutMetadata],
    ["/resume", content.presentation.pages.resume.hero.title, getResumeMetadata],
    ["/contact", content.contact.title, getContactMetadata],
    ["/journey", content.presentation.pages.journey.hero.title, getJourneyMetadata],
    [
      "/interview-map",
      content.presentation.pages.interviewMap.hero.title,
      getInterviewMapMetadata,
    ],
  ])("provides content metadata for %s", async (path, title, getMetadata) => {
    const metadata = await getMetadata();

    expect(metadata.alternates).toEqual({ canonical: path });
    expect(String(metadata.title)).toContain(title);
    expect(metadata.description).toBeTruthy();
  });

  it("uses project content for project detail metadata", async () => {
    const metadata = await getProjectMetadata({
      params: Promise.resolve({ projectId: project.id }),
    });

    expect(metadata.alternates).toEqual({
      canonical: `/projects/${project.id}`,
    });
    expect(metadata.title).toBe(`${project.title} | ${content.site.brand}`);
    expect(metadata.description).toBe(project.summary);
  });
});

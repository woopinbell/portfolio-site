// @testing-library/react 기본 사용법은 app/journey/page.test.tsx 참고.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PortfolioProject } from "@/lib/portfolio";

import { ProjectCardLinks, ProjectLinks } from "./project-links";

// [INTV:ARCH] 실제 콘텐츠 JSON 대신, 이 테스트만을 위한 최소한의 가짜 프로젝트 데이터를 직접
// 타입에 맞춰 작성해둔다 — 콘텐츠 파일이 나중에 바뀌어도 이 테스트가 흔들리지 않도록 테스트
// 전용 픽스처(fixture)를 쓰는 방식(project-links.test.tsx의 fake project와 실제
// src/content/projects.json은 서로 독립적이다).
const project: PortfolioProject = {
  id: "sample-project",
  order: "999",
  title: "Sample Project",
  groupId: "featured",
  tags: ["sample"],
  category: "Web App",
  period: "2026",
  role: "Developer",
  summary: "Summary",
  description: "Description",
  deployment: {
    label: "Live",
    status: "live",
  },
  screenshot: {
    alt: "Sample project",
    src: "/content/projects/sample.svg",
  },
  screenshots: [],
  stack: [],
  links: [
    {
      href: "/projects/sample-project",
      label: "Case Study",
      placements: ["card", "detail"],
      type: "case-study",
    },
    {
      external: true,
      href: "https://github.com/example/sample",
      label: "GitHub",
      placements: ["card", "detail"],
      type: "github",
    },
    {
      external: true,
      href: "https://example.com/demo",
      label: "Live Demo",
      placements: ["card", "detail"],
      type: "demo",
    },
    {
      external: true,
      href: "https://example.com/source",
      label: "Source",
      placements: ["detail"],
      type: "source",
    },
  ],
  highlights: [],
  problem: "Problem",
  solution: "Solution",
  architecture: {
    items: [],
    summary: "Architecture",
  },
  decisions: [],
  tradeoffs: [],
  results: [],
};

describe("project links", () => {
  it("renders detail links in source order", () => {
    render(
      <ProjectLinks
        contentDebug
        homeTemplate="classic"
        project={project}
      />,
    );

    const links = screen.getAllByRole("link");

    expect(links.map((link) => link.textContent)).toEqual([
      "Case Study",
      "GitHub",
      "Live Demo",
      "Source",
    ]);
    expect(links[0]).toHaveAttribute(
      "href",
      "/projects/sample-project?view=classic&debug=content",
    );
    expect(links[0]).not.toHaveAttribute("target");
    expect(links[1]).toHaveAttribute("target", "_blank");
    expect(links[1]).toHaveAttribute("rel", "noreferrer");
  });

  it("applies detail filtering without hiding source links", () => {
    render(
      <ProjectLinks
        excludeCaseStudy
        project={{
          ...project,
          deployment: { label: "Offline", status: "offline" },
        }}
      />,
    );

    // [INTV:TRAP] getByRole은 못 찾으면 즉시 에러를 던지기 때문에 "이 요소가 없어야 한다"를
    // 검증하는 용도로는 못 쓴다 — queryByRole은 못 찾으면 에러 대신 null을 반환해서, "존재하지
    // 않음"을 자연스럽게 단언할 수 있다(getByRole로 "없어야 함"을 검증하려 하면 테스트 자체가
    // 예외로 실패해버리는 흔한 실수).
    expect(
      screen.queryByRole("link", { name: "Case Study" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Live Demo" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "GitHub",
      "Source",
    ]);
  });

  it("limits card links to their declared placement", () => {
    render(<ProjectCardLinks project={project} />);

    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Case Study",
      "GitHub",
      "Live Demo",
    ]);
    expect(
      screen.queryByRole("link", { name: "Source" }),
    ).not.toBeInTheDocument();
  });

  it("renders no wrapper when filtering leaves no links", () => {
    // [INTV:ARCH] render()가 돌려주는 rerender: 컴포넌트를 처음부터 다시 마운트하지 않고, 같은
    // 자리에서 새로운 엘리먼트로 갈아끼워 리렌더링한다 — 실제 React 앱에서 props가 바뀌었을 때와
    // 같은 상황을 재현해, 두 컴포넌트(ProjectCardLinks → ProjectLinks) 모두 "보여줄 링크가
    // 하나도 없으면 빈 DOM을 남긴다"를 한 번에 검증.
    const { container, rerender } = render(
      <ProjectCardLinks
        project={{
          ...project,
          links: [project.links[3]],
        }}
      />,
    );

    expect(container).toBeEmptyDOMElement();

    rerender(
      <ProjectLinks
        excludeCaseStudy
        project={{
          ...project,
          links: [project.links[0]],
        }}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

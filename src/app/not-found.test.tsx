// [INTV:ARCH] @testing-library/react 사용법은 journey/page.test.tsx 상단 주석 참고.
// getByRole("link", {name: "..."})는 <a> 태그를 "링크"라는 역할과 그 접근 가능한 이름(보통 링크
// 텍스트)으로 찾는 방식 — 실제 사용자/스크린리더가 링크를 인식하는 것과 같은 방식으로 테스트가
// 요소를 찾는다는 이 라이브러리의 철학을 잘 보여주는 예.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import NotFound from "./not-found";

describe("not found page", () => {
  it("provides a clear path back to the portfolio", () => {
    render(<NotFound />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Page not found" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return home" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});

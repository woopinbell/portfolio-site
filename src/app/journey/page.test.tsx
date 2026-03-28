// [INTV:ARCH] @testing-library/react: 실제 브라우저 없이(jsdom이라는 가짜 DOM 환경 위에서)
// React 컴포넌트를 렌더링해 테스트하는 라이브러리. 핵심 철학은 "구현 세부사항이 아니라 사용자가
// 실제로 보고 조작하는 방식으로 검증하라" — 그래서 CSS 클래스명이나 컴포넌트 내부 state를 직접
// 들여다보는 대신, getByRole/getByText처럼 스크린리더나 실제 사용자가 화면을 인식하는 방식
// (ARIA role, 화면에 보이는 텍스트, 접근성 라벨)으로 요소를 찾는다.
// - render(엘리먼트): React 엘리먼트를 테스트용 DOM에 마운트한다.
// - screen: 지금 렌더링된 문서 전체에서 요소를 찾을 수 있게 해주는 전역 객체. getByXxx는 못
//   찾으면 즉시 에러를 던지고(반드시 하나 있어야 하는 경우), getAllByXxx는 배열로, 여러 개 있어도
//   된다.
// - cleanup(): 이전 테스트가 마운트한 DOM을 정리한다 — afterEach로 매 테스트 뒤에 자동 실행해
//   테스트끼리 렌더링 결과가 서로 새어나가지 않게 한다.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { getPortfolioContent } from "@/lib/portfolio";

import JourneyPage from "./page";

afterEach(() => cleanup());

describe("JourneyPage", () => {
  it("uses content-owned shell and milestone labels", async () => {
    const content = getPortfolioContent();
    const ui = content.presentation.ui;
    const labels = content.presentation.pages.journey.narrative.labels;

    // [INTV:ARCH] JourneyPage는 Next.js 런타임 없이 그냥 평범한 async 함수로 직접 호출한다 —
    // 실제 서버 컴포넌트가 Next 라우터 안에서 받는 props(searchParams)를 그대로 흉내 내
    // 넘겨주면, 반환된 JSX를 render()에 넣어 "이 서버 컴포넌트가 만드는 최종 HTML 구조"를 검증할
    // 수 있다 — 실제 Next.js 서버를 띄우지 않고도 서버 컴포넌트를 단위 테스트하는 방법.
    render(
      await JourneyPage({
        searchParams: Promise.resolve({ view: "design" }),
      }),
    );

    expect(screen.getByText(ui.skipLinkLabel, { exact: true })).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", {
        name: ui.primaryNavigationAriaLabel,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", {
        hidden: true,
        name: ui.mobileNavigationAriaLabel,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(ui.menuLabel, { exact: true })).toBeInTheDocument();

    for (const label of [labels.state, labels.reason, labels.result]) {
      expect(screen.getAllByText(label, { exact: true }).length).toBeGreaterThan(0);
    }
  });
});

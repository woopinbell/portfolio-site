import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

const tokenFamilies = [
  "--type-display",
  "--type-body",
  "--space-section",
  "--breakpoint-content",
  "--motion-fast",
  "--layer-navigation",
  "--content-width",
] as const;

// [INTV:ARCH] view-models.test.ts처럼 소스(이번엔 globals.css)를 텍스트로 읽어 "필요한 CSS
// 커스텀 프로퍼티가 실제로 선언돼 있는지"를 문자열/정규식으로 확인하는 테스트 — 실제로 페이지를
// 렌더링해 계산된 스타일값을 읽는 대신, CSS 파일 자체에 선언이 존재하는지만 빠르게 검사한다
// (jsdom에는 실제 CSS 렌더링 엔진이 없어 계산된 스타일을 믿을 수 없다는 한계도 있다).
describe("design tokens", () => {
  it.each(tokenFamilies)("defines the %s token", (token) => {
    expect(stylesheet).toContain(`${token}:`);
  });

  // [INTV:TRAP] new RegExp(문자열로 조립한 패턴): 검사할 designId가 배열로 여러 개라 정규식
  // 리터럴(/…/)로 고정해 쓸 수 없어서, 문자열을 조합해 런타임에 정규식을 만든다. `[\s\S]*?`는
  // "줄바꿈을 포함한 아무 문자나, 최소한으로 일치"라는 뜻 — 기본 `.`은 줄바꿈에 매치되지 않기
  // 때문에, 여러 줄에 걸친 CSS 블록 안에서 "이 셀렉터 다음에(중간에 뭐가 오든) 이 프로퍼티가
  // 나온다"를 검사하려면 이 트릭이 필요하다(일반 `.*`로 재구현하면 여러 줄 CSS 블록에서 매칭이
  // 실패한다).
  it.each(["design", "classic"])(
    "keeps the %s renderer token scope explicit",
    (designId) => {
      expect(stylesheet).toMatch(
        new RegExp(`\\[data-site-design=["']${designId}["']\\][\\s\\S]*?--content-width:`),
      );
    },
  );
});

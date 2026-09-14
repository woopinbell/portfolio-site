// [INTV:ARCH] 실행할 코드가 없는 "부수효과(side-effect) import" — 이 모듈을 불러오는 것만으로
// vitest의 expect()에 toBeInTheDocument() 같은 DOM 전용 매처(matcher)들이 추가된다. vitest
// 설정(vitest.config.ts 등)의 setupFiles로 이 파일이 지정되어, 모든 테스트 파일이 실행되기 전에
// 한 번 로드되는 전역 테스트 준비 파일이다.
import "@testing-library/jest-dom/vitest";

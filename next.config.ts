import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 프레임워크 내장 개발 오버레이(빌드 인디케이터)를 끔 — 커스텀 UI와 겹쳐 보이는 걸 막기 위한 선택
  devIndicators: false,
  // "standalone": Next.js가 실행에 필요한 파일만 골라 .next/standalone에 독립 실행 가능한 서버로 묶어줌.
  // Dockerfile에서 이 산출물만 복사해 최종 이미지를 최소화하는 전략과 맞물려 있는 설정 (아키텍처적 선택)
  output: "standalone",
};

export default nextConfig;

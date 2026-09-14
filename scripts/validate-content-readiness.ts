import {
  PortfolioReadinessError,
  validateBuildReadiness,
} from "../src/lib/content-readiness";
import { loadPortfolioSource } from "../src/lib/content-loader";

try {
  const result = validateBuildReadiness(loadPortfolioSource(), {
    PORTFOLIO_CONTENT_MODE: process.env.PORTFOLIO_CONTENT_MODE,
    SITE_URL: process.env.SITE_URL,
  });

  if (result.mode === "template") {
    console.log(
      "Content mode: template. Production readiness is skipped and indexing remains disabled.",
    );
  } else {
    console.log(`Production readiness valid for ${result.siteUrl.origin}.`);
  }
} catch (error) {
  // [INTV:EDGE] PortfolioReadinessError(예상된 검증 실패: 견본 문구가 남았다, 자산이 없다 등)는
  // 깔끔한 메시지만 찍고 exitCode 1로 조용히 끝내지만, 그 외의 예외(코드 버그, 파일 I/O 실패 등)는
  // 그대로 다시 던진다 — "기대된 실패"와 "예상 못한 버그"를 구분해, 후자는 스택 트레이스가 그대로
  // 드러나야 원인을 추적할 수 있기 때문이다.
  if (error instanceof PortfolioReadinessError) {
    console.error(error.message);
    process.exitCode = 1;
  } else {
    throw error;
  }
}

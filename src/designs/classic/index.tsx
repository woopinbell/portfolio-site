import type { DesignRouteProps } from "@/designs/types";

import AboutRoute from "./about-route";
import ContactRoute from "./contact-route";
import HomeRoute from "./home-route";
import InterviewMapRoute from "./interview-map-route";
import JourneyRoute from "./journey-route";
import ProjectDetailRoute from "./project-detail-route";
import ProjectsRoute from "./projects-route";
import ResumeRoute from "./resume-route";

// [INTV:ARCH] 이 파일은 designs/registry.tsx가 `import("./classic")`로 동적 로드하는 진입점
// (default export)이다 — "classic" 테마 하나가 지원하는 8개 라우트를 각자 파일로 나눠두고, 이
// 컴포넌트가 route 값에 따라 알맞은 라우트 컴포넌트로 위임하는 작은 라우터 역할을 한다. props.route는
// 판별 유니언의 판별 필드라 switch가 모든 case를 다루면 TS가 이 함수의 반환 타입을 안전하게
// 추론해준다(exhaustiveness check — case 하나를 빠뜨리면 반환 타입에 undefined가 섞여 타입 에러로
// 드러난다).
export default function ClassicRoute(props: DesignRouteProps) {
  switch (props.route) {
    case "home":
      return <HomeRoute {...props} />;
    case "projects":
      return <ProjectsRoute {...props} />;
    case "project-detail":
      return <ProjectDetailRoute {...props} />;
    case "about":
      return <AboutRoute {...props} />;
    case "resume":
      return <ResumeRoute {...props} />;
    case "contact":
      return <ContactRoute {...props} />;
    case "journey":
      return <JourneyRoute {...props} />;
    case "interview-map":
      return <InterviewMapRoute {...props} />;
  }
}

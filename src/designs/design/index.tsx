import type { DesignRouteProps } from "@/designs/types";

import AboutRoute from "./about-route";
import ContactRoute from "./contact-route";
import HomeRoute from "./home-route";
import InterviewMapRoute from "./interview-map-route";
import JourneyRoute from "./journey-route";
import ProjectDetailRoute from "./project-detail-route";
import ProjectsRoute from "./projects-route";
import ResumeRoute from "./resume-route";

// [INTV:ARCH] "design" 테마의 진입점 — designs/classic/index.tsx와 완전히 같은 구조(라우터
// 역할)라 그쪽 주석 참고.
export default function DesignRoute(props: DesignRouteProps) {
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

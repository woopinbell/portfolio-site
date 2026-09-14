import type { PortfolioProject } from "@/lib/portfolio";
import { isProjectLive } from "@/lib/portfolio";

// [INTV:ARCH] 프로젝트 배포 상태(live/archived/private 등, 도메인 개념: 이 프로젝트가 지금 실제로
// 접속 가능한지/코드만 남았는지 등)를 Tailwind 클래스 문자열에 매핑해두는 조회 테이블. live만
// 강조색이고 나머지는 전부 같은 "흐린" 톤을 쓴다.
const statusTone: Record<string, string> = {
  archived: "border-line bg-surface-soft text-muted",
  "case-study-only": "border-line bg-surface-soft text-muted",
  live: "border-accent/45 bg-accent-soft text-accent-strong",
  offline: "border-line bg-surface-soft text-muted",
  private: "border-line bg-surface-soft text-muted",
  "source-only": "border-line bg-surface-soft text-muted",
};

export function AvailabilityBadge({ project }: { project: PortfolioProject }) {
  if (!project.deployment.showBadge) {
    return null;
  }

  const live = isProjectLive(project);
  const tone = statusTone[project.deployment.status] ?? statusTone["source-only"];

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[0.72rem] font-semibold ${tone}`}
    >
      {live ? (
        <span className="h-1.5 w-1.5 rounded-full bg-accent-strong" />
      ) : null}
      {project.deployment.label}
    </span>
  );
}

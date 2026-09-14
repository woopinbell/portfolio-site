import type { ProjectImage } from "@/lib/portfolio";

export function ProjectScreenshot({
  image,
  priority = false,
}: {
  image: ProjectImage;
  priority?: boolean;
}) {
  return (
    <figure className="project-screenshot overflow-hidden rounded-lg border border-line bg-surface-soft">
      {/* [INTV:TRADE_OFF] profile-photo.tsx와 같은 이유로 next/image 대신 평범한 <img>를
          사용. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={image.alt}
        className="aspect-[16/10] w-full object-cover object-top transition duration-500 ease-out group-hover:scale-[1.035]"
        // [INTV:PERF] priority(호출하는 쪽에서 "이 카드가 화면 상단에 먼저 보인다"고 표시한
        // 것)에 따라 즉시 로드할지(eager) 화면에 가까워질 때 로드할지(lazy)를 직접 고른다 —
        // next/image의 priority 옵션과 같은 역할을 <img>로 손수 구현한 것.
        loading={priority ? "eager" : "lazy"}
        src={image.src}
      />
    </figure>
  );
}

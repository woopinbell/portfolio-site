import type { ProfilePhoto as ProfilePhotoContent } from "@/lib/portfolio";

export function ProfilePhoto({
  photo,
}: {
  photo: ProfilePhotoContent;
}) {
  return (
    <figure className="profile-photo-frame">
      {/* [INTV:TRADE_OFF] Next.js는 보통 최적화된 next/image 컴포넌트 사용을 강제하는 린트
          규칙을 두는데, 여기서는 한 번 쓰이는 작은 프로필 사진이라 그 규칙을 의도적으로 끄고
          평범한 <img>를 사용했다 — next/image의 최적화 이점(자동 리사이즈/포맷 변환)이 한 번만
          쓰이는 작은 이미지에는 설정 비용 대비 이득이 작다는 판단. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={photo.alt}
        className="h-full w-full object-cover"
        // [INTV:PERF] loading="eager": 브라우저의 기본 지연 로딩(lazy loading)을 끄고 즉시
        // 불러오게 강제 — 이 이미지가 항상 화면 최상단(뷰포트 안)에 보이는 요소라 지연시키지
        // 않는 편이 더 빠르게 보이기 때문(뷰포트 밖 이미지에 lazy를 쓰는 것과 반대 논리).
        loading="eager"
        src={photo.src}
      />
    </figure>
  );
}

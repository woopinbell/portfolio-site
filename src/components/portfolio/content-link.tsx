import Link from "next/link";
import {
  getExternalLinkProps,
  getTemplateHref,
  type ContentLink,
  type HomeTemplateId,
} from "@/lib/portfolio";

type ContentLinkViewProps = {
  children: React.ReactNode;
  className: string;
  contentDebug?: boolean;
  homeTemplate?: HomeTemplateId;
  link: ContentLink;
};

// [INTV:ARCH] 콘텐츠 데이터(link)가 내부 라우트인지 외부 사이트인지에 따라 렌더링을 분기하는
// 공용 링크 컴포넌트.
// [INTV:PERF] 이후 다른 컴포넌트들이 쓰는 next/link의 prefetch={false}도 이 파일에서 대표로
// 설명한다: Next.js의 <Link>는 기본적으로 화면에 보이는 링크를 백그라운드에서 미리 fetch(prefetch)
// 해두는데, 이 사이트는 콘텐츠/디자인 테마가 많고 링크 수도 많아 불필요한 프리페치 트래픽을
// 줄이려고 명시적으로 꺼둔 것.
export function ContentLinkView({
  children,
  className,
  contentDebug,
  homeTemplate,
  link,
}: ContentLinkViewProps) {
  if (link.external) {
    // [INTV:EDGE] 외부 링크는 Next의 <Link>(내부 라우팅 전용) 대신 일반 <a>를 쓴다.
    // getExternalLinkProps(selectors.ts)가 target="_blank"와 rel="noreferrer"를 넣어주는데,
    // "noreferrer"는 Referer 헤더로 이 사이트 URL이 상대 사이트에 노출되지 않게 막는다 — target="_blank"만
    // 쓰고 rel을 빠뜨리면, 새 탭으로 열린 외부 페이지가 window.opener로 원래 페이지를 조작할 수 있는
    // 보안 허점(탭내빙 공격)이 생긴다.
    return (
      <a className={className} href={link.href} {...getExternalLinkProps(link)}>
        {children}
      </a>
    );
  }

  return (
    <Link
      className={className}
      href={getTemplateHref(link.href, homeTemplate, { contentDebug })}
      prefetch={false}
    >
      {children}
    </Link>
  );
}

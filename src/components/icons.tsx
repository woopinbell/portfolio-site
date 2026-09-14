import type { SVGProps } from "react";

// [INTV:ARCH] SVGProps<SVGSVGElement>: React가 제공하는 유틸리티 타입으로, <svg> 태그가 받을 수
// 있는 모든 표준 속성(className, onClick 등)의 타입을 그대로 재사용한다. 각 아이콘 컴포넌트는
// { ...props }로 그 속성들을 최종 <svg>에 그대로 넘겨주기 때문에, 호출하는 쪽에서 className이나
// 크기를 자유롭게 덮어쓸 수 있다.
// [INTV:EDGE] aria-hidden="true"는 이 아이콘들이 장식용(스크린리더가 읽을 필요 없음)이라는 표시 —
// 의미 전달은 보통 옆의 텍스트가 담당한다.
// d 속성은 SVG 자체의 벡터 경로 좌표 문자열이라 내용은 개별 주석을 달지 않는다.
// 이 파일의 모든 함수가 같은 패턴(속성 스프레드 + path)이라 이후 컴포넌트에는 반복 설명을 달지 않는다.
type IconProps = SVGProps<SVGSVGElement>;

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 18 18"
      width="18"
      {...props}
    >
      <path
        d="M3.75 9h10.5m0 0-4.2-4.2M14.25 9l-4.2 4.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

export function ArrowUpRightIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 18 18"
      width="18"
      {...props}
    >
      <path
        d="M5 13 13 5m0 0H6.75M13 5v6.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

export function ActivityIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="20"
      viewBox="0 0 20 20"
      width="20"
      {...props}
    >
      <path
        d="M2.5 10h3.1l1.65-4.5 3.5 9 1.8-4.5h4.95"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function CityIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="20"
      viewBox="0 0 20 20"
      width="20"
      {...props}
    >
      <path
        d="M3.75 16.25V6.5l4.5-2.75 4.5 2.75v9.75m-9 0h12.5m-8.9-8.1h1.8m-1.8 3h1.8m2.1-3h1.8m-1.8 3h1.8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.55"
      />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 18 18"
      width="18"
      {...props}
    >
      <path
        d="m4 9.25 3.05 3.05L14 5.7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function ExternalLinkIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="16"
      viewBox="0 0 16 16"
      width="16"
      {...props}
    >
      <path
        d="M6.25 3.25h6.5v6.5m0-6.5-7.5 7.5M7 5H4.2c-.66 0-1.2.54-1.2 1.2v5.6c0 .66.54 1.2 1.2 1.2h5.6c.66 0 1.2-.54 1.2-1.2V9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.45"
      />
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="20"
      viewBox="0 0 20 20"
      width="20"
      {...props}
    >
      <path
        d="M10 17.25c3.5-1.35 5.25-3.7 5.25-7.05V5.55L10 3.25 4.75 5.55v4.65c0 3.35 1.75 5.7 5.25 7.05Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.55"
      />
      <path
        d="m7.4 10.15 1.75 1.75 3.6-3.8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.55"
      />
    </svg>
  );
}

import {
  siC,
  siCmake,
  siCplusplus,
  siDocker,
  siEslint,
  siNextdotjs,
  siNodedotjs,
  siPostgresql,
  siPrisma,
  siReact,
  siRedis,
  siTailwindcss,
  siTypescript,
  siVitest,
  type SimpleIcon,
} from "simple-icons";
import type { TechStackIcon } from "@/lib/portfolio";

// [INTV:ARCH] simple-icons: 실제 브랜드(React, Docker 등) 로고의 SVG 경로 데이터를 제공하는
// 서드파티 패키지 — 로고를 직접 그릴 필요 없이 si* 상수의 .path 값을 그대로 <path d={...}>에
// 넣으면 된다.
// [INTV:ARCH] Partial<Record<TechStackIcon, SimpleIcon>>: 이 프로젝트가 정의한 TechStackIcon
// 값 전부를 키로 강제하되(Record), 전부 채우지 않아도 되게(Partial) 허용하는 타입 — 브랜드
// 로고가 없는 아이콘(터미널, 방패 등)은 여기 없고 아래 fallback으로 빠진다.
const iconMap: Partial<Record<TechStackIcon, SimpleIcon>> = {
  c: siC,
  cmake: siCmake,
  cplusplus: siCplusplus,
  docker: siDocker,
  eslint: siEslint,
  nextjs: siNextdotjs,
  nodejs: siNodedotjs,
  postgresql: siPostgresql,
  prisma: siPrisma,
  react: siReact,
  redis: siRedis,
  tailwind: siTailwindcss,
  typescript: siTypescript,
  vitest: siVitest,
};

// [INTV:ARCH] 아이콘 해석을 2단계로 나눈 구조: 먼저 실제 브랜드 로고(iconMap)가 있으면 그걸
// 쓰고, 없으면 이 프로젝트가 직접 그린 범용 아이콘(FallbackIcon)으로 대체한다.
export function TechIcon({
  color,
  icon,
}: {
  color: string;
  icon: TechStackIcon;
}) {
  const simpleIcon = iconMap[icon];

  if (simpleIcon) {
    return (
      <svg
        aria-hidden="true"
        className="h-4 w-4"
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d={simpleIcon.path} />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
    >
      <FallbackIcon color={color} icon={icon} />
    </svg>
  );
}

// 브랜드 로고가 없는 개념적 아이콘(터미널, 데이터베이스, API 등)을 문자열 비교로 하나씩 골라
// 그리는 함수. 이하 if 블록들은 전부 "이 이름이면 이 SVG path" 패턴이 반복될 뿐이라 개별 설명은
// 생략한다.
function FallbackIcon({
  color,
  icon,
}: {
  color: string;
  icon: TechStackIcon;
}) {
  const stroke = "currentColor";

  if (icon === "terminal") {
    return (
      <path
        d="m5 8 4 4-4 4m6 0h8"
        stroke={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    );
  }

  if (icon === "shield") {
    return (
      <path
        d="M12 21c4-1.5 6-4.2 6-8V6.5L12 4 6 6.5V13c0 3.8 2 6.5 6 8Z"
        stroke={stroke}
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    );
  }

  if (icon === "check") {
    return (
      <path
        d="m5 12.2 4.1 4.1L19 7"
        stroke={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    );
  }

  if (icon === "database") {
    return (
      <path
        d="M5 7c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3Zm0 0v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7m-14 5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"
        stroke={stroke}
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    );
  }

  if (icon === "flow") {
    return (
      <path
        d="M7 6h10M7 18h10M12 6v12m-6-2 6 2 6-2"
        stroke={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    );
  }

  if (icon === "box") {
    return (
      <path
        d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 0v8.8m8-4.3-8 4.3-8-4.3"
        stroke={stroke}
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    );
  }

  if (icon === "api" || icon === "json") {
    return (
      <path
        d="M8 8 4 12l4 4m8-8 4 4-4 4M14 5l-4 14"
        stroke={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    );
  }

  // [INTV:EDGE] 어떤 이름과도 매치되지 않으면(콘텐츠에 오타가 있거나 새 아이콘이 등록만 되고
  // 구현이 안 된 경우) 최후 수단으로 색상 점이 찍힌 원을 그린다 — resolveTechStackItem의 fallback과
  // 같은 계열의 방어.
  return (
    <>
      <circle cx="12" cy="12" r="7" stroke={stroke} strokeWidth="1.6" />
      <circle cx="12" cy="12" fill={color} r="2.5" />
    </>
  );
}

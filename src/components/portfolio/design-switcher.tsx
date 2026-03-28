import Link from "next/link";
import { SITE_DESIGNS } from "@/designs/config";
import { createTemplateHref } from "@/lib/portfolio/template-href";
import type {
  PresentationContent,
  PresentationTemplate,
  SiteDesignId,
} from "@/lib/portfolio/types";
import { DesignSwitcherClose } from "./design-switcher-close";
import styles from "./design-switcher.module.css";

// [INTV:ARCH] 사이트 우측 상단의 "디자인 테마 고르기" 드롭다운. 이 컴포넌트 자체는 "use client"가
// 없는 서버 컴포넌트인데도 열고 닫는 상호작용이 되는 이유는 React state가 아니라 <details>/<summary>
// 라는 브라우저 네이티브 토글 위젯을 그대로 쓰기 때문 — 자바스크립트 없이도 동작하는 UI를 서버
// 컴포넌트로 유지할 수 있는 방식(클라이언트 번들에 이 컴포넌트의 JS를 아예 안 보내도 된다).
export function DesignSwitcher({
  activeId,
  contentDebug,
  currentPath,
  defaultId,
  templates,
  ui,
}: {
  activeId: SiteDesignId;
  contentDebug?: boolean;
  currentPath: string;
  defaultId: SiteDesignId;
  templates: PresentationTemplate[];
  ui: PresentationContent["ui"];
}) {
  const templateCopy = new Map(
    templates.map((template) => [template.id, template]),
  );
  const activeIndex = SITE_DESIGNS.findIndex((design) => design.id === activeId);
  const active = SITE_DESIGNS[activeIndex] ?? SITE_DESIGNS[0];
  const activeCopy = templateCopy.get(active.id);
  const activeLabel = activeCopy?.label ?? active.id;
  const countLabel = ui.designSwitcherCountTemplate
    .replace("{index}", String(activeIndex + 1).padStart(2, "0"))
    .replace("{total}", String(SITE_DESIGNS.length).padStart(2, "0"));

  return (
    // [INTV:EDGE] suppressHydrationWarning: 서버에서 렌더링한 HTML과 브라우저에서 처음 그려지는
    // 결과가 미세하게 달라도(예: <details open> 여부가 사용자의 과거 상호작용에 따라 달라질 수
    // 있는 경우) React가 콘솔에 경고를 띄우지 않도록 이 요소에 한해 하이드레이션 불일치 검사를
    // 끈다(design-switcher.test.tsx가 이 설정 덕분에 실제로 경고가 안 나는지 검증한다).
    <details className={styles.root} suppressHydrationWarning>
      <summary
        aria-label={ui.designSwitcherAriaTemplate.replace(
          "{label}",
          activeLabel,
        )}
      >
        <span className={styles.count}>{countLabel}</span>
        <span className={styles.label}>{activeLabel}</span>
      </summary>
      <nav aria-label={ui.designNavigationAriaLabel} className={styles.panel}>
        <div className={styles.sheetHeader}>
          <strong>{ui.designNavigationAriaLabel}</strong>
          <DesignSwitcherClose label={ui.designSwitcherCloseLabel} />
        </div>
        <ul className={styles.list}>
          {SITE_DESIGNS.map((design, index) => {
            const copy = templateCopy.get(design.id);
            const isActive = design.id === activeId;

            return (
              <li key={design.id}>
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={`${styles.link} ${isActive ? styles.active : ""}`}
                  href={createTemplateHref(
                    currentPath,
                    design.id,
                    defaultId,
                    { contentDebug },
                  )}
                  prefetch={false}
                >
                  <span aria-hidden="true" className={styles.swatch}>
                    {design.swatch.map((color) => (
                      <span key={color} style={{ background: color }} />
                    ))}
                  </span>
                  <span className={styles.copy}>
                    <strong>{copy?.label ?? design.id}</strong>
                    <small>{copy?.description}</small>
                  </span>
                  <span className={styles.number}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </details>
  );
}

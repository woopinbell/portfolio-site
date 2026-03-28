import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import {
  getTemplateHref,
  type HomeTemplateId,
  type JourneyItem,
} from "@/lib/portfolio";
import { ContentHint } from "./content-hint";
import { Reveal } from "./reveal";

// [INTV:ARCH] 이 컴포넌트는 같은 이력(journey) 데이터를 두 가지 레이아웃으로 그릴 수 있다:
// "compact"(세로 한 줄 타임라인)와 "paired-centerline"(가운데 축을 두고 좌우로 카드가 번갈아
// 붙는 타임라인). 어느 쪽을 쓸지는 아래 JourneyList의 variant prop이 결정한다.
type JourneyListVariant = "compact" | "paired-centerline";

// "2024-03-15" 같은 ISO 날짜 문자열에서 앞 7글자("2024-03")만 잘라 "2024.03" 형태로 바꾼다.
function formatYearMonth(date: string) {
  return date.slice(0, 7).replace("-", ".");
}

function getJourneyPeriod(item: JourneyItem) {
  const start = formatYearMonth(item.date);
  const end = item.endDate ? formatYearMonth(item.endDate) : null;

  if (!end || end === start) {
    return start;
  }

  return `${start} - ${end}`;
}

// [INTV:ARCH] 두 레이아웃 모두에서 공유하는 "항목 하나의 내용"(기간/카테고리/제목/본문/케이스
// 스터디 링크) — 바깥 레이아웃 컴포넌트가 이 내용을 <li>든 카드든 원하는 컨테이너로 감싼다.
function JourneyEntry({
  caseStudyLabel,
  contentDebug,
  homeTemplate,
  item,
}: {
  caseStudyLabel: string;
  contentDebug?: boolean;
  homeTemplate?: HomeTemplateId;
  item: JourneyItem;
}) {
  return (
    <>
      <div>
        <ContentHint
          enabled={contentDebug}
          path={`src/content/journey.json > journey[title=${item.title}]`}
        />
        <span className="text-sm font-semibold text-muted">
          {getJourneyPeriod(item)}
        </span>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-accent">
          {item.category}
        </p>
      </div>
      <div>
        <h3 className="font-semibold text-foreground">{item.title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted">{item.body}</p>
        {item.projectId ? (
          <Link
            className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-foreground transition hover:text-accent-strong"
            href={getTemplateHref(`/projects/${item.projectId}`, homeTemplate, {
              contentDebug,
            })}
          >
            {caseStudyLabel}
            <ArrowRightIcon />
          </Link>
        ) : null}
      </div>
    </>
  );
}

function JourneyCard({
  caseStudyLabel,
  contentDebug,
  homeTemplate,
  item,
}: {
  caseStudyLabel: string;
  contentDebug?: boolean;
  homeTemplate?: HomeTemplateId;
  item: JourneyItem;
}) {
  return (
    <article className="paired-timeline-card">
      <JourneyEntry
        caseStudyLabel={caseStudyLabel}
        contentDebug={contentDebug}
        homeTemplate={homeTemplate}
        item={item}
      />
    </article>
  );
}

// [INTV:ARCH] 배열을 2개씩 묶어 [[a,b], [c,d], [e]] 형태로 만든다 — "paired-centerline" 레이아웃이
// 한 행에 카드를 좌우로 하나씩 배치하기 위해, 미리 2개 단위로 쪼개둔 것(마지막 행은 홀수 개면
// 1개만 남을 수 있음).
function chunkPairs(items: JourneyItem[]) {
  const pairs: JourneyItem[][] = [];

  for (let index = 0; index < items.length; index += 2) {
    pairs.push(items.slice(index, index + 2));
  }

  return pairs;
}

function PairedJourneyList({
  animated,
  caseStudyLabel,
  contentDebug,
  homeTemplate,
  items,
}: {
  animated: boolean;
  caseStudyLabel: string;
  contentDebug?: boolean;
  homeTemplate?: HomeTemplateId;
  items: JourneyItem[];
}) {
  // [INTV:ARCH] 배열 구조분해 + 나머지(rest) 패턴: 맨 앞 항목만 따로 뽑아 "시작점"으로 중앙에
  // 단독 배치하고, 그 뒤 나머지 항목들만 2개씩 좌우로 짝지어 배치한다(타임라인 시작을 시각적으로
  // 강조하려는 의도).
  const [startItem, ...projectItems] = items;
  const rows = chunkPairs(projectItems);

  return (
    <div className="paired-timeline">
      <ol className="paired-timeline-list">
        {startItem ? (
          // [INTV:ARCH] animated 값에 따라 같은 내용을 Reveal로 감쌀지(순차 등장 애니메이션)
          // 그냥 <li>로 둘지 분기한다 — 페이지에 따라 애니메이션 유무를 다르게 쓸 수 있게 열어둔
          // 설계.
          animated ? (
            <Reveal
              as="li"
              className="paired-timeline-start"
              key={`${startItem.date}-${startItem.title}`}
            >
              <JourneyCard
                caseStudyLabel={caseStudyLabel}
                contentDebug={contentDebug}
                homeTemplate={homeTemplate}
                item={startItem}
              />
            </Reveal>
          ) : (
            <li
              className="paired-timeline-start"
              key={`${startItem.date}-${startItem.title}`}
            >
              <JourneyCard
                caseStudyLabel={caseStudyLabel}
                contentDebug={contentDebug}
                homeTemplate={homeTemplate}
                item={startItem}
              />
            </li>
          )
        ) : null}
        {rows.map((pair, index) => {
          const rowClassName = `paired-timeline-row ${
            pair.length === 1 ? "is-single" : ""
          }`;
          const row = (
            <>
              <JourneyCard
                caseStudyLabel={caseStudyLabel}
                contentDebug={contentDebug}
                homeTemplate={homeTemplate}
                item={pair[0]}
              />
              <span aria-hidden="true" className="paired-timeline-node" />
              {pair[1] ? (
                <JourneyCard
                  caseStudyLabel={caseStudyLabel}
                  contentDebug={contentDebug}
                  homeTemplate={homeTemplate}
                  item={pair[1]}
                />
              ) : null}
            </>
          );

          return animated ? (
            <Reveal
              as="li"
              className={rowClassName}
              delay={(index + 1) * 70}
              key={pair.map((item) => `${item.date}-${item.title}`).join("-")}
            >
              {row}
            </Reveal>
          ) : (
            <li
              className={rowClassName}
              key={pair.map((item) => `${item.date}-${item.title}`).join("-")}
            >
              {row}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function JourneyList({
  animated = false,
  caseStudyLabel,
  contentDebug,
  homeTemplate,
  items,
  variant = "compact",
}: {
  animated?: boolean;
  caseStudyLabel: string;
  contentDebug?: boolean;
  homeTemplate?: HomeTemplateId;
  items: JourneyItem[];
  variant?: JourneyListVariant;
}) {
  if (variant === "paired-centerline") {
    return (
      <PairedJourneyList
        animated={animated}
        caseStudyLabel={caseStudyLabel}
        contentDebug={contentDebug}
        homeTemplate={homeTemplate}
        items={items}
      />
    );
  }

  const rows = items.map((item, index) =>
    animated ? (
      <Reveal
        as="li"
        className="experience-row grid gap-3 border-b border-line py-5 last:border-b-0 sm:grid-cols-[9.5rem_1fr]"
        delay={index * 60}
        key={`${item.date}-${item.title}`}
      >
        <JourneyEntry
          caseStudyLabel={caseStudyLabel}
          contentDebug={contentDebug}
          homeTemplate={homeTemplate}
          item={item}
        />
      </Reveal>
    ) : (
      <li
        className="experience-row grid gap-3 border-b border-line py-5 last:border-b-0 sm:grid-cols-[9.5rem_1fr]"
        key={`${item.date}-${item.title}`}
      >
        <JourneyEntry
          caseStudyLabel={caseStudyLabel}
          contentDebug={contentDebug}
          homeTemplate={homeTemplate}
          item={item}
        />
      </li>
    ),
  );

  const list = <ol className="relative border-y border-line">{rows}</ol>;

  if (animated) {
    return <Reveal className="timeline-list">{list}</Reveal>;
  }

  return <div className="timeline-list">{list}</div>;
}

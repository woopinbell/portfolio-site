import { expect, test, type Page } from "@playwright/test";

import presentationJson from "../../src/content/presentation.json";
import { designIds, withExplicitDesign, type DesignId } from "./site-matrix";

// [INTV:PERF] 이 파일은 INP(Interaction to Next Paint, 구글이 정의한 코어 웹 바이탈 중 하나 —
// "사용자가 클릭한 뒤 화면이 실제로 반응하기까지 걸린 시간")를 Lighthouse 같은 외부 도구 없이,
// 브라우저 표준 API(PerformanceObserver의 Event Timing)를 직접 읽어 실측하는 손수 제작 측정
// 하니스다. INTERACTION_TARGET_MS(200ms)는 구글이 INP "양호" 기준으로 제시하는 값. EVENT_TIMING_
// THRESHOLD_MS(16ms, 한 프레임 길이 ≈ 60fps)는 그보다 짧은 상호작용은 애초에 이벤트로 기록되지
// 않는 브라우저 API 자체의 최소 보고 단위 — 반응이 그 이하로 빨랐다는 뜻이라 통과로 간주한다.
const EVENT_TIMING_THRESHOLD_MS = 16;
const INTERACTION_TARGET_MS = 200;
const SAMPLE_COUNT = 3;
const DESIGN_SWITCHER_LABEL_PATTERN = new RegExp(
  `^${presentationJson.ui.designSwitcherAriaTemplate
    .split("{label}")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".+")}$`,
);

type EventTimingRecord = {
  duration: number;
  interactionId: number;
  name: string;
  startTime: number;
};

type InteractionProbe = {
  entries: EventTimingRecord[];
  observer: PerformanceObserver;
  sampleStartedAt: number;
  trustedClickCount: number;
};

type InteractionSample = {
  durationUpperBoundMs: number;
  reportedDuration: string;
};

declare global {
  interface Window {
    __portfolioInteractionProbe?: InteractionProbe;
  }
}

// [INTV:PERF] "다음 페인트까지 기다린다"를 구현하는 이중 requestAnimationFrame + setTimeout(0)
// 트릭: 첫 rAF는 "다음 프레임이 시작될 때" 실행되지만 그 프레임 자체가 아직 화면에 그려지기
// 전이고, 그 안에서 예약한 두 번째 rAF가 실행되는 시점에는 앞선 프레임의 페인트가 완료돼 있다는
// 보장이 있다 — setTimeout(0)까지 더하는 건 그 이후 마이크로태스크/이벤트 루프 처리까지 흘려보내
// Event Timing 엔트리가 확실히 기록될 시간을 주기 위함.
async function settleNextPaint(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(resolve, 0);
          });
        });
      }),
  );
}

// [INTV:ARCH] 페이지 안에 PerformanceObserver를 심어 브라우저가 실제로 기록하는 "event" 타입
// 엔트리(클릭 등 상호작용이 처리되는 데 걸린 시간)를 window 전역(__portfolioInteractionProbe)에
// 계속 쌓아두는 구조 — Playwright의 page.evaluate는 매번 독립된 실행이라 상태를 유지할 수 없으므로,
// 브라우저 쪽에 "관측소"를 하나 설치해두고 그 상태를 나중에 읽어오는 방식을 쓴다.
async function installInteractionProbe(page: Page) {
  const supported = await page.evaluate((durationThreshold) => {
    // [INTV:EDGE] Event Timing API(Interaction to Next Paint 측정의 기반)는 Chromium 계열에만
    // 있고 WebKit/Firefox에는 없다 — 지원 여부를 먼저 확인해 false를 반환하고, 아래 expect로
    // "지원 안 하는 브라우저에서 이 테스트가 돌면 안 된다"는 전제를 명시적으로 검증한다(다른
    // 브라우저 프로젝트에서 실수로 이 스펙이 실행되면 조용히 의미 없는 값을 통과시키는 대신
    // 확실히 실패하게 만든다).
    if (!PerformanceObserver.supportedEntryTypes.includes("event")) {
      return false;
    }

    const probe: InteractionProbe = {
      entries: [],
      observer: undefined as unknown as PerformanceObserver,
      sampleStartedAt: performance.now(),
      trustedClickCount: 0,
    };
    const observer = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        const eventEntry = entry as PerformanceEntry & {
          interactionId?: number;
        };

        probe.entries.push({
          duration: eventEntry.duration,
          interactionId: eventEntry.interactionId ?? 0,
          name: eventEntry.name,
          startTime: eventEntry.startTime,
        });
      }
    });

    observer.observe({
      buffered: true,
      durationThreshold,
      type: "event",
    } as PerformanceObserverInit & { durationThreshold: number });
    probe.observer = observer;
    window.__portfolioInteractionProbe = probe;

    // [INTV:EDGE] event.isTrusted: 브라우저가 진짜 사용자 입력(실제 마우스 클릭)으로 발생시킨
    // 이벤트인지, 스크립트가 dispatchEvent 등으로 인위적으로 만든 합성 이벤트인지 구분하는 표준
    // 속성 — 아래 readInteractionSample에서 "정확히 신뢰된 클릭 1번당 1개의 상호작용"이라는 전제를
    // 검증하는 데 쓰인다(Playwright의 .click()은 실제 OS 수준 입력을 흉내 내 isTrusted가 true인
    // 이벤트를 만든다는 것에 의존).
    document.addEventListener(
      "click",
      (event) => {
        if (event.isTrusted) {
          const currentProbe = window.__portfolioInteractionProbe;

          if (currentProbe) {
            currentProbe.trustedClickCount += 1;
          }
        }
      },
      { capture: true },
    );

    return true;
  }, EVENT_TIMING_THRESHOLD_MS);

  expect(
    supported,
    "Chromium must expose PerformanceObserver Event Timing entries.",
  ).toBe(true);
}

async function resetInteractionProbe(page: Page) {
  await page.evaluate(() => {
    const probe = window.__portfolioInteractionProbe;

    if (!probe) {
      throw new Error("The interaction timing probe is not installed.");
    }

    probe.entries = [];
    probe.sampleStartedAt = performance.now();
    probe.trustedClickCount = 0;
  });
}

async function readInteractionSample(page: Page): Promise<InteractionSample> {
  await settleNextPaint(page);

  const snapshot = await page.evaluate(() => {
    const probe = window.__portfolioInteractionProbe;

    if (!probe) {
      throw new Error("The interaction timing probe is not installed.");
    }

    return {
      entries: probe.entries.filter(
        (entry) => entry.startTime >= probe.sampleStartedAt,
      ),
      trustedClickCount: probe.trustedClickCount,
    };
  });

  expect(
    snapshot.trustedClickCount,
    "Each sample must contain exactly one browser-trusted click.",
  ).toBe(1);

  // [INTV:EDGE] Event Timing 엔트리는 클릭과 무관한 다른 상호작용도 섞여 들어올 수 있어,
  // interactionId(브라우저가 "이건 같은 하나의 상호작용"이라고 묶어주는 값)가 0보다 큰 것만
  // 걸러낸다 — 0은 "이 이벤트는 사용자 상호작용으로 집계되지 않는다"는 뜻.
  const interactionEntries = snapshot.entries.filter(
    (entry) => entry.interactionId > 0,
  );

  // [INTV:EDGE] 상호작용이 EVENT_TIMING_THRESHOLD_MS(16ms)보다 짧으면 애초에 durationThreshold
  // 설정 때문에 엔트리 자체가 안 잡힌다 — 그 경우를 "측정 실패"가 아니라 "임계값보다 빨랐다"는
  // 뜻으로 해석해, 상한선을 그 임계값으로 보고한다(측정 도구의 해상도 한계를 결과에 반영).
  if (interactionEntries.length === 0) {
    return {
      durationUpperBoundMs: EVENT_TIMING_THRESHOLD_MS,
      reportedDuration: `<${EVENT_TIMING_THRESHOLD_MS}ms`,
    };
  }

  const interactionIds = [
    ...new Set(interactionEntries.map((entry) => entry.interactionId)),
  ];
  expect(
    interactionIds,
    "One trusted click must resolve to one Event Timing interaction.",
  ).toHaveLength(1);

  // [INTV:PERF] 같은 interactionId 아래 여러 엔트리(pointerdown, mousedown, click 등 여러 이벤트
  // 단계가 모두 기록됨)가 있을 수 있어, 그중 가장 긴 duration을 이 상호작용의 대표값으로 쓴다 —
  // INP는 "상호작용이 완전히 반응하기까지 걸린 시간"이므로, 가장 늦게 끝난 단계가 사용자가 실제로
  // 체감하는 지연을 결정한다.
  const interactionId = interactionIds[0];
  const entries = interactionEntries.filter(
    (entry) => entry.interactionId === interactionId,
  );
  const duration = Math.max(...entries.map((entry) => entry.duration));

  return {
    durationUpperBoundMs: duration,
    reportedDuration: `${duration.toFixed(1)}ms`,
  };
}

// [INTV:PERF] 평균이 아니라 중앙값(median)을 대표값으로 쓴다 — 성능 측정치는 가끔 GC나 다른
// 프로세스 간섭으로 튀는 이상치(outlier)가 섞이기 쉬운데, 평균은 그 이상치 하나에 쉽게 끌려가지만
// 중앙값은 훨씬 덜 흔들린다(아래 reportAndAssertSamples가 중앙값과 별개로 최댓값도 함께 검증해,
// "일반적인 경우"와 "최악의 경우"를 둘 다 놓치지 않는다).
function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

// [INTV:ARCH] 중앙값과 최댓값을 각각 별도의 expect로 따로 검증한다(하나로 합쳐서 판단하지 않는
// 이유) — 중앙값 하나만 보면 "가끔 한 번씩 튀는 심각한 지연"을 놓치고, 최댓값 하나만 보면 이상치
// 하나 때문에 전체 테마가 항상 실패하는 과민 반응이 된다. console.info로 원시 샘플들을 전부 찍어두는
// 건, CI에서 실패했을 때 "median()이 왜 그 값을 골랐는지"를 재현 없이 로그만으로 추적하기 위함.
function reportAndAssertSamples({
  designId,
  projectName,
  samples,
  scenario,
}: {
  designId: DesignId;
  projectName: string;
  samples: InteractionSample[];
  scenario: string;
}) {
  expect(samples).toHaveLength(SAMPLE_COUNT);

  const upperBounds = samples.map((sample) => sample.durationUpperBoundMs);
  const medianUpperBoundMs = median(upperBounds);
  const maxUpperBoundMs = Math.max(...upperBounds);
  const output = [
    `[interaction-performance] ${projectName}`,
    designId,
    scenario,
    `samples=${samples.map((sample) => sample.reportedDuration).join(",")}`,
    `medianUpperBound=${medianUpperBoundMs.toFixed(1)}ms`,
    `maxUpperBound=${maxUpperBoundMs.toFixed(1)}ms`,
    `target=${INTERACTION_TARGET_MS}ms`,
  ].join(" ");

  console.info(output);

  expect(
    medianUpperBoundMs,
    `${designId} ${scenario} median interaction duration upper bound`,
  ).toBeLessThanOrEqual(INTERACTION_TARGET_MS);
  expect(
    maxUpperBoundMs,
    `${designId} ${scenario} maximum interaction duration upper bound`,
  ).toBeLessThanOrEqual(INTERACTION_TARGET_MS);
}

// [INTV:FLOW] 아래 두 테스트(디자인 스위처 닫기, 모바일 메뉴 토글)가 공통으로 필요로 하는 "스위처를
// 열고 안정 상태까지 기다리는" 절차를 하나로 묶은 셋업 헬퍼.
// - [FLOW] 1. 라벨로 스위처 버튼 탐색 -> 2. 클릭해서 열기 -> 3. 내비게이션 패널이 보일 때까지 대기 ->
//   4. settleNextPaint로 다음 페인트까지 흘려보내 애니메이션/포커스 이동이 끝난 "고요한" 상태 확보 ->
//   5. 닫기 버튼과 스위처 버튼 핸들을 함께 반환(모바일은 닫기 버튼을, 데스크톱은 스위처 버튼 재클릭을
//   쓰므로 호출부가 골라 쓸 수 있게 둘 다 넘긴다).
async function openDesignSwitcher(page: Page) {
  const navigation = page.getByRole("navigation", {
    name: presentationJson.ui.designNavigationAriaLabel,
  });
  const switcher = page.getByLabel(DESIGN_SWITCHER_LABEL_PATTERN);

  await switcher.click();
  await expect(navigation).toBeVisible();
  await settleNextPaint(page);

  return {
    closeButton: navigation.getByRole("button", {
      name: presentationJson.ui.designSwitcherCloseLabel,
    }),
    navigation,
    switcher,
  };
}

for (const designId of designIds) {
  test(`${designId}: design switcher close stays within the interaction target`, async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name.includes("mobile");
    const response = await page.goto(withExplicitDesign("/", designId));

    expect(response?.ok()).toBe(true);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await installInteractionProbe(page);

    // [INTV:PERF] 측정 전에 한 번 "워밍업"으로 같은 상호작용을 먼저 실행해둔다 — JS 엔진의
    // JIT 컴파일, 최초 실행 시 캐시가 비어있는 상태 등 "처음 한 번만 느린" 요인을 배제하고, 이후
    // SAMPLE_COUNT번의 측정이 안정된 상태에서의 실제 반복 성능을 재도록 한다(design-switcher-close.tsx
    // 의 onClick 핸들러가 여기서 실제로 클릭되는 코드 — closest()/querySelector 탐색과 focus() 호출이
    // 200ms 안에 끝나는지를 E2E로 검증).
    const warmup = await openDesignSwitcher(page);
    await (isMobile ? warmup.closeButton : warmup.switcher).click();
    await expect(warmup.navigation).toBeHidden();
    await expect(warmup.switcher).toBeFocused();
    await settleNextPaint(page);

    const samples: InteractionSample[] = [];

    for (let sampleIndex = 0; sampleIndex < SAMPLE_COUNT; sampleIndex += 1) {
      const { closeButton, navigation, switcher } =
        await openDesignSwitcher(page);

      await resetInteractionProbe(page);
      await (isMobile ? closeButton : switcher).click();
      await expect(navigation).toBeHidden();
      await expect(switcher).toBeFocused();
      samples.push(await readInteractionSample(page));
    }

    reportAndAssertSamples({
      designId,
      projectName: testInfo.project.name,
      samples,
      scenario: "design-switcher-close",
    });
  });

  test(`${designId}: mobile menu toggle stays within the interaction target`, async ({
    page,
  }, testInfo) => {
    // [INTV:TRAP] 모바일 내비게이션 메뉴는 데스크톱 뷰포트에서는 아예 렌더링되지 않는(또는 숨겨진)
    // 요소라, 이 테스트를 모바일이 아닌 프로젝트(예: chromium 데스크톱)에서도 그대로 돌리면 요소를
    // 못 찾아 실패한다 — designIds × 전체 Playwright 프로젝트 조합을 그대로 순회하는 for 루프
    // 구조상, 테스트 케이스 자체를 조건부로 건너뛰는 test.skip 없이는 이 파일이 프로젝트 설정과
    // 무관하게 매번 절반은 깨지는 상태가 된다.
    test.skip(
      !testInfo.project.name.includes("mobile"),
      "The menu toggle is measured with the mobile viewport.",
    );

    const response = await page.goto(withExplicitDesign("/", designId));

    expect(response?.ok()).toBe(true);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await installInteractionProbe(page);

    const navigation = page.locator(
      `nav[aria-label="${presentationJson.ui.mobileNavigationAriaLabel}"]`,
    );
    const menu = page
      .locator("details")
      .filter({ has: navigation })
      .locator(":scope > summary");

    await menu.click();
    await expect(navigation).toBeVisible();
    await menu.click();
    await expect(navigation).toBeHidden();
    await settleNextPaint(page);

    const samples: InteractionSample[] = [];

    for (let sampleIndex = 0; sampleIndex < SAMPLE_COUNT; sampleIndex += 1) {
      await resetInteractionProbe(page);
      await menu.click();
      await expect(navigation).toBeVisible();
      samples.push(await readInteractionSample(page));

      await menu.click();
      await expect(navigation).toBeHidden();
      await settleNextPaint(page);
    }

    reportAndAssertSamples({
      designId,
      projectName: testInfo.project.name,
      samples,
      scenario: "mobile-menu-open",
    });
  });
}

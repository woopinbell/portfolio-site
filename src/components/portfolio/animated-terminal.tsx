"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProfileContent, TerminalPresentation } from "@/lib/portfolio";

// [INTV:ARCH] 파일 맨 위의 "use client": Next.js App Router는 기본적으로 컴포넌트를 서버에서만
// 렌더링하는데(브라우저로 JS 전송 안 됨), 이 지시어가 있으면 그 컴포넌트와 하위 트리를 "클라이언트
// 컴포넌트"로 표시해 브라우저에서 실행/하이드레이션되게 한다. 이 파일은 useState/setTimeout으로
// 상태를 바꾸며 애니메이션을 만들어야 하니(=상호작용/타이머가 필요) 클라이언트 컴포넌트가 필수다.

function formatTerminalLine(
  line: string,
  {
    profile,
    projectCount,
    stackCount,
  }: {
    profile: ProfileContent;
    projectCount: number;
    stackCount: number;
  },
) {
  return line
    .replaceAll("{handle}", profile.handle.toLowerCase())
    .replaceAll("{role}", profile.role.toLowerCase())
    .replaceAll("{location}", profile.location)
    .replaceAll("{projectCount}", String(projectCount))
    .replaceAll("{stackCount}", String(stackCount));
}

export function AnimatedTerminal({
  ariaLabel,
  profile,
  projectCount,
  stackCount,
  terminal,
}: {
  ariaLabel: string;
  profile: ProfileContent;
  projectCount: number;
  stackCount: number;
  terminal: TerminalPresentation;
}) {
  // [INTV:PERF] useMemo: profile/projectCount/stackCount/terminal.commands가 안 바뀌면 매
  // 렌더링마다 다시 계산하지 않고 이전 결과를 재사용 — 여기서는 커맨드 목록에 {handle} 같은
  // 플레이스홀더를 채워 넣는 문자열 가공을 캐싱하는 용도.
  const commands = useMemo(
    () =>
      terminal.commands.map((command) => ({
        ...command,
        output: command.output.map((line) =>
          formatTerminalLine(line, { profile, projectCount, stackCount }),
        ),
      })),
    [profile, projectCount, stackCount, terminal.commands],
  );
  // useState: 렌더링 사이에 값이 유지되는 상태 — setter를 호출하면 리렌더링이 트리거된다.
  const [commandIndex, setCommandIndex] = useState(0);
  const [typedCommand, setTypedCommand] = useState(commands[0]?.command ?? "");
  const [phase, setPhase] = useState<"typing" | "hold" | "erase">("hold");
  const activeCommand = commands[commandIndex];

  // [INTV:ARCH] 가짜 터미널의 "타이핑 애니메이션"을 타이핑→대기→지우기 3단계 상태 머신으로
  // 구현했다. CSS 애니메이션만으로는 "한 글자씩 타이핑되는 가변 길이 텍스트"를 표현하기 어려워서,
  // setTimeout으로 글자 단위 상태 전이를 만드는 방식을 택했다.
  useEffect(() => {
    // [INTV:EDGE] prefers-reduced-motion(모션 최소화 설정)이 켜진 사용자에게는 애니메이션을
    // 아예 돌리지 않고 정지 상태로 둔다(접근성 배려).
    const reduceMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      return;
    }

    let timeout: ReturnType<typeof setTimeout>;

    if (phase === "typing") {
      if (typedCommand.length < activeCommand.command.length) {
        timeout = setTimeout(() => {
          setTypedCommand(activeCommand.command.slice(0, typedCommand.length + 1));
        }, 42);
      } else {
        timeout = setTimeout(() => setPhase("hold"), 520);
      }
    }

    if (phase === "hold") {
      timeout = setTimeout(() => setPhase("erase"), 1700);
    }

    if (phase === "erase") {
      if (typedCommand.length > 0) {
        timeout = setTimeout(() => {
          setTypedCommand(activeCommand.command.slice(0, typedCommand.length - 1));
        }, 24);
      } else {
        timeout = setTimeout(() => {
          setCommandIndex((current) => (current + 1) % commands.length);
          setPhase("typing");
        }, 220);
      }
    }

    // [INTV:EDGE] effect의 클린업 함수: 다음 렌더링으로 넘어가기 전(의존성이 바뀌어 effect가
    // 재실행되기 전) 이전 타이머를 취소해 여러 개의 setTimeout이 동시에 쌓여 상태를 어긋나게
    // 덮어쓰는 걸 방지한다.
    return () => clearTimeout(timeout);
  }, [activeCommand.command, commands.length, phase, typedCommand]);

  const shouldShowOutput = phase !== "typing" || typedCommand === activeCommand.command;

  return (
    <aside
      aria-label={ariaLabel}
      className="terminal-window mx-auto w-full max-w-xl"
    >
      <div className="terminal-titlebar">
        <span className="bg-[#ff6b5f]" />
        <span className="bg-[#f6c76f]" />
        <span className="bg-[#67d391]" />
        <p>{terminal.title}</p>
      </div>
      <div className="terminal-body">
        <p className="terminal-line text-muted">
          {terminal.bootLine}
        </p>
        <p className="terminal-line">
          <span className="text-accent">{terminal.promptUser}</span>
          <span className="text-muted">:</span>
          <span className="text-signal">{terminal.promptPath}</span>
          <span className="text-muted">$ </span>
          <span>{typedCommand}</span>
          <span aria-hidden="true" className="terminal-caret" />
        </p>
        <div className="mt-4 min-h-[4.75rem] space-y-2">
          {shouldShowOutput
            ? activeCommand.output.map((line) => (
                <p className="terminal-line terminal-output" key={line}>
                  {line}
                </p>
              ))
            : null}
        </div>
      </div>
    </aside>
  );
}

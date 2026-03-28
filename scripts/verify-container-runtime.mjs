import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

// [INTV:ARCH] 이 스크립트는 Dockerfile을 실제로 빌드하고 컨테이너를 띄워, "이미지가 정말 요구사항대로
// 동작하는지"를 실측으로 검증하는 통합 테스트다 — Dockerfile 안의 개별 지시어(USER node 등)가
// 문법적으로 맞는지는 빌드 성공 여부로만 알 수 있지만, "실제로 non-root로 실행되는지", "정적 자산이
// 올바른 MIME 타입으로 서빙되는지"는 컨테이너를 띄워 실제 HTTP 요청을 보내봐야 확인할 수 있다.
// [INTV:EDGE] 이미지/컨테이너 이름에 프로세스 PID + 랜덤 hex를 섞어 매 실행마다 고유하게 만든다 —
// CI에서 여러 실행이 겹치거나, 이전 실행이 정리에 실패하고 남긴 컨테이너와 이름이 충돌하는 걸
// 방지한다.
const suffix = `${process.pid}-${randomBytes(4).toString("hex")}`;
const imageName = `portfolio-runtime-test:${suffix}`;
const containerName = `portfolio-runtime-test-${suffix}`;
const contentDirectory = path.join(process.cwd(), "src/content");
const mimeByExtension = new Map([
  [".avif", "image/avif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".pdf", "application/pdf"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

async function docker(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, {
      cwd: process.cwd(),
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let stderr = "";
    let stdout = "";

    if (options.capture) {
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
    }

    child.on("error", reject);
    child.on("close", (exitCode) => {
      if (exitCode !== 0) {
        reject(
          new Error(
            `docker ${args.join(" ")} exited ${exitCode}${stderr ? `: ${stderr.trim()}` : ""}`,
          ),
        );
        return;
      }
      resolve(stdout.trim());
    });
  });
}

function collectAssetPaths(value, assets) {
  if (typeof value === "string") {
    if (/^\/(content|template)\//.test(value)) {
      assets.add(value);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectAssetPaths(item, assets);
    return;
  }

  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectAssetPaths(item, assets);
  }
}

async function discoverAssets() {
  const assets = new Set();

  for (const filename of (await readdir(contentDirectory)).sort()) {
    if (!filename.endsWith(".json")) continue;
    collectAssetPaths(
      JSON.parse(await readFile(path.join(contentDirectory, filename), "utf8")),
      assets,
    );
  }

  return [...assets].sort();
}

// [INTV:EDGE] 컨테이너를 --detach로 띄운 직후는 프로세스가 이제 막 시작된 시점이라 아직 Next.js
// 서버가 요청을 받을 준비가 안 됐을 수 있다 — 최대 60초 동안 1초 간격으로 폴링하며 응답이 올
// 때까지 기다린다(fault-scenario.mjs의 observeStep, toxiproxy-control.mjs의 waitForApi와 같은
// 계열의 "준비될 때까지 폴링" 패턴).
async function waitUntilReady(baseUrl) {
  let lastError;

  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
      lastError = new Error(`readiness returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(1_000);
  }

  throw new Error(`container did not become ready: ${lastError}`);
}

async function verifyResponse(baseUrl, pathname, expectedMime) {
  const response = await fetch(new URL(pathname, baseUrl));
  const body = new Uint8Array(await response.arrayBuffer());
  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();

  if (response.status !== 200) {
    throw new Error(`${pathname}: expected 200, received ${response.status}`);
  }
  if (body.byteLength === 0) {
    throw new Error(`${pathname}: response body is empty`);
  }
  if (expectedMime && !contentType.includes(expectedMime)) {
    throw new Error(
      `${pathname}: expected ${expectedMime}, received ${contentType || "none"}`,
    );
  }
}

let containerStarted = false;
let failed = false;

try {
  const assets = await discoverAssets();
  if (assets.length === 0) {
    throw new Error("content JSON did not reference a public asset");
  }

  await docker(["build", "--tag", imageName, "."]);
  // [INTV:EDGE] "127.0.0.1::3100"처럼 호스트 포트를 비워두면 Docker가 사용 가능한 임의의 포트를
  // 골라 매핑해준다 — 이 스크립트를 병렬로 여러 번 돌리거나(CI 매트릭스 등) 로컬에 이미 3100번
  // 포트를 쓰는 다른 프로세스가 있어도 포트 충돌 없이 항상 성공한다. 실제로 어느 포트가 배정됐는지는
  // 아래 `docker port`로 다시 조회해야 한다.
  await docker([
    "run",
    "--detach",
    "--name",
    containerName,
    "--publish",
    "127.0.0.1::3100",
    imageName,
  ]);
  containerStarted = true;

  const publishedPort = await docker(
    ["port", containerName, "3100/tcp"],
    { capture: true },
  );
  const port = publishedPort.match(/:(\d+)\s*$/)?.[1];
  if (!port) throw new Error(`cannot parse published port: ${publishedPort}`);

  const baseUrl = `http://127.0.0.1:${port}`;
  await waitUntilReady(baseUrl);

  // [INTV:EDGE] Dockerfile의 `USER node` 지시어가 실제로 적용됐는지를, 이미지 설정이 아니라 실행
  // 중인 컨테이너를 inspect해서 재확인한다 — Dockerfile을 읽는 것만으로는 "그 지시어가 실제로
  // 최종 실행 스테이지에까지 살아남았는지"(예: 멀티스테이지 빌드에서 다른 스테이지로 복사하며
  // USER 설정이 빠지는 실수)를 보장할 수 없다.
  const user = await docker(
    ["inspect", "--format", "{{.Config.User}}", containerName],
    { capture: true },
  );
  if (user !== "node") {
    throw new Error(`container must run as node, received ${user || "root"}`);
  }

  await verifyResponse(baseUrl, "/", "text/html");
  await verifyResponse(
    baseUrl,
    "/projects/example-project?view=classic",
    "text/html",
  );

  for (const asset of assets) {
    const extension = path.extname(new URL(asset, baseUrl).pathname).toLowerCase();
    const expectedMime = mimeByExtension.get(extension);
    if (!expectedMime) {
      throw new Error(`${asset}: unsupported MIME contract for ${extension}`);
    }
    await verifyResponse(baseUrl, asset, expectedMime);
  }

  console.log(
    `verified non-root container, 2 routes, and ${assets.length} content assets`,
  );
} catch (error) {
  // [INTV:EDGE] 검증이 실패하면 원인 파악을 돕기 위해 컨테이너 로그를 stdout으로 흘려보낸 뒤(로그
  // 조회 자체가 실패해도 무시하고) 원래 에러를 다시 던진다 — CI 로그만 보고도 "무엇이 실패했는지"
  // 뿐 아니라 "그 안에서 서버가 뭐라고 했는지"까지 바로 알 수 있게 하는 배려.
  failed = true;
  if (containerStarted) {
    try {
      await docker(["logs", containerName]);
    } catch {}
  }
  throw error;
} finally {
  // [INTV:EDGE] 성공/실패와 무관하게 항상 컨테이너와 이미지를 정리한다(testReset.ts의 try/finally
  // 정리 원칙과 동일) — 다만 정리 자체가 실패했을 때의 처리가 미묘하다: 이미 본검증이 실패한
  // 상태(failed)라면 정리 실패는 무시하고 원래 에러가 그대로 전파되게 하고, 본검증이 성공한
  // 상태에서 정리만 실패했다면 그건 그 자체로 새로운 문제이므로 던진다 — "원래 실패의 원인을
  // 정리 단계의 실패가 가리면 안 된다"는 원칙(fault-scenario.mjs의 cleanup 처리와 같은 판단).
  if (containerStarted) {
    try {
      await docker(["rm", "--force", containerName], { capture: true });
    } catch (error) {
      if (!failed) throw error;
    }
  }
  try {
    await docker(["image", "rm", "--force", imageName], { capture: true });
  } catch (error) {
    if (!failed) throw error;
  }
}

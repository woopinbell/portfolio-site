// [INTV:ARCH] node:fs / node:path — Node.js 내장 모듈(브라우저에는 없음). 이 파일은 빌드/서버
// 시점에만 실행되는 "콘텐츠 무결성 검사" 로직이라 브라우저 API가 아니라 파일시스템 API를 직접
// 다룬다.
import { existsSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

import {
  PortfolioContentError,
  type ContentValidationIssue,
  type PortfolioSource,
} from "./content-loader";

type AssetReference = {
  assetPath: string;
  file: string;
  path: string;
};

// [INTV:ARCH] 콘텐츠 JSON 여러 파일에 흩어진 "이미지/파일 경로" 필드를 전부 한 목록으로 모은다
// — 각 참조가 어느 파일·어느 경로(JSONPath 비슷한 표기)에서 왔는지도 같이 기록해두면, 문제가
// 생겼을 때 에러 메시지로 정확히 어디를 고쳐야 하는지 알려줄 수 있다.
function collectAssetReferences(content: PortfolioSource): AssetReference[] {
  const references: AssetReference[] = [];

  if (content.site.socialImage) {
    references.push({
      assetPath: content.site.socialImage,
      file: "src/content/site.json",
      path: "$.socialImage",
    });
  }

  if (content.profile.photo) {
    references.push({
      assetPath: content.profile.photo.src,
      file: "src/content/profile.json",
      path: "$.photo.src",
    });
  }

  if (content.resume.downloadUrl) {
    references.push({
      assetPath: content.resume.downloadUrl,
      file: "src/content/resume.json",
      path: "$.downloadUrl",
    });
  }

  content.projects.items.forEach((project, projectIndex) => {
    references.push({
      assetPath: project.screenshot.src,
      file: "src/content/projects.json",
      path: `$.items[${projectIndex}].screenshot.src`,
    });
    project.screenshots.forEach((screenshot, screenshotIndex) =>
      references.push({
        assetPath: screenshot.src,
        file: "src/content/projects.json",
        path: `$.items[${projectIndex}].screenshots[${screenshotIndex}].src`,
      }),
    );
  });

  return references;
}

// [INTV:EDGE] 콘텐츠 JSON이 가리키는 이미지/파일 경로(assetPath, 예:
// "/content/projects/foo.png")가 실제로 public/ 디렉터리 아래에 존재하는지 빌드 시점에 검증한다
// — 오타나 빠뜨린 파일 업로드로 배포 후에야 깨진 이미지를 발견하는 걸 막기 위한 체크.
export function validatePortfolioAssets(
  content: PortfolioSource,
  publicRoot: string,
) {
  const issues: ContentValidationIssue[] = [];

  for (const reference of collectAssetReferences(content)) {
    const absoluteAssetPath = resolve(publicRoot, `.${reference.assetPath}`);
    // [INTV:EDGE] relative()로 publicRoot 기준 상대경로를 구한 뒤 ".."로 시작하는지 검사하는
    // 건, assetPath에 "../../etc/passwd" 같은 값이 들어와 public/ 바깥을 가리키는 경로
    // 탈출(path traversal)을 막기 위함 — 파일 존재 여부(existsSync)만 보면 이런 이스케이프를
    // 놓칠 수 있어서(공격자가 실제로 존재하는 시스템 파일 경로를 넣으면 existsSync는 true를
    // 반환한다) 경로 자체도 함께 검증한다.
    const pathFromPublic = relative(publicRoot, absoluteAssetPath);

    if (
      pathFromPublic.startsWith("..") ||
      isAbsolute(pathFromPublic) ||
      !existsSync(absoluteAssetPath)
    ) {
      issues.push({
        file: reference.file,
        path: reference.path,
        message: `Asset "${reference.assetPath}" does not exist under public/.`,
      });
    }
  }

  if (issues.length > 0) {
    throw new PortfolioContentError(issues);
  }

  return content;
}

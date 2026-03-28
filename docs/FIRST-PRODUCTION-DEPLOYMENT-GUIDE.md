# Portfolio 첫 Production 배포 가이드

> 대상 저장소: `/Users/woopinbell/Desktop/working/project/portfolio`<br>
> 확인 기준: `main` / `92197c0c78e3b458b10bb2bba37218d96b2450bb`<br>
> 문서 확인일: 2026-08-31<br>
> 목적: 배포 경험이 없는 운영자가 이 포트폴리오를 실수 없이 처음 공개하고, 이후에도 같은 방식으로 갱신·복구할 수 있게 한다.

이 문서는 단순한 서비스 가입 설명이 아니다. 현재 저장소가 실제로 가진 빌드 계약, 콘텐츠 mode, Docker 산출물, CI 상태와 검색 노출 방식을 기준으로 작성한 절차서다.

현재 코드는 **아직 Production에 배포하면 안 된다.** 화면과 배포 구조는 준비되어 있지만, 공개 콘텐츠가 `Your Name`, `your-handle`, `example-project` 같은 template 값이고 `public/content/`도 없다. 아래의 `STOP` 항목을 먼저 해결해야 한다.

---

## 1. 이 문서를 읽는 방법

- `[ ]`는 사람이 완료한 뒤 체크하는 항목이다.
- `직접 수행`은 계정 로그인, 결제, 도메인 구매처럼 소유자가 해야 하는 작업이다.
- `Codex와 수행 가능`은 저장소 수정·검증을 Codex에게 요청할 수 있는 작업이다.
- `STOP`은 해결 전에는 다음 단계로 넘어가면 안 된다는 뜻이다.
- 명령의 `<...>` 부분은 예시가 아니라 실제 값으로 바꿔야 한다.
- 비밀번호, 복구 코드, 인증 token은 이 문서·Git·채팅·스크린샷에 기록하지 않는다.

한 단계가 이해되지 않으면 추측해서 클릭하지 말고 그 화면에서 멈춘다. 서비스 이름, 화면 제목, 현재 선택값만 알려 주면 이어서 확인할 수 있다. 비밀값은 보내지 않는다.

---

## 2. 이 프로젝트에 맞는 기본 배포 구성

```text
방문자 브라우저
    │ HTTPS
    ▼
사용자 소유 도메인
    │ DNS
    ▼
Render Web Service
    │ 저장소의 Dockerfile로 image build
    ▼
Next.js standalone server
    │
    ├─ src/content/*.json
    ├─ public/content/*
    └─ local fonts / static assets
```

기본 조합은 다음과 같다.

| 역할 | 선택 | 이유 |
| --- | --- | --- |
| source·CI | GitHub | 이미 GitHub Actions workflow가 있다. 단, 현재 branch filter는 수정이 필요하다. |
| application host | Render의 가장 작은 **유료** Docker Web Service | 저장소가 검증하는 Dockerfile, Node `24.18.0`, npm `11.16.0`, non-root runner를 그대로 사용한다. |
| database | 없음 | 이 프로젝트는 DB·migration·persistent server state를 사용하지 않는다. |
| background job | 없음 | worker·queue·cron이 없다. |
| public content | Git에 추적된 JSON과 `public/content/` | CMS나 외부 API 없이 release와 함께 배포한다. |
| TLS | Render managed TLS | custom domain 확인 뒤 인증서를 자동 발급·갱신한다. |
| DNS | 현재 domain provider 또는 Cloudflare DNS | 새 provider로 옮길 필요는 없다. 처음에는 가장 단순한 DNS-only 구성을 권장한다. |
| availability check | Render HTTP health check + 외부 URL monitor | 전용 health route가 없으므로 첫 배포에서는 `/`를 사용한다. |

### Vercel을 기본값으로 선택하지 않은 이유

Vercel은 Next.js를 가장 간단하게 배포할 수 있는 좋은 선택이다. 그러나 이 저장소의 현재 production artifact 계약은 `Dockerfile`과 `.next/standalone` container다. Vercel native build는 이 Docker image를 사용하지 않는다. 또한 Vercel은 Node `24.x` major를 보장하고 minor·patch는 자동 갱신하지만, 저장소는 `24.18.0`을 정확히 고정한다.

따라서 아래 둘 중 하나를 명시적으로 결정하기 전에는 Vercel로 전환하지 않는다.

- exact Docker/Node 계약을 유지한다 → 이 문서의 Render 경로를 따른다.
- Vercel의 platform-managed Node와 native Next.js artifact를 새 운영 계약으로 받아들인다 → 코드·CI·운영 문서를 먼저 변경하고 별도 검증한다.

Cloudflare Workers에 직접 올리는 것도 현재 기본값이 아니다. 현재 저장소에는 OpenNext adapter나 Workers 설정이 없고, 기존 standalone container 검증을 그대로 사용할 수 없다. Cloudflare는 필요하면 DNS provider로만 사용한다.

Render의 `Static Site`도 선택하지 않는다. 이 application은 `?view=`·`?debug=` query를 server에서 해석하고 Next.js standalone server를 실행하는 계약이므로 `Web Service`가 필요하다.

---

## 3. 현재 저장소가 이미 준비한 것

- Next.js `16.2.11` App Router와 React `19.2.4`
- Node `24.18.0`, npm `11.16.0`, lockfile 고정
- `npm ci` 기반 재현 가능한 dependency 설치
- `output: "standalone"` production build
- multi-stage Docker image와 non-root `node` runner
- `0.0.0.0` bind와 platform `PORT`를 받을 수 있는 standalone server
- local font·local public asset 사용
- content schema·cross-reference·asset validation
- 별도의 template/production content readiness 검사
- canonical, Open Graph, robots, sitemap, structured data 생성
- 다섯 renderer와 주요 route의 unit·E2E·axe·Lighthouse 검사
- Docker runtime과 public asset 검사
- GitHub Actions workflow 자체

### 현재 없는 것

- database, migration, backup 대상
- API route, 외부 API credential, server secret
- CMS와 관리자 화면
- contact form POST 처리
- analytics와 실제 사용자 성능 수집
- 전용 `/health` route
- Render Blueprint인 `render.yaml`
- 연결된 Git remote
- 실제 공개 콘텐츠와 `public/content/` 자산

---

## 4. 배포 전 Production STOP 목록

다음 항목은 선택 사항이 아니다. 하나라도 남아 있으면 Render service를 만들지 않는다.

### STOP A — 아직 template 콘텐츠다

현재 production readiness는 실패한다.

- `src/content/site.json`: `Your Name`, social image 없음
- `src/content/profile.json`: `Your Name`, `your-handle`, placeholder portrait
- `src/content/projects.json`: `example-project`, placeholder image·link
- `src/content/links.json`: placeholder GitHub와 email
- `src/content/resume.json`: downloadable resume 없음
- `public/content/`: tracked production asset 없음

완료 조건:

- [ ] 모든 사용자 노출 문구를 사실에 근거한 실제 콘텐츠로 교체했다.
- [ ] 공개할 project가 최소 1개 활성화되어 있다.
- [ ] 각 활성 project에 실제 공개 URL이 최소 1개 있다.
- [ ] profile image, social image, project image, resume를 `public/content/` 아래에 추가했다.
- [ ] 이미지·문서의 공개 권리와 개인정보 노출 범위를 사람이 확인했다.
- [ ] contact 방법이 실제로 작동하며 공개해도 되는 값이다.
- [ ] `PORTFOLIO_CONTENT_MODE=production`과 실제 `SITE_URL`로 readiness가 통과한다.
- [ ] template 값을 전제로 한 test와 runtime 검사도 실제 콘텐츠를 따라가도록 일반화했다.

현재 일부 검사는 production 콘텐츠로 바꾸면 함께 실패하도록 결합되어 있다.

- `src/lib/content-readiness.test.ts`는 현재 checked-in template이 production에서 거부된다고 기대한다.
- `src/lib/site-metadata.test.ts`는 `Your Name`을 직접 기대한다.
- `src/performance/performance-gates.test.ts`는 `/projects/example-project`를 직접 사용한다.
- `scripts/verify-container-runtime.mjs`도 `/projects/example-project`를 smoke한다.

실제 콘텐츠를 넣은 뒤 이 검사를 단순 삭제하지 않는다. checked-in 콘텐츠와 무관한 전용 fixture 또는 현재 활성 project를 안전하게 선택하도록 바꿔서 같은 계약을 계속 검증해야 한다. production readiness와 전체 CI가 동시에 통과하기 전에는 배포하지 않는다.

`Codex와 수행 가능`: 콘텐츠 구조와 자산 경로 수정, schema/readiness 검증.<br>
`직접 수행`: 경력·성과·연락처의 사실성, 초상권, 저작권, 공개 범위 승인.

### STOP B — Git remote가 없다

현재 `git remote -v`는 비어 있다. Render와 GitHub Actions가 같은 release SHA를 사용하려면 먼저 소유자가 관리하는 원격 저장소가 필요하다.

- [ ] GitHub repository를 만들었다.
- [ ] 로컬 `main`과 GitHub `main`이 같은 SHA인지 확인했다.
- [ ] private/public 공개 범위를 결정했다.
- [ ] GitHub 계정에 2FA를 켰고 복구 수단을 안전하게 보관했다.

저장소를 public으로 만들기 전에 Git 전체 이력에도 공개하면 안 되는 파일이나 개인정보가 없음을 확인한다. 현재 checkout만 확인해서는 과거 commit을 증명할 수 없다.

### STOP C — CI가 `main`에서 실행되지 않는다

현재 `.github/workflows/web-portfolio-ci.yml`은 `web/portfolio` push와 그 branch를 대상으로 한 PR에만 반응한다. 현재 branch는 `main`이므로 이 상태에서 Render를 `After CI Checks Pass`로 설정하면 검사 자체가 없거나 배포가 멈출 수 있다.

또한 현재 CI의 기본 build는 template mode다. public release gate는 다음을 명시적으로 보장해야 한다.

- [ ] workflow의 push·pull request branch filter가 실제 production branch인 `main`을 대상으로 한다.
- [ ] CI가 `PORTFOLIO_CONTENT_MODE=production`으로 readiness를 실행한다.
- [ ] CI가 최종 custom origin과 같은 `SITE_URL`을 사용한다.
- [ ] production Docker build에도 두 build argument가 전달된다.
- [ ] container runtime에도 같은 두 환경변수가 전달된다.
- [ ] `quality`, `production`, `container`, 최종 `verify` job이 같은 commit에서 모두 성공한다.
- [ ] GitHub `main` ruleset에서 최종 required check를 지정하고 force push·삭제를 막았다.

`SITE_URL`은 credential이 아니지만 임의의 테스트 주소도 아니다. canonical URL, Open Graph, JSON-LD, robots, sitemap의 기준이 되므로 최종 공개 origin과 정확히 같아야 한다.

### STOP D — README의 운영 문서 링크가 실제 tree에 없다

현재 README가 가리키는 `docs/operations.md`와 여러 `architecture/*.md` 파일은 tracked tree에 존재하지 않는다. CI의 `check-functional`은 documentation-link policy를 제외하므로 이 문제가 release gate에서 드러나지 않는다.

- [ ] 빠진 문서를 복구하거나 README의 잘못된 링크를 제거했다.
- [ ] 공개 README의 모든 local link가 실제 tracked file을 가리킨다.
- [ ] 이 배포 가이드와 실제 저장소 구조가 일치한다.

### STOP E — 공개 보안·debug 정책을 결정하지 않았다

현재 production response에 적용할 명시적인 CSP·security header 정책은 `next.config.ts`에 없다. 또한 `?debug=content`는 방문자에게 `src/content/**` 같은 편집 위치 힌트를 보여준다. 이는 credential을 노출하지 않지만 공개 제품에서 유지할지는 사람의 결정이다.

- [ ] security headers를 구현하거나, 현재 content-only risk에서 플랫폼 기본값을 일시 수용한다는 결정을 기록했다.
- [ ] `?debug=content`를 production에서도 유지할지 제거할지 승인했다.
- [ ] 외부 link의 대상과 안전한 새 창 동작을 검토했다.
- [ ] email·전화번호·이력서에 불필요한 개인정보가 없는지 확인했다.

---

## 5. 먼저 사람이 결정할 항목

한 번 정하면 모든 화면·metadata·DNS에서 같은 값을 사용한다.

| 결정 | 기록할 값 | 주의 |
| --- | --- | --- |
| production branch | `main` 권장 | CI와 Render가 같아야 한다. |
| canonical origin | `https://...` | path와 trailing slash 없이 origin만 사용한다. |
| 대표 host | root 또는 `www` | 둘 중 하나만 canonical로 선택한다. |
| Render region | 주 방문자와 가까운 곳 | 한국 방문자 중심이면 dashboard에서 현재 제공 region을 확인한다. |
| Render compute | 가장 작은 paid Web Service부터 시작 | Free는 idle spin-down 때문에 첫 방문이 오래 걸려 portfolio에 부적합하다. |
| Render workspace plan | solo 운영에 맞는 plan | 서비스 compute 비용과 workspace 기능은 별도일 수 있으므로 결제 화면의 현재 금액을 확인한다. |
| preview 방식 | CI-only 또는 짧은 Service Preview | paid preview는 실행 시간만큼 비용이 발생한다. |
| repository visibility | private/public | 전체 Git 이력과 license를 함께 검토한다. |

비용 화면에서는 반드시 다음을 확인한다.

- [ ] 월 고정 비용과 사용량 기반 비용을 구분했다.
- [ ] Free Web Service를 Production으로 선택하지 않았다.
- [ ] Service Preview를 켤 경우 같은 compute 비용이 추가될 수 있음을 이해했다.
- [ ] 결제 알림을 받을 이메일을 확인했다.
- [ ] 처음에는 instance 1개, disk 없음, DB 없음, cron 없음으로 설정했다.

---

## 6. 계정 준비

### 6.1 GitHub — 직접 수행

- [ ] 본인 소유 계정으로 로그인한다.
- [ ] 2FA 또는 passkey를 활성화한다.
- [ ] 복구 코드는 password manager나 오프라인 보관소에 저장한다.
- [ ] 새 repository를 만들 때 README·`.gitignore`·license를 자동 생성하지 않는다. 로컬에 이미 history가 있기 때문이다.
- [ ] Render에는 필요한 repository 하나만 접근하도록 GitHub App 권한을 제한한다.

GitHub의 새 repository 화면에서 표시되는 URL을 복사한 뒤 별도 승인된 작업으로 연결한다.

```sh
git remote add origin <GitHub가-표시한-repository-URL>
git remote -v
git push -u origin main
```

`--force`를 붙이지 않는다. 그 다음 GitHub의 `Code` 화면에서 최근 commit SHA와 로컬 값을 대조한다.

```sh
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

원격 연결과 push는 외부 상태를 바꾸므로 이 문서를 작성하는 과정에서는 수행하지 않는다.

### 6.2 Render — 직접 수행

- [ ] GitHub 연동으로 Render 계정을 만든다.
- [ ] Render 계정의 2FA를 활성화한다.
- [ ] 복구 코드를 안전하게 저장한다.
- [ ] 혼자 운영하면 개인/solo workspace를 선택한다.
- [ ] billing 화면에서 paid Web Service의 현재 금액과 결제 통화를 확인한다.
- [ ] workspace notification email이 실제 확인 가능한 주소인지 확인한다.

### 6.3 도메인·DNS — 직접 수행

- [ ] 소유권과 자동 갱신 상태를 확인한다.
- [ ] registrar 계정에도 2FA를 켠다.
- [ ] domain lock과 복구 이메일을 확인한다.
- [ ] 기존 mail용 MX·TXT·DKIM·DMARC record를 기록한다.
- [ ] portfolio 연결 때문에 기존 email DNS record를 삭제하지 않는다.

도메인을 아직 사지 않았다면 상표·이름·개인정보 노출을 사람이 검토한 뒤 구매한다. Codex가 임의로 이름을 정하거나 구매하지 않는다.

---

## 7. Release candidate를 코드에서 고정한다

이 단계는 Render dashboard를 열기 전에 끝낸다.

### 7.1 콘텐츠와 자산

- [ ] 모든 JSON이 schema를 통과한다.
- [ ] 실제 자산은 `public/content/` 아래에 있고 Git에 추적되어 있다.
- [ ] image의 alt text가 실제 내용을 설명한다.
- [ ] resume PDF에 주소·전화·서명 등 불필요한 개인정보가 없는지 확인한다.
- [ ] project link가 로그인 없이 열리는지 확인한다.
- [ ] private repository link를 공개 project link로 표시하지 않는다.
- [ ] inactive project가 sitemap과 화면에 섞이지 않는지 확인한다.

### 7.2 필수 검증

실제 domain을 정한 뒤, 비밀값 없이 다음 환경으로 검증한다.

```sh
PORTFOLIO_CONTENT_MODE=production \
SITE_URL="https://<최종-canonical-domain>" \
make content-ready

PORTFOLIO_CONTENT_MODE=production \
SITE_URL="https://<최종-canonical-domain>" \
make check
```

`make check`는 schema·lint·type·unit 검사를 실행하지만 production readiness 자체를 포함하지 않는다.
따라서 앞의 `make content-ready`를 생략하지 않는다. 뒤의 production build도 `prebuild`에서 readiness를
다시 실행해 동일한 공개 후보를 이중 확인한다.

그 다음 production build와 artifact를 검증한다.

```sh
PORTFOLIO_CONTENT_MODE=production \
SITE_URL="https://<최종-canonical-domain>" \
npm run build

npm run build:verify
npm run bundle:check
```

browser와 Docker 환경까지 확인한다.

```sh
PORTFOLIO_CONTENT_MODE=production \
SITE_URL="https://<최종-canonical-domain>" \
npm run test:e2e:production
```

현재 `test:container` script는 내부 `docker build`에 production build argument를 전달하지 않는다. 지금 환경변수를 앞에 붙여 실행해도 template image만 확인한다. **production build argument와 runtime environment를 모두 받도록 검사 script를 먼저 고친 뒤**, 수정된 사용법에 따라 `npm run test:container`를 성공시켜야 한다.

검증 중 생성되는 `.next/`, report, log는 release artifact가 아니다. Git에는 source, lockfile, tests, 실제 public content만 기록한다.

### 7.3 release 기록

- [ ] 최종 commit SHA를 기록한다.
- [ ] `git status`가 clean이다.
- [ ] local `main`과 GitHub `main`의 SHA가 같다.
- [ ] GitHub Actions의 모든 필수 job이 성공했다.
- [ ] 최종 콘텐츠·이미지·resume를 사람이 실제 화면에서 승인했다.

---

## 8. Render Web Service 만들기

**여기서부터 외부 상태가 변경되고 비용이 발생할 수 있다. 모든 STOP을 해결한 뒤 직접 수행한다.**

Render dashboard에서 다음 순서로 이동한다.

1. `New`를 누른다.
2. `Web Service`를 선택한다.
3. GitHub repository를 선택한다.
4. 아래 값을 한 줄씩 대조한다.

| Render field | 설정 |
| --- | --- |
| Name | 사람이 식별하기 쉬운 portfolio service 이름 |
| Project | 이 portfolio 전용 project |
| Environment | Production |
| Branch | `main` |
| Region | 앞에서 승인한 region |
| Language | `Docker` |
| Root Directory | 비움; 이 저장소 자체가 root이기 때문 |
| Dockerfile Path | `./Dockerfile` |
| Docker Build Context Directory | `.` |
| Docker Command | 비움; image의 `CMD ["node", "server.js"]` 사용 |
| Compute | 가장 작은 paid web compute |
| Instance count | `1` |
| Health Check Path | `/` |
| Auto-Deploy | 첫 배포는 `Off` |
| Persistent Disk | 추가하지 않음 |

### 8.1 환경변수

두 값만 추가한다.

| key | value | secret인가? | build/runtime |
| --- | --- | --- | --- |
| `PORTFOLIO_CONTENT_MODE` | `production` | 아니오 | 둘 다 |
| `SITE_URL` | 최종 canonical origin | 아니오 | 둘 다 |

예시는 복사하지 않는다. `SITE_URL`에는 실제 소유 domain을 넣는다.

```text
PORTFOLIO_CONTENT_MODE=production
SITE_URL=https://<최종-canonical-domain>
```

다음 값은 추가하지 않는다.

- `NEXT_PUBLIC_SITE_URL`: 현재 코드가 사용하지 않으며 브라우저 bundle 경계를 불필요하게 넓힌다.
- `PORT`: Render가 제공한다. Docker image의 기본 `3100`보다 platform 값이 우선한다.
- API key·database URL: 이 프로젝트에는 필요 없다.
- `.env` 파일 전체: 필요하지 않은 값을 한꺼번에 올리지 않는다.

Render는 Docker service 환경변수를 같은 이름의 build argument로도 전달한다. 현재 Dockerfile은 두 non-secret 값을 `ARG`로 받아 production readiness와 build metadata에 사용한다.

Dockerfile의 final runner stage에는 두 값을 image 기본값으로 굽지 않는다. 이것은 잘못이 아니다. Render가 같은 service environment를 runtime에도 주입해야 `robots`, `sitemap`, structured data가 production mode로 동작한다. build에서만 또는 runtime에서만 설정하면 서로 다른 결과가 되므로 두 시점을 함께 확인한다.

### 8.2 생성 직전 마지막 확인

- [ ] repository와 branch가 맞다.
- [ ] Docker runtime을 선택했다.
- [ ] Free가 아니라 paid compute다.
- [ ] `SITE_URL` 철자, `https://`, host가 정확하다.
- [ ] environment에 placeholder나 credential이 없다.
- [ ] disk·database·cron을 만들지 않았다.
- [ ] 첫 Auto-Deploy는 Off다.

그 다음에만 `Create Web Service`를 누른다.

---

## 9. 첫 build와 start 로그 확인

Render `Events`에서 첫 deploy를 연다. 비밀값을 log나 지원 요청에 복사하지 않는다.

성공 build에는 최소한 다음 의미가 있어야 한다.

- locked dependency graph 설치 성공
- `Content valid`
- `Production readiness valid for <canonical origin>`
- Next.js production build 성공
- standalone `server.js`와 static directory 검증 성공
- final image 생성 성공
- `node` 사용자로 server start 성공
- Render가 주입한 port에서 HTTP 응답 성공
- `/` health check가 2xx 또는 3xx

다음 중 하나면 `STOP`한다.

- `Content mode: template`가 보인다.
- readiness가 skipped되었다.
- placeholder 또는 `public/template/`이 production 자산으로 사용된다.
- `SITE_URL` 누락·오타 오류가 난다.
- platform port에 bind하지 못한다.
- root 사용자로 실행하기 위해 Dockerfile을 임의 변경하라는 해결책만 남는다.
- lockfile을 무시하고 `npm install`을 다시 하라고 제안한다.

실패했으면 dashboard에서 값을 즉흥적으로 바꿔 여러 번 재배포하지 않는다. 실패 원인과 commit SHA를 기록하고 저장소에서 재현·수정한 뒤 새 commit으로 다시 검증한다.

---

## 10. `onrender.com` 주소에서 공개 전 smoke

첫 deploy의 `onrender.com` 주소는 임시 origin 확인용이다. application metadata의 canonical은 이미 최종 `SITE_URL`이어야 한다.

### 10.1 기본 route

- [ ] `/`가 200이고 실제 이름·소개를 표시한다.
- [ ] `/projects`가 200이고 실제 project를 표시한다.
- [ ] `/projects/<실제-project-id>`가 200이다.
- [ ] `/about`, `/resume`, `/contact`, `/journey`, `/interview-map` 중 활성 route가 모두 열린다.
- [ ] 존재하지 않는 route는 의도한 404 화면을 표시한다.
- [ ] profile image, project image, font, resume download가 모두 200이다.

### 10.2 다섯 renderer

최소 home과 대표 project detail에서 모두 확인한다.

```text
?view=design
?view=classic
?view=editorial
?view=brutalist
?view=cinematic
```

- [ ] renderer를 바꿔도 콘텐츠 의미와 route가 유지된다.
- [ ] mobile width에서 가로 overflow가 없다.
- [ ] keyboard로 skip link와 주요 navigation을 사용할 수 있다.
- [ ] 실제 긴 이름·project title·한국어가 잘리지 않는다.

### 10.3 검색·metadata

- [ ] HTML canonical이 최종 custom domain을 가리킨다.
- [ ] Open Graph image URL이 최종 domain이고 200이다.
- [ ] `/robots.txt`가 production allow 정책과 sitemap URL을 가진다.
- [ ] `/sitemap.xml`이 최종 domain과 활성 route만 포함한다.
- [ ] project detail에 실제 project metadata와 structured data가 있다.
- [ ] 화면·HTML·metadata 어디에도 `Your Name`, `your-handle`, `example-project`, placeholder가 없다.

### 10.4 debug 결정 확인

`/?debug=content`를 직접 확인한다.

- 유지하기로 승인했다면: credential이나 사용자 데이터 없이 편집 위치만 표시하는지 확인한다.
- 제거하기로 승인했다면: production에서 debug UI가 렌더링되지 않는지 확인한다.

이 단계가 실패하면 DNS를 바꾸지 않는다.

---

## 11. Custom domain과 TLS 연결

### 11.1 Render에 domain 추가

1. Web Service의 `Settings`를 연다.
2. `Custom Domains`로 이동한다.
3. 앞에서 정한 canonical domain을 추가한다.
4. Render가 화면에 제시한 DNS record를 그대로 기록한다.

root domain과 `www`를 모두 사용할 경우 한쪽을 canonical로 정한다. Render가 만드는 redirect 방향이 `SITE_URL`과 같은지 확인한다.

### 11.2 DNS provider에서 record 변경

- [ ] 기존 DNS record를 먼저 캡처하거나 별도 안전한 운영 기록에 보관한다.
- [ ] Render 화면에 표시된 host·type·target을 정확히 입력한다.
- [ ] 같은 host의 충돌하는 A/AAAA/CNAME을 확인한다.
- [ ] Render 안내에 따라 설정 중 충돌하는 AAAA record를 제거한다.
- [ ] mail용 MX·TXT record는 건드리지 않는다.
- [ ] CAA를 사용 중이면 `letsencrypt.org`와 `pki.goog` 허용 여부를 확인한다.

Cloudflare DNS를 쓴다면 처음에는 proxy를 끈 DNS-only 상태로 연결·인증한다. Render 자체가 TLS와 DDoS 경계를 제공하므로 첫 배포에 Cloudflare proxy를 추가해 문제 지점을 늘릴 이유가 없다. 나중에 proxy를 켜려면 cache, redirect, TLS, client IP, analytics 경계를 별도 검증한다.

### 11.3 Render에서 검증

- [ ] `Verify`를 눌러 domain 소유 확인을 통과한다.
- [ ] TLS certificate가 issued/active 상태다.
- [ ] `http://` 요청이 `https://`로 이동한다.
- [ ] 대표 host가 아닌 root 또는 `www`가 canonical host로 한 번만 redirect된다.
- [ ] redirect loop가 없다.

DNS 전파가 늦으면 record를 반복해서 삭제·재생성하지 않는다. 입력값을 다시 대조하고 기다린다.

### 11.4 `SITE_URL` 최종 대조

실제 브라우저 주소와 `SITE_URL`이 한 글자라도 다르면 트래픽을 열지 않는다.

값을 고쳤다면 environment 변경만으로 기존 image가 바뀌지 않는다고 가정한다. 새 deploy를 실행하고 build·metadata·robots·sitemap을 다시 검증한다.

---

## 12. Production traffic 전환

이 프로젝트는 DB가 없으므로 traffic switch는 DNS와 Render routing만 포함한다.

- [ ] 배포 SHA와 GitHub `main` SHA가 같다.
- [ ] custom domain TLS가 정상이다.
- [ ] custom domain에서 Section 10 smoke를 다시 통과했다.
- [ ] 외부 link, email, resume download를 실제 사용자처럼 확인했다.
- [ ] mobile과 desktop에서 대표 화면을 사람이 승인했다.
- [ ] Render failure notification을 켰다.
- [ ] 외부 monitor가 HTTPS `/`를 확인하도록 등록되어 있다.

기존 사이트가 같은 domain을 사용 중이면 DNS를 바꾸기 전에 이전 record와 이전 서비스 복구 절차를 기록한다. 새 사이트가 정상임을 확인하기 전에는 이전 서비스를 삭제하지 않는다.

모든 확인 뒤에만 새 domain을 공개한다.

원한다면 custom domain 안정화 후 Render의 기본 `onrender.com` subdomain을 비활성화해 canonical origin을 하나로 줄일 수 있다. 비활성화 전에는 외부 monitor가 custom domain을 사용하도록 먼저 바꾼다.

---

## 13. CI와 자동 배포 연결

첫 배포와 smoke가 끝난 뒤에만 자동화를 켠다.

### GitHub `main` 보호

GitHub repository에서 `Settings` → `Rules` → `Rulesets`로 이동해 `main` 대상 branch ruleset을 만든다. 개인 계정·repository 공개 범위에 따라 표시되는 기능이 다르면 가능한 보호 수준을 기록한다.

- [ ] direct force push 금지
- [ ] branch deletion 금지
- [ ] pull request 경유
- [ ] required final check: workflow의 최종 `verify`
- [ ] 필요하면 branch 최신화 요구

### Render 설정

Web Service `Settings`의 Auto-Deploy를 다음으로 바꾼다.

```text
After CI Checks Pass
```

이 설정은 CI가 `main` commit에서 실제로 생성되는 것이 확인된 후에만 사용한다. Render는 check가 하나도 감지되지 않으면 배포하지 않는다.

완료 확인:

- [ ] 작은 문서 변경을 feature branch에서 PR로 만든다.
- [ ] GitHub Actions가 실행된다.
- [ ] 실패한 check에서는 merge와 deploy가 모두 막힌다.
- [ ] 성공 후 `main`에 merge했을 때 Render가 같은 SHA를 배포한다.
- [ ] 새 instance가 `/` health check를 통과한 뒤 traffic을 받는다.

### Preview 선택지

비용을 줄이는 기본 흐름은 local production E2E + GitHub Actions다. 공개 URL 검토가 꼭 필요할 때만 Render Service Preview를 짧게 사용한다.

Service Preview를 켜는 경우:

- [ ] Preview가 base service와 같은 Docker build를 사용한다.
- [ ] production content mode와 canonical `SITE_URL`을 유지한다.
- [ ] Render가 preview 응답에 `X-Robots-Tag: noindex`를 설정하는지 확인한다.
- [ ] 개인정보가 포함된 미공개 콘텐츠는 preview URL에도 올리지 않는다.
- [ ] 검토가 끝나면 preview를 닫고 비용 발생 상태를 확인한다.

---

## 14. Monitoring과 알림

### Render 내부

- [ ] workspace 또는 service notification을 최소 `Only failure notifications`로 설정한다.
- [ ] build/deploy failure, unhealthy 상태 이메일을 실제로 받을 수 있다.
- [ ] Metrics에서 memory·CPU·response 상태의 평소 범위를 확인한다.
- [ ] log에 credential·개인정보·contact query를 추가하지 않는다.

### 외부 monitor

Render 내부 health check만으로 DNS·TLS·외부 routing 장애까지 확인할 수는 없다. 무료 또는 유료 외부 uptime monitor 하나를 정해 다음을 확인한다.

- URL: 최종 `https://<canonical-domain>/`
- method: GET 또는 HEAD
- expected: 2xx 또는 의도한 redirect 후 200
- alert destination: 실제 확인하는 email

이 사이트는 API나 DB가 없으므로 복잡한 synthetic transaction부터 만들 필요는 없다. 월 1회 사람이 resume와 대표 project link를 확인하는 것이 더 중요하다.

---

## 15. Rollback 절차

문제가 생겼을 때 원인 분석보다 먼저 정상 화면을 복구한다.

### 15.1 application rollback

1. Render Web Service의 `Events`를 연다.
2. 마지막 정상 deploy와 commit SHA를 확인한다.
3. 해당 deploy의 `Rollback`을 선택한다.
4. 확인 화면에서 대상 SHA를 다시 대조한다.
5. rollback을 실행한다.
6. custom domain에서 `/`, 대표 project, asset, robots를 smoke한다.
7. 외부 monitor가 정상으로 돌아왔는지 확인한다.

Render rollback은 과거 build artifact를 재사용한다. 그러나 rollback 뒤에도 이후 push가 다시 잘못된 commit을 배포할 수 있으므로 원인을 해결할 때까지 Auto-Deploy를 `Off`로 바꾼다.

### 15.2 콘텐츠 rollback

콘텐츠는 DB가 아니라 Git commit 안에 있다. JSON만 dashboard에서 고치는 복구 방식은 없다.

- 마지막 정상 commit으로 Render rollback
- 잘못된 content commit은 새 revert/fix commit으로 수정
- readiness·CI 통과
- 새 deploy

Git history를 force push하거나 정상 commit을 지우지 않는다.

### 15.3 domain rollback

Render 자체는 정상인데 domain만 실패하면 이전 DNS record로 되돌린다. 이 때문에 traffic switch 전에 이전 record를 보관해야 한다.

TLS 발급 문제를 우회하려고 인증서를 직접 복사하거나 HTTP를 공개하지 않는다.

---

## 16. 반복 운영 절차

### 콘텐츠나 코드 변경 때마다

1. feature branch에서 수정한다.
2. 실제 자산과 JSON reference를 함께 수정한다.
3. production mode `make content-ready`와 `make check`를 실행한다.
4. production E2E·build artifact·bundle을 확인한다.
5. PR에서 GitHub Actions를 통과한다.
6. preview가 필요하면 짧게 검토한다.
7. `main`에 merge한다.
8. Render가 같은 SHA를 배포했는지 확인한다.
9. custom domain smoke를 수행한다.

### 매주

- [ ] home과 대표 project가 열린다.
- [ ] contact link와 resume download가 작동한다.
- [ ] Render service가 healthy다.
- [ ] 최근 deploy failure 알림을 놓치지 않았다.

### 매월

- [ ] domain 만료일·자동 갱신·결제 수단을 확인한다.
- [ ] Render 사용량·청구액을 확인한다.
- [ ] 외부 project link가 dead link가 아닌지 확인한다.
- [ ] sitemap의 project 목록이 현재 공개 범위와 같다.
- [ ] public resume와 profile에 오래된 정보가 없는지 검토한다.
- [ ] dependency update와 보안 공지를 검토한다.

### 분기마다

- [ ] 계정 member와 GitHub App 권한을 검토한다.
- [ ] 2FA recovery 수단을 확인한다.
- [ ] rollback 대상을 찾고 절차를 dry review한다.
- [ ] 다섯 renderer의 대표 desktop/mobile 화면을 확인한다.
- [ ] stored Lighthouse baseline과 현재 사용 경험 차이를 검토한다.

---

## 17. 이 가이드가 무효가 되는 변경

다음 기능을 추가하면 그대로 배포하지 말고 운영 설계를 다시 한다.

- contact form POST 또는 API route
- authentication·session·cookie 기반 개인화
- CMS·database·object storage
- analytics·tracking·consent banner
- 외부 API key를 사용하는 server fetch
- 사용자 upload
- scheduled job이나 webhook
- Cloudflare proxy/cache rule
- Vercel native build 또는 다른 runtime으로 이전
- 다중 instance에서 공유해야 하는 filesystem state

이런 변경은 secret scope, 개인정보, rate limit, backup, migration, health check와 장애 복구를 새로 요구한다.

---

## 18. 즉시 멈추고 도움을 요청할 상황

- build log에 credential이나 개인 secret이 보인다.
- `Content mode: template`인데 deploy가 성공했다.
- production 화면에 `Your Name`, `example-project`, placeholder가 보인다.
- GitHub Actions가 `main` commit에서 실행되지 않는다.
- Render가 CI check 0개를 감지해 deploy하지 않는다.
- 실제 domain과 `SITE_URL`이 다르다.
- robots가 production에서 전체 차단되거나 preview가 색인 가능하다.
- social image·resume가 404다.
- DNS 변경 후 기존 email이 중단된다.
- TLS가 발급되지 않아 HTTP 공개를 고려하게 된다.
- 비용 화면이 예상과 다르다.
- dashboard에서 값을 고쳤지만 어느 commit과 연결되는지 모른다.
- 해결책이 force push, history 삭제, secret 공유를 요구한다.

도움을 요청할 때 보내도 되는 정보:

- 서비스와 화면 이름
- 실패한 단계
- 오류 메시지에서 secret을 제거한 부분
- commit SHA
- HTTP status와 문제가 난 public path

보내면 안 되는 정보:

- password, recovery code, access token
- Render deploy hook URL
- registrar 인증 정보
- 아직 공개하지 않은 개인정보 문서 원문
- `.env` 내용

---

## 19. 첫 배포 완료 판정

아래가 모두 참일 때만 “Production 배포 완료”라고 기록한다.

- [ ] template marker가 모두 제거되었다.
- [ ] production asset이 `public/content/`에서 제공된다.
- [ ] production readiness가 실제 canonical origin으로 통과했다.
- [ ] GitHub remote와 보호된 `main`이 있다.
- [ ] CI가 `main`에서 production mode로 모든 필수 gate를 통과한다.
- [ ] README의 broken operational links가 정리되었다.
- [ ] Render는 paid Docker Web Service이고 exact release SHA를 실행한다.
- [ ] `/` health check가 정상이다.
- [ ] custom domain과 managed TLS가 정상이다.
- [ ] canonical, Open Graph, robots, sitemap이 같은 origin을 사용한다.
- [ ] 모든 활성 route와 다섯 renderer의 대표 화면이 정상이다.
- [ ] profile/project/resume asset이 정상이다.
- [ ] failure notification과 외부 monitor가 켜져 있다.
- [ ] 마지막 정상 deploy로 rollback하는 위치를 알고 있다.
- [ ] 실제 콘텐츠와 공개 범위를 사람이 승인했다.

---

## 20. 배포 기록 양식

다음 표를 issue, private 운영 문서 또는 release note에 복사해 사용한다. credential은 기록하지 않는다.

| 항목 | 기록 |
| --- | --- |
| 배포 일시 |  |
| 운영자 |  |
| Git commit SHA |  |
| GitHub Actions run |  |
| Render deploy ID 또는 dashboard link |  |
| canonical `SITE_URL` |  |
| custom domain TLS 확인 |  |
| smoke 결과 |  |
| 외부 monitor 확인 |  |
| 직전 정상 deploy |  |
| 특이사항·승인 |  |

---

## 21. 공식 참고 문서

플랫폼 화면과 가격은 바뀔 수 있다. 실행 당일 아래 공식 문서를 다시 확인한다.

- [Render Docker](https://render.com/docs/docker)
- [Render Web Services](https://render.com/docs/web-services)
- [Render deploy와 CI 연동](https://render.com/docs/deploys)
- [Render health checks](https://render.com/docs/health-checks)
- [Render custom domains](https://render.com/docs/custom-domains)
- [Render managed TLS](https://render.com/docs/tls)
- [Render rollback](https://render.com/docs/rollbacks)
- [Render notification](https://render.com/docs/notifications)
- [Render Free 제한](https://render.com/docs/free)
- [Render pricing](https://render.com/pricing)
- [GitHub protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [Vercel Next.js 지원](https://vercel.com/docs/frameworks/full-stack/nextjs)
- [Vercel Node.js version 정책](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)

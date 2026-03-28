# 멀티 스테이지 빌드: 하나의 Dockerfile 안에서 "빌드용 환경"과 "실행용 환경"을 분리해,
# 최종 이미지에는 소스/개발 의존성 없이 실행에 필요한 산출물만 남긴다 (이미지 크기 축소 + 공격 표면 축소 목적)
FROM node:24.18.0-bookworm-slim AS dependencies

RUN npm install --global npm@11.16.0
WORKDIR /app
COPY package.json package-lock.json ./
# package-lock.json 기준으로 정확히 고정된 버전만 설치 (npm install과 달리 lock 파일 갱신 없이 재현 가능한 설치를 보장)
RUN npm ci

# 이전 단계(dependencies)를 그대로 이어받는 스테이지 — node_modules를 다시 설치하지 않고 재사용
FROM dependencies AS builder

# ARG: 빌드 시점에만 주입되는 값 (docker build --build-arg로 전달, 이미지에는 남지 않음)
# ENV: 컨테이너 실행 중에도 유지되는 환경변수 — 여기서는 ARG 값을 ENV로 승격해 build 스크립트가 참조할 수 있게 함
ARG PORTFOLIO_CONTENT_MODE=template
ARG SITE_URL
ENV PORTFOLIO_CONTENT_MODE=$PORTFOLIO_CONTENT_MODE
ENV SITE_URL=$SITE_URL
COPY . .
RUN npm run build && npm run build:verify

# 실행 전용 최종 스테이지 — builder의 중간 산출물(소스, devDependencies)은 여기로 넘어오지 않는다
FROM node:24.18.0-bookworm-slim AS runner

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3100
WORKDIR /app
# 기본값인 root 대신 미리 만들어진 비루트 사용자로 전환 — 컨테이너가 탈취되어도 권한을 제한하기 위한 보안 관례
USER node
# --from=builder: 앞선 builder 스테이지의 결과물만 선택적으로 복사 (해당 스테이지의 소스 전체가 아님)
# Next.js standalone 출력은 실행에 필요한 node_modules까지 자체적으로 번들링한 최소 서버 산출물
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

EXPOSE 3100
CMD ["node", "server.js"]

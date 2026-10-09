# Build from the repo root: docker build -f apps/api/Dockerfile .
FROM node:22-alpine
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @tc/api...
COPY packages/core packages/core
COPY apps/api apps/api
ENV NODE_ENV=production
WORKDIR /repo/apps/api
USER node
EXPOSE 4000
CMD ["node", "--import", "tsx", "src/index.ts"]

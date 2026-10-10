# Build from the repo root: docker build -f agent/Dockerfile -t <acr>/rkjh-agent:<tag> .
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY api/package.json api/
COPY agent/package.json agent/
COPY web/package.json web/
RUN npm ci --workspace agent --workspace api --include-workspace-root --no-audit --no-fund
COPY api/src api/src
COPY agent agent
RUN npm run build -w agent

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PROMPTS_DIR=/app/prompts
COPY package.json package-lock.json ./
COPY api/package.json api/
COPY agent/package.json agent/
COPY web/package.json web/
RUN npm ci --omit=dev --workspace agent --workspace api --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/agent/dist agent/dist
COPY prompts prompts
USER node
CMD ["node", "agent/dist/agent.js", "start"]

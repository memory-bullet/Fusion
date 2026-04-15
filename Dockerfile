# 可选：单容器运行（SQLite，数据在卷内）。生产更推荐托管 Postgres + Vercel/Railway 等。
# 国内若无法访问 Docker Hub，构建时指定镜像，例如：
# docker build --build-arg NODE_IMAGE=docker.m.daocloud.io/library/node:20-alpine -t litprincess/fusion:latest .
# 或在 Docker Desktop → Settings → Docker Engine 中配置 registry-mirrors（见 docs/sealos-deploy.md）
ARG NODE_IMAGE=node:20-alpine
FROM ${NODE_IMAGE} AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 仓库可无 public/，Next 亦允许空目录；保证 runner 阶段能 COPY
RUN mkdir -p public
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL="file:/app/data/dev.db"
# 与数据库同卷，避免容器重启后上传文件丢失（部署时挂载整个 /app/data）
ENV UPLOAD_DIR=/app/data/uploads

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs \
  && apk add --no-cache su-exec
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/next.config.ts ./

COPY scripts/docker-entry.sh /docker-entry.sh
# Windows 工作区常为 CRLF；去掉 \r 避免容器内脚本报错
RUN sed -i 's/\r$//' /docker-entry.sh && chmod +x /docker-entry.sh && chown -R nextjs:nodejs /app

# 以 root 进入口脚本：K8s 挂卷多为 root 属主，需 chown 后再 su-exec 为 nextjs（否则 SQLite 无法建库）
EXPOSE 3000
ENTRYPOINT ["/bin/sh", "/docker-entry.sh"]

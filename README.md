# Fusion Space MVP

A Notion-style, white-theme, mobile-first collaboration hub with AI context parsing, auto task allocation, warning escalation, crisis reallocation, and contribution report.

## Stack

- Next.js 15 + TypeScript + Tailwind CSS
- Prisma ORM + **SQLite**（本地默认，零配置）/ 可选 **PostgreSQL**（Docker 或托管库）
- OpenAI-compatible **Chat Completions** API

## 本地开发（推荐）

1. Node.js **20+**
2. `cp .env.example .env`（Windows 可手动复制），填写 `OPENAI_API_KEY`（使用 AI 时）
3. 执行：

```bash
npm install
npx prisma migrate deploy
npm run dev
```

浏览器打开终端里提示的地址（注意端口，如 `http://localhost:3000`）。

### 常见问题

- **报错 `The column ... progressDigest does not exist` 或 Task 新字段不存在**：本地库落后于 `schema.prisma`。请先**停止** `npm run dev`，再执行 `npx prisma migrate deploy`（或开发时用 `npx prisma db push`），然后 `npx prisma generate`，再启动 dev。
- **接口报错 / 页面空白 / Prisma P1001**：`.env` 里若写了 `postgresql://...` 但本机没有跑 Postgres，会连不上库。请改回 `DATABASE_URL="file:./dev.db"` 或先启动数据库。
- **迁移失败 P3018 / 表已存在**：本地 SQLite 状态异常时执行（**会清空本地数据**）：

```bash
npm run db:reset
```

然后再次 `npx prisma migrate deploy`。

## 公网部署

目标：让任意人在浏览器里打开你的站点即可注册、建项目、用 AI（需你配置好 LLM 密钥）。

**想更少运维**：可用 **Sealos** 等托管平台，网页里填镜像 + 持久卷即可，见 **`docs/sealos-deploy.md`**。

### 方案 A：Docker 单容器 + SQLite（最快上线）

仓库根目录 `Dockerfile` 已配置：`DATABASE_URL=file:/app/data/dev.db`、`UPLOAD_DIR=/app/data/uploads`，启动时执行 `prisma migrate deploy` 再 `next start`。

1. 准备一台有公网 IP 的机器（云厂商轻量应用服务器、VPS 等）或使用 **Railway / Fly.io / Render** 等支持 **Docker + 持久卷** 的平台。
2. 构建并运行（示例，按平台改端口/卷名）：

```bash
docker build -t fusion .
docker run -d --name fusion -p 3000:3000 \
  -v fusion_data:/app/data \
  -e OPENAI_API_KEY=... \
  -e OPENAI_BASE_URL=... \
  -e OPENAI_MODEL=... \
  -e NEXT_PUBLIC_APP_URL=https://你的域名 \
  fusion
```

3. **必须挂卷**：把宿主或平台的卷挂载到容器内 **`/app/data`**，否则重启后数据库与上传文件都会丢。
4. 在平台「环境变量 / Secrets」中填写 `.env.example` 里你实际用到的项（至少：LLM 相关；若用邮件通知再配 `NEXT_PUBLIC_APP_URL` 与 Resend/SMTP）。
5. 前面板 / 负载均衡把 **HTTPS** 指到容器的 `3000`（或平台分配的端口）。

**安全提示**：公测阶段任何人可注册；正式对外前请评估是否需要邀请制、验证码或访问控制。

### 方案 B：Vercel 等 Serverless

默认 **SQLite + 本地 `uploads/`** 不适合无状态部署（文件系统不可依赖）。若要坚持 Vercel：需 **PostgreSQL**（如 Neon）+ **对象存储**（如 S3/R2）并改上传逻辑，工作量较大；更省事请用方案 A。

### 方案 C：PostgreSQL（长期正式环境）

使用 Neon / Supabase / RDS 等，在部署平台配置 `DATABASE_URL`；将 `schema.prisma` 的 `provider` 改为 `postgresql`，用 `prisma migrate diff` 生成 Postgres 迁移（勿与 SQLite 迁移混用同一 history）。`docker-compose.yml` 里的 `db` 仅供本地开发。

## Key API Routes

- `POST /api/projects` · `POST /api/projects/join` · `POST /api/auth/register` · `POST /api/auth/login` · `PATCH /api/auth/me` · `GET /api/me/overview`
- `POST /api/projects/:id/ai-parse` · `PATCH /api/tasks/:id/status` · `POST /api/tasks/:id/reallocate`
- `GET /api/projects/:id/dashboard` · `GET /api/projects/:id/report`

## Notes

- 任务终态 `DONE`、`REALLOCATED` 不可再流转。
- 再分配会按工作量扣减原负责人信用分（有上下限）。
- 勿将 `.env` 提交到 Git。

## Cursor：UI 风格

仓库内 `.cursor/rules/preserve-ui-style.mdc` 与根目录 `DESIGN.md` 约定 UI 定稿；**修改功能时不得擅自换风格**，除非在对话中明确要求改版。

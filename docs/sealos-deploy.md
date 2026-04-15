# 用 Sealos 快速把 Fusion 挂到公网

比自建 ECS 更省事：**不用装 Docker 守护进程、不用配 Nginx**，在网页里创建应用即可。前提是你有一个可拉取的 **Docker 镜像**（见下文第 1 步）。

官方控制台：<https://cloud.sealos.run/>  
部署相关说明可参考：[部署上线](https://sealos.run/docs/guides/fundamentals/deploy)、[应用管理](https://sealos.run/docs/guides/app-launchpad)、[持久化存储](https://sealos.run/docs/guides/app-launchpad/persistent-volume)。

---

## 国内网络：`auth.docker.io` / `connectex` / 拉不下 `node:20-alpine`

**方式 A（推荐）：Docker Desktop 配镜像加速**

1. **Docker Desktop** → **Settings** → **Docker Engine**。在 JSON 里加入或合并 `registry-mirrors`（注意 JSON 逗号合法）：

```json
"registry-mirrors": [
  "https://docker.m.daocloud.io",
  "https://docker.1ms.run"
]
```

2. 点 **Apply & restart**，再执行下面的 `docker build`（命令可与平时一致）。

**方式 B：构建时指定基础镜像（不依赖 daemon 镜像配置）**

```bash
docker build --build-arg NODE_IMAGE=docker.m.daocloud.io/library/node:20-alpine -t 你的用户名/fusion:latest .
```

若某一源暂时不可用，可换其他国内 Docker Hub 加速站提供的 **`library/node:20-alpine`** 完整路径。

---

## 1. 先把镜像推到仓库（只需做一次）

本仓库根目录已带 `Dockerfile`。在你**本机**（已安装 Docker）执行：

```bash
cd Fusion
docker build -t 你的用户名/fusion:latest .
```

（网络正常时一条即可；遇 Docker Hub 超时见上一节。）

推送到 **Docker Hub**（先 `docker login`）：

```bash
docker push 你的用户名/fusion:latest
```

也可用 **GitHub Container Registry（ghcr.io）**、**阿里云 ACR** 等，只要 Sealos 能拉取（私有库需在 Sealos 配镜像拉取密钥，按控制台说明操作）。

---

## 2. 在 Sealos 里创建应用

1. 登录 [Sealos Cloud](https://cloud.sealos.run/)，打开 **应用管理**（或「应用启动」/ App Launchpad，以当前控制台菜单为准）。
2. **新建应用**，填写：
   - **镜像**：`你的用户名/fusion:latest`（或完整路径如 `ghcr.io/org/fusion:latest`）。
   - **容器端口**：`3000`（本镜像内 `PORT=3000`）。
   - **对外访问**：打开公网访问，将 **外部端口** 映射到容器 **3000**（界面可能是「网络」里填 3000）。

---

## 3. 持久化存储（必做）

Fusion 使用 SQLite + 本地上传目录，数据必须在卷里，否则 Pod 重启会丢库、丢文件。

在应用的 **存储 / 持久化卷** 中：

- **挂载路径（容器内）**：`/app/data`
- 容量按需要选（例如 1～5 GiB 起步）。

镜像已默认：

- `DATABASE_URL=file:/app/data/dev.db`
- `UPLOAD_DIR=/app/data/uploads`

不要在环境变量里写本机的 `DATABASE_URL=file:./dev.db`。

---

## 4. 环境变量

在应用里添加 **环境变量**（与 `.env.example` 一致，按需填写），例如：

| 变量 | 说明 |
|------|------|
| `OPENAI_API_KEY` | 若走 OpenAI 兼容接口（如硅基流动） |
| `OPENAI_BASE_URL` | 如 `https://api.siliconflow.cn/v1` |
| `OPENAI_MODEL` | 如 `deepseek-ai/DeepSeek-V3` |
| `OPENAI_VISION_MODEL` | 多模态/OCR 时填写 |
| 或 `GEMINI_API_KEY` 等 | 若走 Gemini 路线 |
| `NEXT_PUBLIC_APP_URL` | 部署成功后控制台给出的 **https 公网地址**（邮件/链接里会用；可先部署拿到地址再补一次并重启应用） |

敏感信息只填在 Sealos 环境变量里，不要写进镜像。

---

## 5. 部署与访问

保存并 **部署**，等状态变为 **running**，在应用详情里复制 **公网地址** 访问即可。

更新版本：本机重新 `docker build` + `docker push` 同标签或新版本号，在 Sealos 里 **重启/更新镜像**（以控制台操作为准）。

---

## 与阿里云 ECS 对比（帮你选型）

| | Sealos | 自建 ECS + Docker |
|--|--------|-------------------|
| 运维 | 网页配端口、卷、环境变量 | 自己 SSH、装 Docker、可选 Nginx |
| 适合 | 快速公测、少碰 Linux | 要完全掌控机器、备案域名一体 |

更细的 ECS 步骤见同目录 **[aliyun-deploy.md](./aliyun-deploy.md)**。

---

## 可选：用 DevBox 一条龙

若你希望代码在云端开发、一键发布镜像再部署，可用 Sealos **DevBox**：创建项目 → 开发 → **发布版本** → 点 **上线** 进入应用管理。流程见官方 [部署上线](https://sealos.run/docs/guides/fundamentals/deploy)。与本仓库「本地构建推送镜像」二选一即可。

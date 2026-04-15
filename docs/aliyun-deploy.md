# 阿里云部署 Fusion（Docker + SQLite）

面向：**轻量应用服务器** 或 **ECS**（任选其一），系统建议 **Ubuntu 22.04**；也可用 **Alibaba Cloud Linux**，安装 Docker 命令略有不同。

---

## 0. 你需要先有的东西

- 阿里云账号，已购买一台有 **公网 IP** 的实例（轻量或 ECS 均可）。
- 代码在 **Git 仓库**（GitHub / Gitee 等），服务器上能 `git clone`；或打包上传也行。
- 本机 LLM 相关密钥（与本地 `.env` 一致即可）。

**备案说明（大陆节点）**：若使用 **域名** 访问网站且解析到 **中国大陆** 服务器，通常需要 **ICP 备案** 后才能用 80/443 正式对外。仅用 **公网 IP + 非标准端口**（如 3000）做内测，一般不涉及备案，但以当地法规与云厂商规则为准。

---

## 1. 安全组 / 防火墙放行端口

在阿里云控制台：

- **轻量**：「防火墙」里添加规则：**TCP 22**（SSH）、**TCP 80**、**TCP 443**；内测可加 **TCP 3000**。
- **ECS**：安全组入方向同样放行 **22 / 80 / 443**（及可选 **3000**）。

---

## 2. 用 SSH 登录服务器

在本机 PowerShell 或终端（把 `root@你的公网IP` 换成你的用户与 IP）：

```bash
ssh root@你的公网IP
```

首次登录按提示确认指纹；若使用密钥，按控制台说明指定 `-i 密钥.pem`。

---

## 3. 安装 Docker（Ubuntu 22.04）

在服务器上执行：

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable docker --now
docker --version
```

非 root 用户加入 `docker` 组（可选，避免每次 `sudo docker`）：

```bash
sudo usermod -aG docker $USER
# 重新登录 SSH 后生效
```

---

## 4. 拉取代码

示例（把仓库地址换成你的）：

```bash
sudo mkdir -p /opt && sudo chown $USER:$USER /opt
cd /opt
git clone https://github.com/你的用户名/Fusion.git
cd Fusion
```

若仓库私有，需在服务器配置 SSH 密钥或使用访问令牌克隆。

---

## 5. 在服务器上配置环境变量

**不要**把本机 `.env` 提交到 Git。在服务器上单独创建：

```bash
cd /opt/Fusion
nano .env
```

内容参考仓库根目录 **`.env.example`**，至少填写你实际使用的项，例如：

- **`DATABASE_URL`（重要）**：若使用 `--env-file .env`，文件里的变量会**覆盖**镜像默认值。请 **删除** 本机拷贝来的 `DATABASE_URL=file:./dev.db`，或改为 **`DATABASE_URL=file:/app/data/dev.db`**。写错会导致数据库不在持久卷里，重启丢数据。
- LLM：`OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL` 或 `GEMINI_API_KEY` 等。
- 公网访问建议：`NEXT_PUBLIC_APP_URL=https://你的域名`（若暂时只有 IP，可写 `http://你的公网IP:3000`）。

保存退出（nano：`Ctrl+O` 回车，`Ctrl+X`）。

**注意**：Docker 的 `--env-file` 每行格式为 `KEY=value`，尽量不要带复杂引号；若值里有空格，可写成 `KEY="value with spaces"`。

---

## 6. 构建镜像并运行（持久卷）

仍在 `/opt/Fusion`：

```bash
docker build -t fusion:latest .
docker stop fusion 2>/dev/null || true
docker rm fusion 2>/dev/null || true
docker run -d \
  --name fusion \
  --restart unless-stopped \
  -p 3000:3000 \
  -v fusion_data:/app/data \
  --env-file .env \
  fusion:latest
```

检查：

```bash
docker ps
docker logs -f fusion
```

浏览器访问：`http://你的公网IP:3000`。

- 数据与上传文件在 Docker 卷 **`fusion_data`**（对应容器内 `/app/data`），**删容器不要删卷**，否则数据会丢。

---

## 7.（推荐）Nginx 反向代理 + HTTPS

### 7.1 安装 Nginx

```bash
sudo apt install -y nginx
```

### 7.2 站点配置（先 HTTP，证书后面加）

把 `你的域名` 换成真实域名（备案通过后使用）；若只有 IP，可把 `server_name` 写成 `_` 或你的 IP。

```bash
sudo nano /etc/nginx/sites-available/fusion
```

写入：

```nginx
server {
    listen 80;
    server_name 你的域名;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

启用：

```bash
sudo ln -sf /etc/nginx/sites-available/fusion /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 7.3 申请免费证书（Let's Encrypt，需域名已解析到本机）

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d 你的域名
```

按提示完成；certbot 会自动改 Nginx 为 HTTPS。证书会自动续期。

完成后把 `.env` 里的 `NEXT_PUBLIC_APP_URL` 改为 `https://你的域名`，并重建容器：

```bash
cd /opt/Fusion
docker stop fusion && docker rm fusion
docker run -d \
  --name fusion \
  --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  -v fusion_data:/app/data \
  --env-file .env \
  fusion:latest
```

说明：将容器 **3000 只绑在 127.0.0.1**，外网只走 **80/443 → Nginx → 本机 3000**，更安全。

---

## 8. 以后更新版本

```bash
cd /opt/Fusion
git pull
docker build -t fusion:latest .
docker stop fusion && docker rm fusion
docker run -d \
  --name fusion \
  --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  -v fusion_data:/app/data \
  --env-file .env \
  fusion:latest
```

数据库迁移在容器启动时由 `scripts/docker-entry.sh` 执行 `prisma migrate deploy`，一般无需手工操作。

---

## 9. 常见问题

| 现象 | 处理 |
|------|------|
| 浏览器打不开 | 检查安全组是否放行端口；`docker ps` 是否在跑；`docker logs fusion` |
| AI 不可用 | 检查 `.env` 中密钥与 `OPENAI_BASE_URL`；硅基流动等是否允许服务器出口 IP |
| 上传文件丢失 | 确认使用了 **`-v fusion_data:/app/data`**，且未误删卷 |
| 502 | Nginx 反代地址是否为 `127.0.0.1:3000`，容器是否绑定到本机 |

---

## 10. 安全建议（公测）

- API 密钥仅放在服务器 `.env`，权限：`chmod 600 .env`。
- 公网开放注册会消耗 LLM 额度，必要时可加访问限制或仅小范围发链接。

如需 **Alibaba Cloud Linux** 安装 Docker 的命令或 **阿里云 SSL 证书（控制台上传）** 的 Nginx 片段，可在本文件同目录提 issue 或按阿里云文档「Nginx 配置 SSL」替换 `certbot` 步骤。

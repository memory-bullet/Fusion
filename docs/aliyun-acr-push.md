# 把 Fusion 镜像推送到阿里云 ACR（容器镜像服务）

用于：**Sealos / 其它国内环境拉 Docker Hub 太慢或失败** 时，改从国内 registry 拉取。

---

## 1. 开通并创建仓库

1. 登录 [阿里云控制台](https://www.aliyun.com/) → 搜索 **容器镜像服务 ACR**。  
2. 选择地域（例如 **华东1 杭州**，与下文 `registry.cn-hangzhou.aliyuncs.com` 对应；**上海** 则为 `registry.cn-shanghai.aliyuncs.com`，以控制台为准）。  
3. **实例列表**：使用 **个人版**（或按你已有的实例）。  
4. **命名空间**：新建一个，例如 `myfusion`（小写）。  
5. **镜像仓库**：新建，例如 `fusion`，类型 **公开** 或 **私有**（私有则 Sealos 要配拉取密钥）。

创建完成后，在仓库详情页会看到 **登录地址、完整镜像地址**。

- **企业版等**：常为 `registry.cn-<region>.aliyuncs.com/命名空间/仓库名`  
- **个人版**：登录地址多为 **`crpi-xxxx.cn-hangzhou.personal.cr.aliyuncs.com`**，推送时必须用 **同一域名**，不要用错成 `registry.cn-hangzhou.aliyuncs.com`，否则会 **403**。

示例（个人版）：`crpi-76ihpl0wtnda28zy.cn-hangzhou.personal.cr.aliyuncs.com/myfusion/fusion`

---

## 2. 设置镜像仓库登录密码

ACR 控制台 → **访问凭证**（或实例 **访问凭证**）→ 设置 **固定密码**（用于 `docker login`，**不是**阿里云账号登录密码）。

---

## 3. 本机登录、打标签、推送

在 **PowerShell / CMD** 中（把下面占位符换成你的；**地域**必须与控制台一致）。

```text
# 登录（用户名一般是阿里云账号全名；密码为上一步设置的「固定密码」）
docker login --username=你的阿里云账号 registry.cn-hangzhou.aliyuncs.com

# 若本地已有 litprincess/fusion:latest，直接打标签（否则先 docker build）
docker tag litprincess/fusion:latest registry.cn-hangzhou.aliyuncs.com/myfusion/fusion:latest

docker push registry.cn-hangzhou.aliyuncs.com/myfusion/fusion:latest
```

- `myfusion` → 你的**命名空间**  
- `fusion` → 你的**仓库名**  
- `registry.cn-hangzhou.aliyuncs.com` → 换成控制台显示的 **专有网络/公网登录地址**（不同地域域名不同）

推送成功后，在 ACR 仓库页应能看到 `latest` 标签。

---

## 4. Sealos 里改用 ACR 镜像

1. 应用 **变更** → **镜像** 改为：  
   `registry.cn-hangzhou.aliyuncs.com/myfusion/fusion:latest`  
2. 若仓库为 **私有**：在 Sealos 配置 **镜像拉取密钥**（用户名、密码即 ACR 固定密码；具体入口以 Sealos 文档为准）。  
3. 保存后重新部署；一般比 Docker Hub **快很多**。

---

## 5. 国内构建基础镜像（可选）

若本机 `docker build` 仍需走 DaoCloud 基础镜像：

```text
docker build --provenance=false --build-arg NODE_IMAGE=docker.m.daocloud.io/library/node:20-alpine -t registry.cn-hangzhou.aliyuncs.com/myfusion/fusion:latest .
docker push registry.cn-hangzhou.aliyuncs.com/myfusion/fusion:latest
```

---

## 6. 常见问题

| 问题 | 处理 |
|------|------|
| `denied` / 401 | 检查 `docker login` 域名、用户名、**固定密码** |
| push 很慢 | 正常现象时可接受；可换更近地域的 ACR |
| Sealos 拉不下私有库 | 必须在 Sealos 配 **imagePullSecrets** 或等价「镜像凭证」 |

阿里云文档：[推送拉取镜像](https://help.aliyun.com/zh/acr/user-guide/build-and-use-images-on-docker-command-line)

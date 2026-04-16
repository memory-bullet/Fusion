# Fusion Space MVP - 前端交付文档

## 项目概述

Fusion Space 是一个团队项目协作管理系统，支持项目创建、成员管理、任务分配、进度跟踪等功能。

**技术栈**：
- 框架：Next.js 15.3.2 (App Router)
- 语言：TypeScript
- 样式：Tailwind CSS
- 数据库：Prisma + SQLite
- UI 组件：Radix UI, Lucide Icons
- 二维码：QRCode, @zxing/browser

---

## 核心功能模块

### 1. 用户认证与注册

#### 1.1 首页 `/`
- **路径**：[src/app/page.tsx](src/app/page.tsx)
- **功能**：
  - 用户注册/登录
  - 加入项目（支持邀请码、邀请链接、二维码扫描）
  - 创建新项目
  - 查看我的项目列表
  - 项目重命名

#### 1.2 认证 API
- **注册**：`POST /api/auth/register`
  - 参数：`{ name, email?, password }`
  - 返回：`{ userId, name }`

- **登录**：`POST /api/auth/login`
  - 参数：`{ email, password }`
  - 返回：`{ userId, name }`

- **登出**：`POST /api/auth/logout`

- **当前用户**：`GET /api/me`
  - 返回：`{ user: { id, name, email, accumulatedPoints, creditScore } }`

---

### 2. 项目管理

#### 2.1 项目创建
- **API**：`POST /api/projects`
- **参数**：
  ```json
  {
    "title": "项目名称",
    "contextSummary": "项目描述",
    "deadline": "2024-12-31T23:59:59.999Z"
  }
  ```
- **返回**：`{ projectId, inviteCode }`
- **说明**：创建项目时自动生成唯一邀请码（格式：`FUSION-XXXX`）

#### 2.2 项目列表
- **API**：`GET /api/projects/mine`
- **返回**：用户参与的所有项目列表

#### 2.3 项目详情
- **页面**：`/project/[id]`
- **路径**：[src/app/project/[id]/page.tsx](src/app/project/[id]/page.tsx)
- **功能**：
  - 查看项目信息
  - 查看任务列表
  - 查看成员列表
  - 查看项目文档
  - AI 聊天助手

#### 2.4 项目管理页面
- **页面**：`/project/[id]/manage`
- **路径**：[src/app/project/[id]/manage/page.tsx](src/app/project/[id]/manage/page.tsx)
- **组件**：[src/components/project-manage-page.tsx](src/components/project-manage-page.tsx)
- **功能**：
  - 成员管理（邀请、移出、转让组长）
  - 任务管理（上传文档、生成任务、分配任务）
  - 进度简报（AI 生成）
  - 任务视图（看板、列表、甘特图）
  - 公告栏

---

### 3. 成员管理（核心功能）

#### 3.1 邀请成员

##### 3.1.1 预设成员邀请
- **创建预设成员**：`POST /api/projects/[id]/member-presets`
  - 参数：`{ names: ["张三", "李四"] }`
  - 说明：组长可以预设成员昵称，系统会在"待入驻"列表中显示

- **专属邀请方式**：
  - **邀请码**：`FUSION-1975 张三`（项目邀请码 + 空格 + 成员昵称）
  - **邀请链接**：`/?invite=FUSION-1975%20张三&preset=preset-id`
  - **二维码**：包含邀请链接的二维码

- **邀请面板组件**：[src/components/project-invite-panel.tsx](src/components/project-invite-panel.tsx)
  - 显示三种邀请方式（邀请码、链接、二维码）
  - 支持复制、下载二维码

- **二维码扫描**：[src/components/invite-qr-scanner.tsx](src/components/invite-qr-scanner.tsx)
  - 支持摄像头扫描
  - 支持上传图片识别

##### 3.1.2 取消预设邀请
- **API**：`DELETE /api/projects/[id]/member-presets?presetId=xxx`
- **说明**：删除未激活的预设成员

#### 3.2 加入项目

##### 3.2.1 普通加入
- **API**：`POST /api/projects/join`
- **参数**：`{ inviteCode: "FUSION-1975" }`
- **说明**：使用项目邀请码加入，使用全局用户名

##### 3.2.2 预设成员加入
- **API**：`POST /api/projects/join`
- **参数**：`{ inviteCode: "FUSION-1975 张三" }`
- **说明**：
  - 系统解析邀请码，第一部分是项目邀请码，第二部分是成员昵称
  - 查找匹配的预设成员
  - 删除预设记录
  - 创建成员关系，设置项目内昵称为"张三"
  - 预设成员从"待入驻"列表中消失

##### 3.2.3 邀请链接加入
- **API**：`POST /api/join-by-invite`
- **参数**：`{ inviteCode: "FUSION-1975", presetId: "preset-id" }`
- **说明**：通过邀请链接加入，支持预设成员

#### 3.3 移出成员
- **API**：`DELETE /api/projects/[id]/members?memberId=xxx`
- **权限**：仅组长可操作
- **限制**：不能移出组长本人
- **通知**：被移出的成员会收到站内信通知

#### 3.4 转让组长
- **API**：`POST /api/projects/[id]/transfer-owner`
- **参数**：`{ newOwnerId: "user-id" }`
- **权限**：仅组长可操作
- **限制**：
  - 只能转让给已入驻的成员
  - 不能转让给自己
  - 团队至少有 2 人
- **通知**：
  - 新组长收到"你已成为项目组长"通知
  - 其他成员收到"项目组长已变更"通知

#### 3.5 编辑项目内昵称
- **API**：`PATCH /api/projects/[id]/members/nickname`
- **参数**：`{ projectNickname: "新昵称" }`
- **说明**：成员可以修改自己在项目中的昵称

#### 3.6 获取成员列表
- **API**：`GET /api/projects/[id]/members`
- **返回**：
  ```json
  {
    "members": [
      {
        "id": "member-id",
        "userId": "user-id",
        "name": "用户名",
        "projectNickname": "项目内昵称",
        "role": "OWNER | MEMBER",
        "joinedStatus": "ACTIVATED"
      }
    ],
    "presets": [
      {
        "id": "preset-id",
        "presetName": "张三"
      }
    ]
  }
  ```

---

### 4. 任务管理

#### 4.1 上传文档并生成任务
- **API**：`POST /api/projects/[id]/requirement-upload`
- **参数**：FormData（文件）
- **支持格式**：PDF, Word, Markdown, HTML, 纯文本, 图片（含 HEIC）
- **功能**：
  - AI 提取关键产出物
  - AI 识别时间节点
  - AI 生成建议任务（含工作量和截止时间）

#### 4.2 任务草稿
- **组件**：[src/components/project-manage-page.tsx](src/components/project-manage-page.tsx)
- **功能**：
  - 编辑任务名称、工作量、截止时间、负责人
  - 删除任务
  - 查看工作量分布

#### 4.3 确认任务
- **API**：`POST /api/projects/[id]/tasks/commit-draft`
- **参数**：
  ```json
  {
    "sourceLabel": "第一批作业要求",
    "tasks": [
      {
        "title": "任务名称",
        "workloadPoints": 10,
        "deadlineOffsetHours": 48,
        "assigneeId": "member-id"
      }
    ]
  }
  ```

#### 4.4 任务视图

##### 4.4.1 看板视图
- **组件**：[src/components/task-board.tsx](src/components/task-board.tsx)
- **功能**：
  - 拖拽任务改变状态
  - 任务状态：待认领、待开始、进行中、求助中、已完成
  - 显示任务工作量、截止时间、负责人

##### 4.4.2 列表视图
- **功能**：
  - 显示任务详情
  - 工作量权重分布
  - 任务状态操作按钮
  - 组长可指派任务

##### 4.4.3 甘特图视图
- **功能**：
  - 按成员分组显示任务
  - 时间轴展示
  - 任务重新分配

#### 4.5 任务操作
- **更新状态**：`PATCH /api/tasks/[id]/status`
  - 参数：`{ status: "TODO | IN_PROGRESS | BLOCKED | DONE" }`

- **认领任务**：`PATCH /api/tasks/[id]/status`
  - 参数：`{ status: "TODO" }`

- **指派任务**：`PATCH /api/tasks/[id]/assign`
  - 参数：`{ assigneeId: "member-id" }`

- **重新分配**：`POST /api/tasks/[id]/reallocate`
  - 参数：
    ```json
    {
      "newDeadline": "2024-12-31T23:59:59.999Z",
      "allocations": [
        { "assigneeId": "member-id", "workloadPoints": 5 }
      ]
    }
    ```

---

### 5. 进度简报

#### 5.1 AI 进度简报
- **API**：`POST /api/projects/[id]/progress-digest`
- **参数**：`{ scope: "week" }`
- **功能**：
  - 根据任务状态和操作记录生成简报
  - 自动刷新（任务状态更新后约 2 秒）
  - 需配置 `GEMINI_API_KEY` 或 `OPENAI_API_KEY`

#### 5.2 成员工作量
- **组件**：[src/components/member-workload-strip.tsx](src/components/member-workload-strip.tsx)
- **功能**：
  - 显示每个成员的进行中任务工作量
  - 工作量条形图

---

### 6. 站内信通知

#### 6.1 通知类型

##### 6.1.1 加入成功通知
- **触发**：用户成功加入项目
- **通知对象**：加入的用户
- **内容**：
  - 普通加入：`你已成功加入项目「项目名称」`
  - 预设成员加入：`你已成功加入项目，项目内昵称为「张三」`

##### 6.1.2 被移出通知
- **触发**：成员被组长移出项目
- **通知对象**：被移出的成员
- **内容**：`你已被移出项目「项目名称」`

##### 6.1.3 成为组长通知
- **触发**：成员被转让为组长
- **通知对象**：新组长
- **内容**：`你已成为项目「项目名称」的组长，现在可以管理任务、邀请成员等`

##### 6.1.4 组长变动通知
- **触发**：项目组长发生变更
- **通知对象**：除新组长和原组长外的所有成员
- **内容**：`项目「项目名称」的组长已从「原组长」变更为「新组长」`

#### 6.2 通知 API
- **获取通知列表**：`GET /api/me/notifications`
- **未读数量**：`GET /api/me/notifications/unread-count`
- **标记已读**：`PATCH /api/me/notifications/[id]`

#### 6.3 通知页面
- **路径**：`/notifications`
- **组件**：[src/app/notifications/page.tsx](src/app/notifications/page.tsx)

---

### 7. 项目文档

#### 7.1 文档管理
- **API**：
  - 获取文档列表：`GET /api/projects/[id]/documents`
  - 上传文档：`POST /api/projects/[id]/documents/upload`
  - 更新文档：`PATCH /api/projects/[id]/documents/[docId]`
  - 删除文档：`DELETE /api/projects/[id]/documents/[docId]`

#### 7.2 默认文档
- 项目创建时自动生成三个默认文档：
  - 项目概览
  - 任务分配记录
  - 会议纪要

---

### 8. AI 功能

#### 8.1 项目 AI 聊天
- **组件**：[src/components/project-ai-chat-panel.tsx](src/components/project-ai-chat-panel.tsx)
- **API**：`POST /api/projects/[id]/chat`
- **功能**：
  - 基于项目上下文的 AI 对话
  - 支持流式响应

#### 8.2 文档解析
- **API**：`POST /api/projects/[id]/ai-parse`
- **功能**：
  - 提取关键产出物
  - 识别时间节点
  - 生成任务建议

---

## 使用 Claude 完成的核心更新

### 1. 预设成员邀请系统（完整实现）

**问题背景**：
- 组长需要为特定成员预设项目内昵称
- 需要支持邀请码、邀请链接、二维码三种方式
- 预设成员加入后应从"待入驻"列表中消失

**Claude 实现的功能**：

#### 1.1 专属邀请码设计
- 设计了"项目邀请码 + 成员昵称"的组合方式
- 例如：`FUSION-1975 张三`
- 系统自动解析第一部分为项目邀请码，第二部分为成员昵称

#### 1.2 邀请流程实现
- 创建预设成员 API：`POST /api/projects/[id]/member-presets`
- 修改加入逻辑：`POST /api/projects/join`
  - 支持解析"项目邀请码 + 昵称"格式
  - 查找匹配的预设成员
  - 删除预设记录
  - 设置项目内昵称
- 邀请链接支持：`POST /api/join-by-invite`
  - 支持 `presetId` 参数

#### 1.3 前端组件
- 邀请面板：[src/components/project-invite-panel.tsx](src/components/project-invite-panel.tsx)
  - 显示专属邀请码、链接、二维码
  - 区分普通邀请和预设邀请
- 二维码扫描：[src/components/invite-qr-scanner.tsx](src/components/invite-qr-scanner.tsx)
  - 支持摄像头扫描和图片上传

#### 1.4 数据同步
- 预设成员加入后立即删除预设记录
- 前端自动刷新（15 秒轮询）
- 待入驻列表实时更新

### 2. 成员管理功能修复

**问题背景**：
- 移出成员时显示"该成员不存在"
- 转让组长时显示"成员不存在"
- 数据结构混淆（`ProjectMember.id` vs `User.id`）

**Claude 修复的问题**：

#### 2.1 数据结构统一
- Dashboard API 返回的成员数据：
  ```typescript
  {
    id: string;        // ProjectMember.id
    userId: string;    // User.id
    name: string;
    role: string;
    projectNickname?: string;
  }
  ```
- 确保 `id` 字段在 `toPublicUser` 之后覆盖，避免被 `user.id` 覆盖

#### 2.2 前端逻辑修复
- 移出成员：传递 `ProjectMember.id`
- 转让组长：传递 `User.id`
- 当前用户判断：使用 `userId` 而不是 `id`

#### 2.3 API 修复
- `DELETE /api/projects/[id]/members`：接收 `ProjectMember.id`
- `POST /api/projects/[id]/transfer-owner`：接收 `User.id`

### 3. 站内信通知系统（完整实现）

**问题背景**：
- 用户需要及时了解项目状态变化
- 需要通知加入、移出、转让等操作

**Claude 实现的功能**：

#### 3.1 通知集成
- 在所有关键操作中添加 `notifyUser` 调用
- 加入成功：`POST /api/projects/join` 和 `POST /api/join-by-invite`
- 被移出：`DELETE /api/projects/[id]/members`
- 成为组长：`POST /api/projects/[id]/transfer-owner`
- 组长变动：`POST /api/projects/[id]/transfer-owner`（通知所有成员）

#### 3.2 通知内容设计
- 区分普通加入和预设成员加入
- 显示项目名称和相关人员昵称
- 提供操作链接（跳转到相关页面）

#### 3.3 批量通知
- 转让组长时，使用 `Promise.all` 批量通知所有成员
- 排除新组长和原组长

### 4. 调试和问题排查

**Claude 提供的调试支持**：

#### 4.1 添加日志
- 在关键 API 中添加 `console.log` 调试日志
- 例如：`[join] Found preset by nickname`
- 帮助追踪预设成员加入流程

#### 4.2 错误处理
- 完善错误提示信息
- 例如："该成员不存在" → 定位到数据结构问题

#### 4.3 测试文档
- 创建详细的测试步骤文档
- 提供边界情况测试场景

### 5. 代码优化

**Claude 完成的优化**：

#### 5.1 类型定义
- 更新 TypeScript 类型定义
- 例如：`ManagedMember` 类型添加 `userId` 字段

#### 5.2 代码清理
- 移除不再使用的代码
- 例如：删除 `generate-preset-invite-code.ts`
- 回滚不必要的数据库字段（`inviteCode`）

#### 5.3 数据库迁移
- 使用 `prisma db push` 更新数据库模式
- 处理数据迁移警告

---

## 数据库模型

### 核心表结构

#### User（用户）
```prisma
model User {
  id                 String   @id @default(cuid())
  name               String
  email              String?  @unique
  passwordHash       String?
  accumulatedPoints  Int      @default(0)
  creditScore        Int      @default(100)
  createdAt          DateTime @default(now())
}
```

#### Project（项目）
```prisma
model Project {
  id               String   @id @default(cuid())
  title            String
  contextSummary   String?
  status           String   @default("ACTIVE")
  deadline         DateTime
  inviteCode       String   @unique
  progressDigest   String?
  progressDigestAt DateTime?
  createdAt        DateTime @default(now())
}
```

#### ProjectMember（项目成员）
```prisma
model ProjectMember {
  id              String   @id @default(cuid())
  projectId       String
  userId          String
  role            String   @default("MEMBER")  // OWNER | MEMBER
  joinedStatus    String   @default("ACTIVATED")
  projectNickname String?  // 项目内昵称
  joinedAt        DateTime @default(now())

  @@unique([projectId, userId])
}
```

#### MemberPreset（预设成员）
```prisma
model MemberPreset {
  id          String   @id @default(cuid())
  projectId   String
  presetName  String   // 预设昵称
  activated   Boolean  @default(false)
  activatedBy String?
  createdAt   DateTime @default(now())

  @@index([projectId])
}
```

#### Task（任务）
```prisma
model Task {
  id                String   @id @default(cuid())
  projectId         String
  assigneeId        String?
  title             String
  status            String   @default("UNASSIGNED")
  workloadPoints    Int
  deadline          DateTime
  sourceLabel       String?  // 来源标签（如"第一批作业要求"）
  createdAt         DateTime @default(now())
}
```

#### UserNotification（站内信）
```prisma
model UserNotification {
  id        String    @id @default(cuid())
  userId    String
  projectId String?
  kind      String    // PROJECT_JOINED | MEMBER_REMOVED | BECAME_OWNER | OWNER_CHANGED
  title     String
  body      String
  actionUrl String?
  readAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([userId])
}
```

---

## 环境变量

```env
# 数据库
DATABASE_URL="file:./dev.db"

# AI 服务（至少配置一个）
GEMINI_API_KEY="your-gemini-api-key"
OPENAI_API_KEY="your-openai-api-key"

# 应用 URL（用于邮件通知）
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# 邮件服务（可选）
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="your-email@example.com"
SMTP_PASS="your-password"
```

---

## 部署说明

### 1. 安装依赖
```bash
npm install
```

### 2. 数据库初始化
```bash
npx prisma generate
npx prisma db push
```

### 3. 启动开发服务器
```bash
npm run dev
```

### 4. 构建生产版本
```bash
npm run build
npm start
```

---

## 关键路径总览

### 页面路径
- `/` - 首页（登录/注册/加入项目/创建项目）
- `/project/[id]` - 项目详情
- `/project/[id]/manage` - 项目管理（仅组长）
- `/notifications` - 通知列表
- `/me` - 个人中心

### API 路径

#### 认证
- `POST /api/auth/register` - 注册
- `POST /api/auth/login` - 登录
- `POST /api/auth/logout` - 登出
- `GET /api/me` - 获取当前用户

#### 项目
- `POST /api/projects` - 创建项目
- `GET /api/projects/mine` - 我的项目列表
- `GET /api/projects/[id]/dashboard` - 项目仪表板
- `POST /api/projects/join` - 加入项目
- `POST /api/join-by-invite` - 邀请链接加入

#### 成员管理
- `POST /api/projects/[id]/member-presets` - 创建预设成员
- `DELETE /api/projects/[id]/member-presets` - 取消预设邀请
- `GET /api/projects/[id]/members` - 获取成员列表
- `DELETE /api/projects/[id]/members` - 移出成员
- `POST /api/projects/[id]/transfer-owner` - 转让组长
- `PATCH /api/projects/[id]/members/nickname` - 修改昵称

#### 任务管理
- `POST /api/projects/[id]/requirement-upload` - 上传文档
- `POST /api/projects/[id]/tasks/commit-draft` - 确认任务
- `PATCH /api/tasks/[id]/status` - 更新任务状态
- `PATCH /api/tasks/[id]/assign` - 指派任务
- `POST /api/tasks/[id]/reallocate` - 重新分配任务

#### 通知
- `GET /api/me/notifications` - 通知列表
- `GET /api/me/notifications/unread-count` - 未读数量
- `PATCH /api/me/notifications/[id]` - 标记已读

#### AI 功能
- `POST /api/projects/[id]/progress-digest` - 生成进度简报
- `POST /api/projects/[id]/chat` - AI 聊天
- `POST /api/projects/[id]/ai-parse` - 文档解析

---

## 核心组件

### 成员管理
- [src/components/project-manage-page.tsx](src/components/project-manage-page.tsx) - 项目管理主页面
- [src/components/project-invite-panel.tsx](src/components/project-invite-panel.tsx) - 邀请面板
- [src/components/invite-qr-scanner.tsx](src/components/invite-qr-scanner.tsx) - 二维码扫描
- [src/components/project-invite-share.tsx](src/components/project-invite-share.tsx) - 邀请分享
- [src/components/project-invite-chips.tsx](src/components/project-invite-chips.tsx) - 邀请码芯片

### 任务管理
- [src/components/task-board.tsx](src/components/task-board.tsx) - 看板视图
- [src/components/member-workload-strip.tsx](src/components/member-workload-strip.tsx) - 成员工作量条
- [src/components/workload-share-bar.tsx](src/components/workload-share-bar.tsx) - 工作量分布条
- [src/components/reallocate-dialog.tsx](src/components/reallocate-dialog.tsx) - 重新分配对话框

### 通用组件
- [src/components/top-nav.tsx](src/components/top-nav.tsx) - 顶部导航
- [src/components/nav-trailing.tsx](src/components/nav-trailing.tsx) - 导航尾部（通知图标）
- [src/components/project-hero.tsx](src/components/project-hero.tsx) - 项目头部

---

## 注意事项

### 1. 数据一致性
- 预设成员加入后必须删除预设记录
- 移出成员前必须发送通知
- 转让组长时必须更新两个成员的角色

### 2. 权限控制
- 只有组长可以：邀请成员、移出成员、转让组长、上传文档、分配任务
- 所有成员可以：查看项目、更新任务状态、修改自己的昵称

### 3. 性能优化
- Dashboard API 每 15 秒自动刷新
- 转让组长时批量通知所有成员（使用 `Promise.all`）
- 二维码预生成（在邀请面板打开时）

### 4. 用户体验
- 邀请码支持空格分隔（项目邀请码 + 昵称）
- 二维码支持摄像头扫描和图片上传
- 通知提供操作链接，方便快速跳转
- 待入驻列表实时更新

---

## 联系方式

如有问题，请联系前端开发团队。

**文档版本**：v2.0  
**最后更新**：2026-04-16

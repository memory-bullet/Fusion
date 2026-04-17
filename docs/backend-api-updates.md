# 后端接口交付文档 - 功能优化版

> **更新日期**: 2026-04-18  
> **版本**: v1.1  
> **适用范围**: Fusion-codex-fusion-mvp 前端功能优化所需的后端接口变更

---

## 📋 本次更新概述

本次更新针对5个用户体验问题进行优化，涉及以下后端接口的新增和修改：

1. **文本要求提交接口** - 支持直接粘贴文本而非仅上传文件
2. **任务截止时间修改接口** - 允许组长调整单个任务的DDL
3. **项目截止时间修改** - 在现有项目编辑接口中增加deadline字段支持
4. **日志描述中文化** - 确保所有actionLog的description字段使用中文

---

## 🆕 新增接口

### 1. 提交文本要求（替代文件上传）

**接口路径**: `POST /api/projects/[id]/requirement-text`

**功能说明**: 允许用户直接粘贴文本作业要求，无需上传文件，后端直接将文本传递给AI解析。

**请求参数**:
```typescript
{
  text: string;        // 必填，作业要求文本内容，最大长度8000字符
  sourceLabel?: string; // 可选，来源标签，如"第一阶段作业要求"
}
```

**请求示例**:
```json
{
  "text": "请完成以下任务：\n1. 设计数据库表结构\n2. 实现用户登录功能\n3. 完成前端页面布局\n截止时间：本周五下午6点",
  "sourceLabel": "第二批作业要求"
}
```

**响应格式**:
```typescript
{
  suggestedTasks: Array<{
    title: string;              // 任务标题
    workloadPoints: number;     // 工作量点数（1-100）
    deadlineOffsetHours: number; // 相对截止时间（小时）
  }>;
  keyDeliverables?: string[];   // 提取的关键产出物
  assignmentMilestones?: Array<{
    label: string;
    dueDate?: string;
    dueOffsetHours?: number;
  }>;
}
```

**错误响应**:
- `400`: 文本为空或超长
- `401`: 未登录
- `403`: 非项目成员
- `500`: AI解析失败

**实现要点**:
- 复用现有 `requirement-upload` 的AI解析逻辑
- 跳过文件读取步骤，直接将 `text` 参数传递给AI
- 保持与文件上传相同的响应格式
- 记录操作日志：`actionType: "REQUIREMENT_TEXT_SUBMIT"`

---

### 2. 修改任务截止时间

**接口路径**: `PATCH /api/tasks/[id]/deadline`

**功能说明**: 允许项目组长修改单个任务的截止时间。

**权限要求**: 仅项目创建者（OWNER角色）可调用

**请求参数**:
```typescript
{
  deadline: string; // 必填，ISO 8601格式的日期时间字符串
}
```

**请求示例**:
```json
{
  "deadline": "2026-04-25T18:00:00.000Z"
}
```

**响应格式**:
```typescript
{
  success: true;
  task: {
    id: string;
    title: string;
    deadline: string;
    updatedAt: string;
  };
}
```

**错误响应**:
- `400`: 日期格式错误或早于当前时间
- `401`: 未登录
- `403`: 非项目组长
- `404`: 任务不存在

**实现要点**:
- 验证新截止时间不早于当前时间
- 验证新截止时间不晚于项目总截止时间
- 更新任务的 `warningLevel` 字段（根据新DDL重新计算）
- 记录操作日志：`actionType: "TASK_DEADLINE_UPDATED"`，描述格式："任务「{title}」截止时间调整为 {newDeadline}"

---

## 🔄 修改现有接口

### 3. 项目信息更新接口增强

**接口路径**: `PATCH /api/projects/[id]`

**变更说明**: 在现有接口基础上，增加对 `deadline` 字段的支持。

**新增请求参数**:
```typescript
{
  title?: string;    // 已有，项目名称
  deadline?: string; // 新增，项目截止时间（ISO 8601格式）
}
```

**请求示例**:
```json
{
  "title": "团队协作项目",
  "deadline": "2026-05-01T23:59:59.000Z"
}
```

**响应格式**: 保持不变，返回更新后的项目信息

**实现要点**:
- 验证新截止时间不早于当前时间
- 验证新截止时间不早于所有任务的最晚截止时间（或给出警告）
- 更新项目后，触发所有任务的 `warningLevel` 重新计算
- 记录操作日志：`actionType: "PROJECT_DEADLINE_UPDATED"`

---

### 4. 文件上传接口优化（支持进度反馈）

**接口路径**: `POST /api/projects/[id]/requirement-upload`

**变更说明**: 无需修改接口逻辑，但建议优化响应速度，支持前端进度监听。

**前端实现方式**:
- 前端使用 `XMLHttpRequest` 的 `upload.onprogress` 事件监听上传进度
- 后端无需特殊处理，保持现有实现即可

**可选优化**:
- 如果文件处理时间过长（>30秒），考虑改为异步处理：
  1. 接口立即返回 `taskId`
  2. 前端轮询 `GET /api/projects/[id]/requirement-upload/status?taskId=xxx` 获取处理状态
  3. 处理完成后返回 `suggestedTasks`

---

## 📝 日志描述中文化清单

以下接口生成的 `actionLog` 需确保 `description` 字段全部使用中文：

### 需检查的接口列表

| 接口路径 | actionType | 描述示例（中文） |
|---------|-----------|----------------|
| `POST /api/tasks/[id]/status` | `TASK_STATUS_CHANGED` | "任务「{title}」状态更新为：进行中" |
| `POST /api/tasks/[id]/status` | `TASK_DONE` | "任务「{title}」已完成" |
| `POST /api/tasks/[id]/assign` | `TASK_ASSIGNED` | "任务「{title}」分配给 {assigneeName}" |
| `POST /api/tasks/[id]/reallocate` | `TASK_REALLOCATED` | "任务「{title}」重新分配给 {newAssignees}" |
| `POST /api/projects/[id]/requirement-upload` | `DOCUMENT_UPLOAD` | "上传作业文件：{filename}（{size} KB）｜积分 +{points}" |
| `POST /api/projects/[id]/documents/upload` | `DOCUMENT_UPLOAD` | "上传作业文件：{filename}（{size} KB）｜积分 +{points}" |
| `DELETE /api/projects/[id]/documents/[docId]` | `DOCUMENT_DELETE` | "删除文件：{filename}" |
| `POST /api/projects/[id]/tasks/commit-draft` | `TASK_BATCH_CREATED` | "批量创建任务：{count}个任务（来源：{sourceLabel}）" |
| `POST /api/projects/[id]/transfer-owner` | `PROJECT_OWNER_TRANSFERRED` | "项目组长权限转让给 {newOwnerName}" |
| `POST /api/projects/[id]/member-presets` | `MEMBER_INVITED` | "邀请成员：{names}" |
| `DELETE /api/projects/[id]/members` | `MEMBER_REMOVED` | "移出成员：{memberName}" |

### 检查要点

1. **避免英文残留**: 
   - ❌ "Task assigned to user"
   - ✅ "任务分配给用户"

2. **统一术语**:
   - 任务状态：待开始、进行中、已完成、求助中
   - 角色：组长、组员、创建者
   - 操作：分配、转交、完成、删除

3. **格式规范**:
   - 使用中文标点：「」、｜、：
   - 数字与单位之间加空格：`10 点`、`5 KB`
   - 时间格式：`2026年4月18日 14:30`

---

## 🔍 数据库变更

本次更新**无需修改数据库表结构**，所有字段均已存在：

- `Project.deadline` - 已有字段，类型 `DateTime`
- `Task.deadline` - 已有字段，类型 `DateTime`
- `ActionLog.actionType` - 已有字段，类型 `String`
- `ActionLog.description` - 已有字段，类型 `String`

---

## 🧪 测试用例

### 1. 文本要求提交测试

```bash
# 正常提交
curl -X POST http://localhost:3000/api/projects/test-project-id/requirement-text \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{
    "text": "完成用户登录功能，包括前端表单和后端验证，截止本周五",
    "sourceLabel": "第一阶段"
  }'

# 预期响应：200，返回suggestedTasks数组
```

### 2. 任务DDL修改测试

```bash
# 组长修改任务截止时间
curl -X PATCH http://localhost:3000/api/tasks/task-id-123/deadline \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{
    "deadline": "2026-04-30T18:00:00.000Z"
  }'

# 预期响应：200，返回更新后的任务信息
```

### 3. 项目DDL修改测试

```bash
# 修改项目截止时间
curl -X PATCH http://localhost:3000/api/projects/project-id-456 \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{
    "deadline": "2026-05-15T23:59:59.000Z"
  }'

# 预期响应：200，返回更新后的项目信息
```

---

## 📦 交付清单

### 后端开发需完成的任务

- [ ] 新建 `/api/projects/[id]/requirement-text/route.ts` 接口
- [ ] 新建 `/api/tasks/[id]/deadline/route.ts` 接口
- [ ] 修改 `/api/projects/[id]/route.ts` 的 PATCH 方法，支持 `deadline` 字段
- [ ] 检查并修改所有生成 `actionLog` 的接口，确保 `description` 为中文
- [ ] 编写单元测试覆盖新增接口
- [ ] 更新 API 文档（如使用 Swagger/OpenAPI）

### 前端开发需配合的任务

- [ ] 实现文本输入 Tab 切换 UI
- [ ] 调用新的 `requirement-text` 接口
- [ ] 实现任务DDL点击编辑功能
- [ ] 实现项目DDL编辑功能（在 ProjectEditModal 中）
- [ ] 实现上传进度条（使用 XMLHttpRequest）
- [ ] 实现批量上传队列管理

---

## 🚀 部署注意事项

1. **向后兼容**: 新增接口不影响现有功能，可独立部署
2. **数据迁移**: 无需执行数据库迁移
3. **环境变量**: 无新增环境变量要求
4. **API版本**: 建议在响应头中添加 `X-API-Version: 1.1`

---

## 📞 联系方式

如有疑问，请联系：
- 前端负责人：[前端团队]
- 后端负责人：[后端团队]
- 项目经理：[PM]

---

## 附录：现有核心接口快速参考

### 认证相关
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/logout` - 用户登出
- `GET /api/auth/me` - 获取当前用户信息

### 项目管理
- `POST /api/projects` - 创建项目
- `GET /api/projects/mine` - 获取我的项目列表
- `POST /api/projects/join` - 加入项目
- `GET /api/projects/[id]/dashboard` - 获取项目仪表盘数据
- `DELETE /api/projects/[id]` - 删除项目

### 任务管理
- `POST /api/projects/[id]/tasks/commit-draft` - 批量创建任务
- `PATCH /api/tasks/[id]/status` - 更新任务状态
- `PATCH /api/tasks/[id]/assign` - 分配任务
- `POST /api/tasks/[id]/reallocate` - 重新分配任务
- `DELETE /api/tasks/[id]` - 删除任务

### 文档管理
- `POST /api/projects/[id]/documents/upload` - 上传文档
- `GET /api/projects/[id]/documents` - 获取文档列表
- `DELETE /api/projects/[id]/documents/[docId]` - 删除文档

---

**文档版本历史**:
- v1.1 (2026-04-18): 新增文本提交、DDL修改接口，日志中文化要求
- v1.0 (2026-04-01): 初始版本

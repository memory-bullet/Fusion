# 上传进度条与批量上传功能实现说明

## 已完成的工作

### 1. 创建了上传队列工具库 (`src/lib/upload-queue.ts`)
- `uploadFileWithProgress`: 使用 XMLHttpRequest 实现带进度追踪的文件上传
- `formatFileSize`: 格式化文件大小显示
- `UploadQueueItem` 类型定义：包含文件、进度、状态、错误信息等

### 2. 创建了上传队列面板组件 (`src/components/upload-queue-panel.tsx`)
功能特性：
- ✅ 支持多文件选择（`multiple` 属性）
- ✅ 支持拖拽批量上传
- ✅ 实时显示每个文件的上传进度（0-100%）
- ✅ 队列管理：最多同时上传 2 个文件
- ✅ 状态显示：pending（等待）、uploading（上传中）、success（成功）、error（失败）
- ✅ 支持取消单个上传任务
- ✅ 清除已完成的上传记录
- ✅ 文件大小显示
- ✅ 错误信息展示

## 集成方法

### 方案 A：完全替换现有上传区域（推荐）

在 `src/components/project-manage-page.tsx` 中：

1. 导入新组件：
\`\`\`typescript
import { UploadQueuePanel } from "@/components/upload-queue-panel";
\`\`\`

2. 找到第 654-780 行的上传区域（包含 `inputMode` 切换和文件上传按钮），替换为：
\`\`\`tsx
<section className="line-card mb-8 p-6">
  <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
    <UploadQueuePanel
      projectId={projectId}
      isOwner={data.isOwner}
      members={data.members}
      onTasksGenerated={setDraftTasks}
      onRefresh={refresh}
    />

    <div className="soft-panel rounded-[28px] p-6">
      {/* 保留现有的 AI 提取关键产出物显示区域 */}
      {/* 第 738-801 行的内容 */}
    </div>
  </div>
</section>
\`\`\`

### 方案 B：保留文本输入模式，仅替换文件上传部分

如果需要保留"粘贴文本"功能，可以：

1. 保留 `inputMode` 状态和切换按钮
2. 在 `inputMode === "file"` 分支中使用 `UploadQueuePanel`
3. 保留 `inputMode === "text"` 分支的现有逻辑

## 需要清理的旧代码

如果采用方案 A，可以删除以下内容：
- `uploadPhase` 状态（第 206 行）
- `uploadError` 状态（第 207 行）
- `inputMode` 状态（第 210 行）
- `textRequirement` 状态（第 211 行）
- `runUpload` 函数（已被新逻辑替代）
- `runTextSubmit` 函数（如果不需要文本输入）
- `busy` 变量（第 552 行）

## UI 效果

### 上传队列显示
每个文件显示为一个卡片，包含：
- 文件名和大小
- 状态图标（Loader2/CheckCircle/XCircle）
- 进度条（仅上传中时显示）
- 取消/移除按钮

### 状态样式
- **等待上传**：灰色 Loader2 图标 + "等待上传..."
- **上传中**：蓝色进度条 + 百分比
- **成功**：绿色 CheckCircle + "上传成功"
- **失败**：红色 XCircle + 错误信息

## 技术细节

### 并发控制
- 使用 `activeUploadsRef` 追踪当前活跃上传数
- `MAX_CONCURRENT_UPLOADS = 2` 限制同时上传数量
- 自动处理队列，完成一个后启动下一个

### 进度追踪
- 使用 `XMLHttpRequest.upload.onprogress` 事件
- 实时更新进度百分比
- 平滑的进度条动画（Tailwind `transition-all duration-300`）

### 取消上传
- 调用 `xhr.abort()` 中止请求
- 从队列中移除该项
- 释放并发槽位

## 后续优化建议

1. **持久化队列**：将队列状态保存到 localStorage，刷新页面后恢复
2. **重试机制**：失败的上传提供"重试"按钮
3. **文件预览**：图片文件显示缩略图
4. **总进度**：显示整体上传进度（已完成/总数）
5. **文件去重**：检测重复文件名，提示用户

## 测试建议

1. 单文件上传
2. 批量上传（3-5 个文件）
3. 拖拽上传
4. 取消上传中的文件
5. 网络慢速模拟（Chrome DevTools）
6. 上传失败场景（超大文件、不支持格式）

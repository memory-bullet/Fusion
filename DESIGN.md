# Fusion UI — 已定稿（勿随意改风格）

面向 **极简、居中、易读**；后续迭代只增功能，**不**换配色体系、圆角尺度与版心逻辑，除非产品明确要求改版。

## 版心与对齐

- 首页版心：**`max-w-6xl`**，标题区仍居中；**须已注册登录**后才显示「打开 / 新建 / 加入」三卡（**`lg` 三列并列**，小屏纵向堆叠）；未登录仅展示登录/注册引导。
- 其他营销/表单页：可继续用较窄 **`max-w-xl`** 居中，`px-5` / `sm:px-6`。
- 内页（项目看板等）可宽于 `xl`，但仍保持统一圆角与按钮样式。

## 色彩（仅中性 + 一处强调）

- 页面底：`neutral-50`（`#fafafa`）。
- 主文字：`neutral-900`；次要说明：`neutral-500`。
- 分割线/描边：`neutral-200` / `border-neutral-200/90`。
- 主按钮：`bg-neutral-900 text-white`；幽灵按钮：`border border-neutral-200 bg-white`。
- 错误：仅文字 `text-red-600`，避免大块红底。

## 账户与消息

- **个人中心**：`/me` — 修改昵称、跨项目待办、链到站内信。
- **注册**：须填写**显示昵称**（与邮箱、密码并列说明）。

## 最后通牒（任务截止）

- **≤72h 且未完成**：`ultimatumLevel = WARN_3D`，看板显示「临期预警」；首次进入窗口时对**负责人**发温和站内信（每任务一次）。
- **≤24h 且未完成**：`ultimatumLevel = RED_24H`，看板显示「进度阻塞」；首次进入窗口时对**项目全员**发强提醒（正文可经 OpenAI 生成一句催促语，无 Key 时用固定模板），并写入动态 `TASK_ULTIMATUM_RED`。
- 任务标记 **完成** 时清空 ultimatum 相关字段。

## 字体

- 全站 **`Noto Sans SC`**（`next/font`），保证中文清晰，避免「像乱码」的 fallback 堆叠。

## 组件形态

- 卡片：`rounded-2xl border bg-white p-5 shadow-sm`（或无边框时用 `ring-1 ring-neutral-200/80`）。
- 输入：`rounded-xl bg-neutral-50 ring-1 ring-inset ring-neutral-200 focus:ring-2 focus:ring-neutral-900`。
- 标题层级：首页主标题 `text-3xl sm:text-4xl font-semibold tracking-tight`，不用渐变字、不用过多装饰英文标签。

## 文案密度

- 说明文字尽量短；避免同一屏多段长说明挤在一起。

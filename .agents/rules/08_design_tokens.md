---
trigger: manual
---

# Design Tokens — admin-web
> 本文档是 `.agents/rules/08_design_tokens.md` 的正式版本，与 `04_frontend_style.md`、`03_react_hooks.md`、`06_redux_state_placement.md` 同级。
> **所有 UI 相关 ticket 在 `/implement` 阶段必须先读取本文档**：颜色、字体、间距、圆角必须从本文档取值，禁止硬编码新的 hex/px 数值。找不到对应 token 时必须先向人确认，不允许 agent 自行创造。

**状态**：🟢 已确认
**最后更新**：2026-07-28
**确认人**：用户

---

## 0. 如何生成/更新本文档

1. 新开一个干净会话（不要和后端分层规则、backend AGENT.md 共享上下文）。
2. 用下方「设计 Brief」章节的内容作为输入，触发 frontend-design 技能的 brainstorm → plan → critique 流程。
3. 只要它的 **token 层产出**（色板、字体、间距、圆角、阴影 + 语义色映射），不需要完整页面代码。
4. 你本人审核确认（对齐第 1 章「设计意图」和第 3 章「已确认原型约束」，不允许与既有原型效果冲突）。
5. 把确认结果同步到第 2、4、5 章，完成一致性检查后将状态改为 🟢。
6. 视觉改动较大时，先做一版「token showcase 页」（色板/字号阶梯/间距/圆角/按钮各状态的纯展示页），肉眼确认无误再进入 ticket #57 的正式开发。

---

## 1. 设计意图

- **产品定位**：内部漫画内容管理后台，服务对象是运营/管理人员，**不是**"温馨一笑"的终端读者，因此不强行呼应小程序侧的暖色系 pastel / 日系治愈风品牌调性，走功能性、语义化配色。
- **核心使用场景**：高频重复操作（审核状态流转、内容筛选、批量管理），优先信息密度和可辨识度，克制"表达欲"，不追求 signature moment。
- **依赖技术栈**：React + shadcn/ui + Tailwind。所有 token 必须能直接映射进 `tailwind.config.js` 的 `theme.extend`。

---

## 2. 设计 Brief（喂给 frontend-design 技能的输入）

```
产品：漫画内容管理后台（内部工具，非品牌触点）
受众：内容运营/管理人员
页面的唯一任务：高效完成漫画内容的审核、发布、下架等状态流转操作

已确认的原型约束（硬边界，不是发挥空间）：
- 列表页：状态 tab 筛选、缩略图网格、状态标签配色、分页
- 编辑页：状态操作按钮动态显示、封面上传三步流程、正文图片拖拽排序、
  标签增删、未保存离开确认提示

技术约束：
- React + shadcn/ui + Tailwind，产出必须可映射进 tailwind.config.js 的 theme.extend
- 已有共享组件 Dialog.jsx / Button，token 系统需与其兼容，不要求重新设计这些组件的视觉

明确要求：
- 不追求独立品牌识别度，优先克制、专业、语义清晰
- 必须产出「业务状态 → 颜色」的语义色映射表（见本文档第 4 章的状态列表）
- 不要 hero/signature 级别的表达，允许一个很小的性格植入点（例如空状态插画风格、
  loading 处理方式），体量要收着用
```

---

## 3. 已确认原型约束（对照存档，不允许被 token 系统推翻）

| 页面 | 已确认交互 |
|---|---|
| 漫画列表页 | 状态 tab 筛选、缩略图、状态标签配色、分页 |
| 漫画编辑页 | 状态操作按钮动态显示、封面上传三步流程、正文图片拖拽排序、标签增删、未保存离开确认提示 |

---

## 4. Token 表

### 4.1 颜色 — 基础色板

| Token 名 | 值 | 用途 |
|---|---|---|
| `color-primary` | `#01875f` | 主操作按钮、链接、选中态 |
| `color-neutral-50` | `#f8f9fa` | 页面浅色背景 |
| `color-neutral-100` | `#f1f3f4` | 次要背景、输入框、草稿标签背景 |
| `color-neutral-300` | `#dadce0` | 边框、输入框描边 |
| `color-neutral-600` | `#5f6368` | 次要文字、草稿标签前景 |
| `color-neutral-900` | `#202124` | 浅色主题正文 |
| `color-danger` | 浅色 `hsl(4 90% 50%)`；深色 `hsl(0 72% 63%)` | 删除等破坏性操作；对应 Tailwind 的 `destructive` |

### 4.2 颜色 — 业务语义映射表（漫画状态）

> 这张表是本文档最关键的部分，直接决定 ticket #57「状态标签配色」的取值，agent 不允许自行判断。

| 业务状态 | 语义 Token | 浅色主题（背景 / 前景） | 深色主题（背景 / 前景） | 使用位置 |
|---|---|---|---|---|
| 草稿 | `status-draft` | `#f1f3f4` / `#5f6368` | `hsl(224 28% 19%)` / `hsl(222 18% 61%)` | 列表页状态标签 / 编辑页状态徽标 |
| 已发布 | `status-published` | `#d1fae5` / `#047857` | `rgb(2 44 34 / 50%)` / `#34d399` | 同上 |
| 已下架 | `status-unpublished` | `#ffedd5` / `#c2410c` | `rgb(67 20 7 / 50%)` / `#fb923c` | 同上 |
| 已删除 | `status-deleted` | `rgb(254 226 226 / 60%)` / `rgb(220 38 38 / 80%)` | `rgb(69 10 10 / 40%)` / `rgb(248 113 113 / 70%)` | 同上 |

> 上表与 `backend/src/models/comic.model.js`、`backend/src/models/series.model.js` 以及管理端状态徽标组件保持一致。每个语义 Token 均包含背景色和前景色，透明度也是状态视觉契约的一部分。

### 4.3 字体

| Token 名 | 字体族 | 用途 |
|---|---|---|
| `font-display` | `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif` | 页面标题 |
| `font-body` | `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif` | 正文、表格、表单 |
| `font-mono` | `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace` | 漫画 ID、时间戳等数据展示；沿用 Tailwind 3.4 默认值 |

> 当前项目没有单独加载展示字体，标题与正文共用 `styles.css` 中的 `body` 字体栈。

### 4.4 间距 / 圆角 / 阴影

| Token 名 | 值 | 用途 |
|---|---|---|
| `spacing-*` | 沿用 Tailwind 默认 4px 基准：`0.5=2px`、`1=4px`、`1.5=6px`、`2=8px`、`2.5=10px`、`3=12px`、`4=16px`、`5=20px`、`6=24px`、`8=32px`、`10=40px`、`12=48px` | 通用间距 |
| `radius-sm` | `8px` | 小型控件圆角；`calc(var(--radius) - 4px)` |
| `radius-md` | `10px` | 中型控件圆角；`calc(var(--radius) - 2px)` |
| `radius-lg` | `12px` | 基础容器圆角；`var(--radius)` |
| `radius-xl` | `12px` | 按钮、输入框圆角；沿用 Tailwind 默认值 |
| `radius-2xl` | `16px` | 卡片圆角；沿用 Tailwind 默认值 |
| `radius-full` | `9999px` | 状态标签、胶囊筛选器圆角 |
| `shadow-sm` | `0 1px 2px 0 rgba(60, 64, 67, 0.3), 0 1px 3px 1px rgba(60, 64, 67, 0.15)` | 低层级卡片 |
| `shadow-md` | `0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15)` | 卡片悬浮 |
| `shadow-lg` | `0 2px 6px 2px rgba(60, 64, 67, 0.15), 0 1px 2px 0 rgba(60, 64, 67, 0.3)` | 弹层、高层级浮层 |

---

## 5. Tailwind 配置片段

```js
// 与 admin-web/tailwind.config.js 保持一致。
// 颜色值由 admin-web/src/styles.css 中的 CSS 变量提供，Tailwind 只负责语义映射。
module.exports = {
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "var(--sidebar)",
          foreground: "var(--sidebar-foreground)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
};
```

配置约束：

- `styles.css` 的 `:root` 和 `.dark` 是颜色 token 的唯一取值来源；新增或调整语义色时，必须同步维护明暗主题变量和本节映射。
- 除 `sidebar` 外，颜色变量保存 HSL 通道值，Tailwind 映射统一使用 `hsl(var(--token))`；`sidebar` 当前保存完整 hex 值，因此直接使用 `var(--sidebar)`。
- 圆角以 `--radius: 12px` 为基准，`rounded-lg`、`rounded-md`、`rounded-sm` 分别对应 12px、10px、8px；禁止在 `theme.extend` 中重复定义同义圆角。
- 正文字体栈当前由 `styles.css` 的 `body` 规则维护，尚未配置 `fontFamily` token。
- Material 3 阴影当前由 `.m3-shadow-sm`、`.m3-shadow-md`、`.m3-shadow-lg` 工具类维护，尚未配置 `boxShadow` token。
- 当前配置尚未提供 `status.*` 业务状态色；第 4.2 节记录的是已确认的语义契约，实际样式由漫画、连载状态徽标组件及 `styles.css` 中的 badge 工具类维护。后续如迁移到 `theme.extend.colors.status`，必须保持明暗色对和透明度一致。

---

## 6. 组件复用指引

- 新组件必须优先复用 `shadcn/ui` 及已有的 `Dialog.jsx` / `Button` 等共享组件，**禁止重新实现同类组件**（弹层、按钮样式等）。
- 新增共享组件前，先检查 admin-web 现有组件目录是否已有等效实现。
- 复用组件的视觉表现如需微调，只允许通过本文档定义的 token 传参，不允许在组件内部硬编码新样式。

---

## 7. 禁止事项清单

- ❌ 引入本文档之外的新 hex 色值
- ❌ 更换本文档之外的字体
- ❌ 自定义圆角/间距数值（必须从本文档 token 中取值）
- ❌ 为单个 ticket/页面单独设计一套"更有识别度"的配色或字体
- ❌ 在没有对应 token 的情况下，agent 自行决定视觉方案而不询问人工

---

## 8. Ticket 验收标准（AC）模板

> 后续 UI 相关 ticket（如 #57）可直接复制以下条目进入验收标准：

```
- [ ] 所有颜色取值均来自 design-tokens.md 中定义的 token，无硬编码 hex
- [ ] 状态标签颜色严格对照 design-tokens.md 第 4.2 节的语义映射表
- [ ] 弹层/按钮等复用 shadcn/ui 及已有 Dialog.jsx / Button，未重新实现
- [ ] 字体/间距/圆角均来自 08_design_tokens.md 定义的 token
```
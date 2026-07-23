---
trigger: manual
---

# 前端样式与 Tailwind 规范

本规范适用于`admin-web` 的 React JSX、CSS、Tailwind 配置和视觉实现。目标是减少 AI 生成代码常见的 inline style、硬编码颜色、重复 hover 补丁和样式分叉问题。

## 一、样式优先级

按以下顺序选择样式方案：

1. 在已有公共组件覆盖当前场景时，优先使用其暴露的样式接口和既有视觉约定。
2. 使用 Tailwind utility classes 组合样式。
3. 使用 `cn` / `clsx` 管理条件 className。
4. 对稳定可复用的视觉模式抽取样式变体或局部样式配置。
5. 仅在第三方组件强制要求时使用内联 `style`，并写明原因。

禁止在业务 JSX 中大面积使用内联 `style` 对象实现布局、颜色、hover、弹窗、卡片、按钮、表格等常规 UI。

## 二、颜色 token

- 颜色必须优先来自 Tailwind theme 或项目设计 token。
- 禁止在 JSX className 中随意使用 `bg-[#xxxxxx]`、`text-[#xxxxxx]`、`border-[#xxxxxx]`。
- 品牌色、语义色、状态色必须集中定义，例如主操作色、成功、警告、危险、信息、页面背景、卡片背景、边框、弱文本、正文文本。
- 一次性品牌外部色可以使用 Tailwind arbitrary value，但必须满足：只出现一次、与第三方品牌或不可控资产有关、不参与项目设计系统。
- 同一颜色值在两个以上位置出现时，必须提升为 token 或复用已有 token。

## 三、间距、尺寸、圆角与阴影

- 间距使用 Tailwind spacing scale，例如 `p-4`、`gap-3`、`mt-6`，禁止随意写 `13px`、`17px`、`29px`。
- 只有对齐图标、边框补偿、第三方嵌入尺寸等场景允许使用 arbitrary value。
- 圆角使用项目约定等级，常规卡片不超过既有设计系统规定；不要随意混用 `rounded-lg`、`rounded-xl`、`rounded-3xl`。
- 阴影使用 Tailwind shadow token 或设计 token；禁止在 JSX 中散落复杂 box-shadow 字符串。
- 宽高固定值必须说明格式约束，例如头像、图标按钮、表格列宽；普通布局优先使用响应式约束。

## 四、禁止内联 style 的范围

以下场景禁止使用内联 `style`：

- 页面布局、网格、弹性布局
- 卡片、按钮、表单、表格、分页、弹窗
- hover、focus、active、disabled 状态
- 颜色、字号、间距、边框、圆角、阴影
- 骨架屏、空状态、错误提示
- `<style>` 标签注入局部 CSS
- `!important` 样式补丁

允许例外：

- React 官方要求的动态数值样式，例如虚拟列表精确定位
- 第三方库只接受 style 对象的 API
- CSS 变量注入，例如运行时主题变量
- Canvas、图表、拖拽定位等强动态渲染

例外必须在代码附近写中文注释说明原因。

## 五、className 组织方式

- 简单静态样式直接写 `className`。
- 条件样式使用项目已有 `cn` / `clsx` 工具，禁止字符串拼接堆复杂三元表达式。
- 多状态组件按基础样式、尺寸样式、状态样式、交互样式组织。
- 不手工争论 Tailwind class 顺序；应使用 `prettier-plugin-tailwindcss` 自动排序。
- 单个元素 className 过长时，应优先提取为小组件或变体配置，而不是改回内联 style。
- 禁止混用 className 和 style 修改同一类视觉属性，例如 className 控制背景色，style 又覆盖背景色。

## 六、状态样式

- hover、focus、active、disabled 使用 Tailwind 变体，例如 `hover:`、`focus-visible:`、`active:`、`disabled:`。
- 可访问焦点必须使用 `focus-visible`，禁止去掉 outline 后不提供替代焦点样式。
- loading、selected、active、danger 等状态应通过条件 className 表达，不通过手写 DOM 事件改样式。
- 禁止使用 React state 只为了模拟 CSS hover；hover 应交给 CSS。

## 七、可访问性与交互语义

- 看起来可交互的元素必须有真实可执行行为；出现 `cursor-pointer`、hover 交互、操作型 `title`、点击态图标时，必须绑定有效事件或导航。
- 禁止添加“摆设型”操作入口；尚未实现的操作不得显示成可点击控件。
- 优先使用语义化元素：点击操作用 `<button>`，导航用 `<a>` 或路由链接，表单输入用对应表单控件。
- 禁止用 `<div onClick>` 或 `<span onClick>` 代替按钮；确有必要时，必须补齐 `role`、`tabIndex`、Enter/Space 键盘事件和焦点样式，并在代码中说明原因。
- 图标按钮必须提供 `aria-label` 或可见文本；`title` 不能替代 `aria-label`。
- 自定义开关、菜单、标签页、弹窗触发器必须表达当前状态，例如 `aria-expanded`、`aria-selected`、`aria-controls`。
- 禁用态必须使用真实 `disabled` 属性；无法使用原生属性时，必须使用 `aria-disabled` 并在事件处理里阻断操作。
- 交互区域必须有稳定可点击尺寸，不能只让图标路径本身响应点击。

## 八、响应式与布局

- 响应式使用 Tailwind 断点变体，例如 `sm:`、`md:`、`lg:`。
- 固定格式 UI 必须设置稳定尺寸或约束，避免文本、图标、loading 状态导致布局跳动。
- 页面级布局禁止使用大量绝对定位拼装；只有浮层、菜单、徽标、拖拽定位等场景可以使用。
- 文本必须考虑换行、截断和长词；列表卡片中的名称、ID、URL 必须明确 `truncate`、`break-words` 或 `line-clamp` 策略。

## 九、公共组件与原型移植

- 本节只约束从 HTML 原型迁移到业务代码时的样式复制风险，不定义组件拆分和组件架构决策。
- 从 HTML 原型迁移时，必须先检查是否存在公共组件或已有页面模式，避免把原型样式当成业务实现直接搬运。
- 禁止把原型里的 `fixed inset-0`、遮罩层、滚动锁、Esc 监听、分页按钮、Toast 容器等整套交互样式复制进业务页面。
- 弹窗、确认框、Toast、Pagination、上传、表格、空状态等是否复用或扩展公共组件，以各子项目 `AGENT.md` 和对应 skill 为准。

## 十、审查清单

- 是否存在业务 JSX 大量 `style={{ ... }}`？
- 是否存在 `<style>` 注入或 `!important`？
- 是否存在重复硬编码颜色？
- 是否存在 arbitrary value 可以被 token 替代？
- 是否存在 React state 只服务 hover 样式？
- 是否存在看起来可点击但没有真实行为的元素？
- 是否存在图标按钮缺少 `aria-label`？
- 是否存在可点击 `div` / `span` 未补齐键盘交互？
- 是否绕过了公共 Dialog、Toast、Pagination？
- 是否 className 与 style 同时控制同一视觉属性？
- 是否长文本、loading、disabled 状态会撑破布局？
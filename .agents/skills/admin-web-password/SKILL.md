---
name: admin-web-password
description: Use when 在 admin-web 中使用 PasswordInput 密码输入组件、新增或修改密码输入框、切换密码可见性、处理主题适配的密码字段或排查密码输入相关交互时
---

# admin-web PasswordInput

## 概述

`admin-web/src/components/PasswordInput.jsx` 是 admin-web 的受控密码输入组件，内置**左侧安全图标**与**右侧密码可见性切换按钮**。所有密码输入场景（登录、注册、重置密码、二次验证）统一使用此组件。

## Props 契约

| Prop | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `value` | `string`（必填） | — | 受控值，由父组件管理 |
| `onChange` | `func`（必填） | — | 值变化回调，接收原生 `event` 对象 |
| `placeholder` | `string` | `"请输入您的密码"` | 占位文本 |
| `icon` | `elementType` | `Lock`（lucide-react） | 左侧前置图标组件；传 `null` 可隐藏 |
| `className` | `string` | `""` | 外层容器追加类名 |
| `inputClassName` | `string` | `""` | 内部 `<input>` 追加类名 |
| `required` | `bool` | `false` | 是否必填 |
| `disabled` | `bool` | `false` | 禁用整个输入框及眼睛按钮 |
| `theme` | `'auto'` `|` `'dark'` `|` `'light'` | `'auto'` | 主题模式，见下方主题系统 |
| `name` | `string` | — | 原生 `name` 属性，用于浏览器自动填充 |
| `autoComplete` | `string` | — | 原生 `autoComplete`，如 `"current-password"` |
| `...props` | — | — | 其余属性透传给内部 `<input>` |

## 主题系统

`theme` 控制输入框的暗色/亮色样式，适配不同页面背景：

| theme | 适用场景 |
| --- | --- |
| `auto`（默认） | 通用场景，通过 Tailwind `dark:` 前缀同时适配亮/暗模式 |
| `dark` | 深色背景页面（如登录页渐变背景），输入框采用半透明白色 + 白色文字 |
| `light` | 强制亮色，使用 `bg-card` / `border-border` 等 CSS 变量，适用于浅色表单卡片 |

> **选择原则**：页面整体跟随系统主题时用 `auto`；页面强制深色背景时用 `dark`；弹窗或表单卡片内用 `light`。

## 调用模板

### 标准受控用法

```jsx
import PasswordInput from '@/components/PasswordInput';

const [password, setPassword] = useState('');

<PasswordInput
  name="password"
  autoComplete="current-password"
  value={password}
  onChange={(e) => setPassword(e.target.value)}
  placeholder="请输入您的密码"
  disabled={isLoading}
  className="w-full"
/>
```

## 核心工作原理

- **可见性切换**：点击右侧眼睛按钮调用 `setShowPassword(!showPassword)`，改变内部 `<input>` 的 `type` 属性在 `"password"` 与 `"text"` 之间切换。切换时调用 `e.preventDefault()` 阻止意外触发表单提交。
- **禁用联动**：`disabled` 同时禁用了 `<input>` 和眼睛按钮，按钮额外追加 `disabled:cursor-not-allowed`。
- **图标状态指示**：密码可见时眼睛图标变为 `EyeOff` 并高亮为 `text-primary`，反之显示 `Eye`。
- **图标区域不可交互**：左侧图标区域设置了 `pointer-events-none`，不会拦截点击事件。

## 常见错误

| 错误 | 修正 |
| --- | --- |
| 裸写 `<input type="password">` 并手写眼睛切换逻辑 | 替换为 `<PasswordInput>` |
| 在深色背景页面使用默认 `theme="auto"` 导致看不清 | 显式设置 `theme="dark"` |
| 传入了 `icon={null}` 但没有调整内边距 | 左侧图标默认占 `pl-10`，隐藏图标时通过 `inputClassName` 覆盖为 `pl-3` |
| 点击眼睛按钮意外触发了外层 `<form>` 的 `onSubmit` | 组件内部已调用 `e.preventDefault()`，如仍触发请检查是否有外层事件拦截 |
| 忘记传 `autoComplete` 导致浏览器密码管理器无法识别 | 登录表单传入 `autoComplete="current-password"`，注册/重置传入 `autoComplete="new-password"` |

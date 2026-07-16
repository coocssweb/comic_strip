---
name: admin-web-button
description: Use when 在 admin-web 中使用 Button 组件、选择 variant 或 size、使用 buttonVariants 工具、排查按钮样式或新增按钮变体时
---

# admin-web Button

## 概览

`admin-web/src/components/ui/button.jsx` 是基于 shadcn Button 的定制版本，内置了 loading 防抖状态与 icon 插槽。项目内所有按钮必须使用该组件或 `buttonVariants` 工具函数，**禁止**直接使用原生 `<button>` 标签并裸写 Tailwind 类。

## Variant 体系

| Variant | 用途 | 对应类名 |
| --- | --- | --- |
| `default` | 主操作（保存、提交、确认） | bg-primary text-primary-foreground |
| `destructive` | 危险操作（删除、停用、移除） | bg-destructive text-destructive-foreground |
| `outline` | 边框按钮，次要操作 | border border-input bg-background |
| `secondary` | 浅色填充按钮 | bg-secondary text-secondary-foreground |
| `ghost` | 无背景按钮，hover 时显示背景 | hover:bg-accent hover:text-accent-foreground |
| `link` | 链接样式，带下划线效果 | text-primary underline-offset-4 hover:underline |

> **选型原则**：保存、提交表单优先使用 `default`；危险的删除确认优先使用 `destructive`；取消、返回优先使用 `outline`；行内纯图标或轻量操作优先使用 `ghost`。

## Size 体系

| Size | 高度 | 常用场景 |
| --- | --- | --- |
| `default` | h-10 | 标准按钮（表单底部、弹窗主要操作栏） |
| `sm` | h-9 | 列表上方筛选、表格操作列按钮（更紧凑） |
| `lg` | h-11 | 首页醒目操作、巨型表单提交 |
| `icon` | h-10 w-10 | 纯图标按钮（正方形） |

## 核心扩展 Props

### 1. `loading` 防重复提交
当 `loading={true}` 时：
- 按钮会自动进入禁用状态 (`disabled`)，阻止用户二次点击。
- 按钮左侧会自动渲染 `Loader2` 旋转 Spinner 动画。
- 此时 `leftIcon` 和 `rightIcon` 会被自动隐藏，以防布局混乱。

```jsx
<Button loading={isSubmitting} onClick={handleSubmit}>
  提交申请
</Button>
```

### 2. `leftIcon` 和 `rightIcon`
直观插入 Lucide 等图标，组件会自动应用间距控制：
```jsx
import { Plus, ChevronRight } from 'lucide-react';

<Button leftIcon={<Plus />}>新增数据</Button>
<Button rightIcon={<ChevronRight />} variant="outline">下一步</Button>
```

## buttonVariants 工具函数

在非 `<Button>` 元素上（例如 `<a>` 或 React Router 的 `<Link>`）复用按钮样式时使用：

```jsx
import { buttonVariants } from '@/components/ui/button';

<a className={buttonVariants({ variant: 'outline', size: 'sm' })} href="/export">
  导出报表
</a>
```

## asChild 模式

将样式和交互行为完全委托给唯一的子元素（常用于 `<Link>`）：

```jsx
import { Link } from 'react-router-dom';

<Button asChild variant="link">
  <Link to="/settings">前往设置</Link>
</Button>
```

## 禁止事项

- **不要重复封装防抖**：`Button` 组件已内置 `loading` 逻辑，不要再手写 `if (loading) return`。
- **不要用内联样式绕过**：禁止 `<button className="bg-blue-600 px-4 py-2">` 这类写法。
- **不要原生标签**：统一使用组件库导出的 `<Button>`。
- **不要随意自定义 Variant**：现有 Variant 已覆盖绝大部分后台场景，如确有特殊设计，通过 `className` 追加个性化样式。

## 常见错误

| 错误 | 修正 |
| --- | --- |
| 手写 Spinner 并放置在 children 里 | 直接传 `loading={true}` |
| 给 `Link` 组件包一层 `Button` 导致 DOM 嵌套问题 | 使用 `asChild` 模式：`<Button asChild><Link ...>内容</Link></Button>` |
| 行内操作按钮尺寸过大 | 列表操作列按钮请指定 `size="sm"` |
| 按钮加载中仍然被连续点击 | `loading` 状态已自动处理 `disabled`；如仍有重复提交，请检查异步函数是否正确修改了 loading 变量 |

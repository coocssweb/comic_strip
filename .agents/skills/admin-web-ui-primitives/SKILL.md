---
name: admin-web-ui-primitives
description: Use when 在 admin-web 中使用 Input、Switch、DropdownMenu 等 shadcn 基础 UI 组件、查找组件路径、确认样式约定或判断是否需要重复封装时
---

# admin-web UI 基础组件

## 概览

以下组件均位于 `admin-web/src/components/ui/`，是由 shadcn 原语组件定制而成的项目规范基础 UI 组件。在开发 `admin-web` 页面时，应优先直接引用这些基础组件，**禁止**为了单纯增加 label 或包装额外样式而重复封装多余的组件层（直接在业务层将它们与 label 组合使用即可）。

## 组件速查

| 组件 | 引用路径 | 基于原语 | 项目样式与交互定制 |
| --- | --- | --- | --- |
| **Input** | `@/components/ui/input` | 原生 `<input>` | 整合了 rounded-xl 圆角、border-border 边框、bg-card 背景。支持 `size` 变体，定制了聚焦状态下的边框与 ring 颜色。 |
| **Switch** | `@/components/ui/switch` | Radix Switch | 整合了 bg-input 到 bg-primary 的过渡色、圆角、阴影。受控属性为 `checked` 与 `onCheckedChange`。 |
| **DropdownMenu** | `@/components/ui/dropdown-menu` | Radix Dropdown Menu | 默认使用 Portal 渲染，处理了下拉开合动画、溢出裁剪、子菜单（SubMenu）、复选（Checkbox）和单选（Radio）等交互原语。 |

---

## Input

输入框组件基于 `cva` 引入了高度和字体大小的规范：

```jsx
import { Input } from '@/components/ui/input';

<Input
  type="text"
  placeholder="请输入账号名称"
  value={username}
  onChange={(e) => setUsername(e.target.value)} // 使用标准原生 onChange
  size="default"
  className="w-64"
/>
```

### 尺寸变体 (`size`)
- `default`：**高度 h-9**，字体 text-xs。常用于顶部检索过滤栏、表格上方的搜索框等紧凑区。
- `lg`：**高度 h-11**，字体 text-xs font-semibold。常用于模态弹窗大表单或主要操作入口。

### 规则与约束
- 已内置 `disabled` 样式（半透明、禁止指针、置灰）以及 `file` 类型样式。
- 需要带 label 或校验错误状态时，应在业务表单层直接拼装：
  ```jsx
  <div className="space-y-1">
    <label className="text-xs font-bold text-muted-foreground">用户名称</label>
    <Input value={username} onChange={...} />
    {error && <span className="text-xs text-destructive">{error}</span>}
  </div>
  ```

---

## Switch

开关组件是基于 Radix Switch UI 的逻辑和样式定制：

```jsx
import { Switch } from '@/components/ui/switch';

<Switch
  checked={isActive}
  onCheckedChange={(checked) => setIsActive(checked)} // 注意：不是 onChange
  disabled={isLoading}
/>
```

### 规则与约束
- **注意**：其受控事件是 `onCheckedChange` 且直接传回 `boolean`，受控状态是 `checked`。**不要**误用原生的 `onChange` 或 `value`。
- 不要使用原生 `<input type="checkbox">` 来实现开关按钮。

---

## DropdownMenu

下拉菜单是由细粒度组件拼接而成的套件，支持嵌套、勾选等复杂操作。

```jsx
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, User, LogOut } from 'lucide-react';

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon">
      <MoreHorizontal className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  
  <DropdownMenuContent className="w-40" align="end">
    <DropdownMenuItem onClick={goProfile}>
      <User className="mr-2 h-4 w-4" />
      <span>个人中心</span>
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={handleLogout} className="text-destructive">
      <LogOut className="mr-2 h-4 w-4" />
      <span>登出账号</span>
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### 原语组件明细
- `DropdownMenu`：状态基座。
- `DropdownMenuTrigger`：触发器，通常需要加 `asChild` 属性将事件和样式委派给内部的 `<Button>`。
- `DropdownMenuContent`：浮层内容容器。默认会在 Portal 中挂载渲染，因此在 Dialog 或 Drawer 中也不会受到外层 `overflow: hidden` 的裁剪限制。可以使用 `align="start"|"end"` 等控制对齐。
- `DropdownMenuItem`：菜单项。支持 `disabled`。
- `DropdownMenuSeparator`：灰色的分割线。
- `DropdownMenuCheckboxItem` / `DropdownMenuRadioItem`：用于复选和单选菜单。

---

## 通用风格约定

- 所有基础组件均支持通过 `cn()` 合并外部传入的 `className`，以便覆盖宽度、外边距等布局样式。
- **视觉风格一致性**：组件内的圆角、聚焦边框颜色、聚焦发光 ring、字体缩放等已在对应 `@/components/ui/` 文件内统一定义，**禁止**在页面业务层写死内联样式或用强行覆盖的方式破坏全局 UI 系统。
- 如果引入了其他 shadcn 基础组件（如 `badge`、`avatar` 等），如果是低逻辑的样式包裹，应在本 skill 中补充速查表格以供后续开发者查阅。

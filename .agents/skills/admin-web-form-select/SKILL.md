---
name: admin-web-form-select
description: Use when 在 admin-web 中使用 FormSelect 下拉选择框、处理 Radix Select 的 value 类型问题、空值回显、表单选项或排查 FormSelect.jsx 相关交互
---

# admin-web FormSelect

## 概览

`admin-web/src/components/FormSelect.jsx` 是基于 shadcn Select（Radix UI）封装的受控下拉选择组件。它解决了两个 Radix UI 原生设计的痛点：**其一，Radix 强制要求 value 必须是 string；其二，空值会导致 placeholder 无法正确回显。**

在 admin-web 项目中，表单下拉选择推荐统一使用 `FormSelect`，避免裸写细粒度 Select 原语或使用原生 `<select>`。

## 关键特色与差异

1. **类型安全回传（重要）**：
   - 传入的 `value` 即使是 `number` 类型，组件内部会自动 `String()` 处理以确保 Radix UI 正常渲染。
   - **当选项改变触发 `onChange` 时，组件会在 `options` 中寻找对应的项，回传该项的原始 value 类型**（如果定义选项的 value 是 `number`，回调参数就是 `number`；如果是 `string`，回调参数就是 `string`）。
   - **业务层无需再手动编写 `Number(val)` 转换逻辑**。
2. **多尺寸支持**：
   - 支持 `size` 变体，高度适配不同的后台场景。

## Props 契约

| Prop | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `value` | `string\|number` | — | 当前选中值（支持字符串或数字） |
| `onChange` | `func` | — | 值变化回调。**参数为所匹配选项的原始类型值（可为 string 或 number）** |
| `options` | `[{value, label, disabled}]` | `[]` | 选项列表；`value` 支持 string 或 number，`label` 支持 node 节点 |
| `placeholder` | `string` | `"请选择"` | 未选择值时的占位文本 |
| `disabled` | `bool` | `false` | 是否禁用选择框 |
| `className` | `string` | — | 触发器（Trigger）的额外样式类名 |
| `contentClassName`| `string` | — | 下拉浮动面板（Content）的额外样式类名 |
| `size` | `'default'\|'md'\|'sm'`| `'default'` | 尺寸大小。`default`: h-10; `md`: h-9; `sm`: h-8 |

## 尺寸与场景

| Size | 高度 | 常用场景 |
| --- | --- | --- |
| `default` | h-10 | 模态弹窗表单、独立编辑大卡片 |
| `md` | h-9 | 页面顶部的检索与过滤栏 |
| `sm` | h-8 | 分页条中的“每页条数”选择器 |

## 调用模板

```jsx
import React, { useState } from 'react';
import FormSelect from '@/components/FormSelect';

const StatusFilter = () => {
  // value 为 number 类型
  const [status, setStatus] = useState(1);

  return (
    <FormSelect
      value={status}
      onChange={(val) => setStatus(val)} // 这里的 val 依然是 number 类型，无需手动转换
      options={[
        { value: 1, label: '已启用' },
        { value: 0, label: '已禁用' },
        { value: -1, label: '已删除', disabled: true },
      ]}
      placeholder="选择状态"
      size="md"
      className="w-32"
    />
  );
};
```

## 核心工作原理

- **空值处理**：当 `value` 为 `null`、`undefined` 或空字符串 `""` 时，组件会将内部 value 桥接为 `undefined` 传给 Radix。这能确保 Select 正确回显 `placeholder` 文本。
- **定位层级 (Z-Index)**：由于基于 Radix Portal 渲染，下拉菜单默认会正确悬浮于弹窗、抽屉最上层，如遇到被截断或遮挡，可使用 `contentClassName` 追加 `z-[9999]` 类名。

## 常见错误

| 错误 | 修正 |
| --- | --- |
| 使用 HTML 原生 `<select>` 标签 | 替换为 `<FormSelect>` |
| 以为 `onChange` 只返回 `string`，在外面写了 `Number(val)` | 直接接收 `val` 即可，`FormSelect` 会根据 options 的配置回传原始类型 |
| 传入空字符串 `""` 却看到下拉选中了空白项 | `FormSelect` 已处理 `""` 到 `undefined` 的映射。请检查 `options` 中是否不小心包含了 `value: ""` 的选项，如有需要应移除或正确处理该选项 |
| `options` 中的 value 是 number，但传入的初始化 `value` 是 string `'1'` 导致匹配失效 | 确保初始化状态的类型与 options 中 value 的类型完全一致 |

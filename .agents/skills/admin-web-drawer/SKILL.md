---
name: admin-web-drawer
description: Use when 在 admin-web 中新增、重构或排查侧边抽屉、底部抽屉、SideDrawer、Drawer 滑出面板、遮罩关闭或 drawer.jsx 相关交互
---

# admin-web Drawer

## 概览

`admin-web/src/components/ui/drawer.jsx` 是 admin-web 的通用抽屉组件，它导出两类不同方向的抽屉：

- **`SideDrawer`**（**默认导出**）— 右侧滑出的后台业务抽屉，带头部信息栏、内容滚动区、底部固定操作栏，基于 vaul 封装。
- **shadcn Drawer 原语**（**命名导出**）— 标准底部向上拉出的抽屉（Drawer、DrawerContent 等），一般适用于移动端面板或底部展示。

> **规范**：后台管理中的“查看详情”、“编辑复杂表单”、“展示审核历史”等右侧滑出交互，**统一使用默认导出的 `SideDrawer`**，不要手写 `fixed right-0` 容器。

## 选型规则

| 交互场景 | 推荐组件 |
| --- | --- |
| 右侧滑出的详情页、配置页、大型表单、审计日志 | `SideDrawer`（默认导出） |
| 移动端轻量选择器、底部操作菜单 | shadcn `Drawer`（命名导出） |
| 居中表单弹窗、删除二次确认、警告框 | `Dialog` / `Dialog.alert` |

## SideDrawer Props

| Prop | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `isOpen` | `bool` (必填) | — | 控制抽屉的打开与关闭 |
| `onClose` | `func` (必填) | — | 关闭事件回调 |
| `title` | `node` | — | 抽屉标题 |
| `subtitle` | `string` | — | 标题下方的小字副标题 |
| `icon` | `elementType` | — | 标题左侧可选的 Lucide 图标组件 |
| `extra` | `node` | — | 头部栏右侧、关闭按钮左侧的自定义操作区 |
| `footer` | `node` | — | 底部固定栏内容 |
| `width` | `string` | `"max-w-lg"` | 最大宽度类名，支持 `max-w-xl`、`max-w-2xl`、`max-w-3xl` 等 |
| `closable` | `bool` | `true` | 是否展示右上角的关闭按钮 |
| `maskClosable` | `bool` | `true` | 点击遮罩层是否允许关闭 |
| `className` | `string` | — | 面板容器追加类名 |
| `maskClassName` | `string` | — | 遮罩层追加类名 |
| `bodyClassName` | `string` | — | 中间内容区域追加类名 |

## SideDrawer 调用模板

```jsx
import SideDrawer from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';

const ExampleDrawer = ({ isOpen, onClose }) => {
  const handleSave = async () => {
    await api.saveData();
    onClose();
  };

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="配置详情"
      subtitle="CONFIG DETAIL"
      icon={FileText}
      width="max-w-2xl"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSave}>保存更改</Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* 表单或详情内容 */}
        <p>在此编写抽屉内容...</p>
      </div>
    </SideDrawer>
  );
};
```

## SideDrawer.show 命令式动态挂载

类似于 `Dialog.show`，用于不需要维护本地 `isOpen` 状态的场景。

```jsx
import SideDrawer from '@/components/ui/drawer';
import DetailView from './DetailView';

// 调起抽屉并等待用户操作
const isSaved = await SideDrawer.show(DetailView, { itemId: 456 });
if (isSaved) {
  refreshList();
}
```

*注意：动态挂载的子组件（如 `DetailView`）需接收并正确执行 `isOpen`、`onClose`、`onSuccess` 三个由 Wrapper 注入的 Props。*

## 关键交互行为

- **防误触关闭**：`SideDrawer` 的拖拽关闭和遮罩点击关闭由 `dismissible = maskClosable && closable` 共同决定。若要完全锁定不允许误触关闭，请设置 `maskClosable={false}`。
- **内容区滚动**：内容区域已内置 `overflow-y-auto`。当内容超长时，头部和底部操作栏将自动固定在上下两端，内容区域独立滚动。

## 常见错误

| 错误 | 修正 |
| --- | --- |
| 用声明式 `Dialog` 做长表单的侧边滑出 | 切换为 `SideDrawer` |
| 使用 `SideDrawer` 作为底部上拉抽屉 | 底部上拉应使用命名导出的 `Drawer` + `DrawerContent` 结构 |
| 抽屉内容超长导致底部按钮被顶出屏幕 | 必须将按钮写在 `footer` prop 中，以确保按钮固定在底部 |
| 传入了 `icon` 属性却传了组件实例（如 `<FileText />`） | 应该传组件定义（如 `icon={FileText}`） |

---
name: admin-web-dialog
description: Use when 在 admin-web 中新增、重构或排查弹窗、确认对话框、命令式渲染、Portal、Modal.confirm、Modal.show 等相关交互，或者编写自定义弹窗组件时使用
---

# admin-web Dialog

## 概览

`admin-web/src/components/Dialog.jsx` 是 admin-web 的通用弹窗基座，基于 Radix UI / shadcn 的 Dialog 重构，向下兼容原有 `Modal` 的所有 Props。新增业务弹窗优先复用它，新增确认操作使用 `Dialog.alert`，需要动态挂载表单等组件使用 `Dialog.show`，不要手写 Portal、遮罩层或滚动锁。

> **迁移说明**：旧 `Modal` 组件已重构为 `Dialog`。所有旧 `Modal` -> `Dialog`，`Modal.confirm` -> `Dialog.alert`，`Modal.show` -> `Dialog.show`。

## 何时使用

- 表单弹窗、预览、详情面板等居中弹层。
- 删除、取消、提交前的二次确认（`Dialog.alert`）。
- 动态加载复杂的独立表单/向导式弹层（`Dialog.show`）。

不适用：
- Toast 轻提示 → `Toast`；侧边抽屉/右侧滑出详情面板 → `SideDrawer`；移动端底部面板 → `Drawer`。

## 声明式弹窗 Props

| Prop | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `isOpen` | `bool` (必填) | — | 控制弹窗显示 |
| `onClose` | `func` | — | 关闭回调 |
| `title` | `node` | — | 标题；不传则隐藏标题区 |
| `subtitle` | `string` | — | 副标题（配合 title 展示为小字） |
| `icon` | `elementType` | — | 标题左侧可选的 Lucide 图标组件 |
| `widthClass` / `width` | `string` | `"max-w-md"` | 弹窗最大宽度，支持 `max-w-sm`、`max-w-lg` 等 |
| `closable` | `bool` | `true` | 是否展示右上角关闭按钮 |
| `showClose` | `bool` | `true` | 是否显示关闭按钮（与 closable 共同控制） |
| `maskClosable` | `bool` | `false` | 点击遮罩是否关闭（默认 false，防止意外关闭导致数据丢失） |
| `pure` | `bool` | `false` | 纯底座模式：仅提供 Portal 和背景遮罩，内容卡片样式完全自理 |
| `className` | `string` | — | 弹窗面板追加类名 |
| `maskClassName` | `string` | — | 遮罩层追加类名 |
| `bodyClassName` | `string` | — | 内容区域追加类名 |
| `footer` | `node` | — | 声明式自定义底部操作栏 |
| `onOk` | `func` | — | 确定按钮点击回调（返回 Promise 可自动管理 okLoading 状态） |
| `onCancel` | `func` | — | 取消按钮点击回调（未传时默认调用 onClose） |
| `okText` | `node` | `"确定"` | 确定按钮文案 |
| `cancelText` | `node` | `"取消"` | 取消按钮文案；传 `null` 时隐藏取消按钮 |
| `okLoading` | `bool` | `false` | 确定按钮是否处于 loading 状态 |
| `okType` | `'default'\|'destructive'` | `'default'` | 确定按钮风格，删除等危险操作设为 `'destructive'` |
| `okButtonProps` | `object` | `{}` | 传给确定 Button 组件的额外属性 |
| `cancelButtonProps`| `object` | `{}` | 传给取消 Button 组件的额外属性 |

## 声明式弹窗模板

### 1. 经典包装模式（推荐）
```jsx
import Dialog from '@/components/Dialog';
import { Button } from '@/components/ui/button';

const ExampleDialog = ({ isOpen, onClose }) => {
  const handleOk = async () => {
    // 模拟 API 请求
    await api.submitData();
  };

  return (
    <Dialog 
      isOpen={isOpen} 
      onClose={onClose} 
      title="新建项目" 
      subtitle="PROJECT CREATION"
      onOk={handleOk}
      okText="确认创建"
    >
      <div className="space-y-4 py-2">
        <p className="text-xs font-semibold text-slate-500">
          确认要创建一个新的媒体项目吗？
        </p>
      </div>
    </Dialog>
  );
};
```

### 2. 自定义 Footer / 纯底座模式
如果需要个性化控制脚部按钮：
```jsx
<Dialog 
  isOpen={isOpen} 
  onClose={onClose} 
  title="属性配置"
  footer={
    <>
      <Button variant="ghost" onClick={onClose}>跳过</Button>
      <Button onClick={handleSave}>立即保存</Button>
    </>
  }
>
  <div>内容</div>
</Dialog>
```

## Dialog.alert 命令式确认框

返回 `Promise<boolean>`，`true` 表示用户点了确定，`false` 表示取消或关闭。底层基于 `AlertDialog` 重构。

```jsx
import Dialog from '@/components/Dialog';

const confirmed = await Dialog.alert({
  title: '确认删除该账号？',
  content: '账号删除后，关联的媒体数据将无法恢复。',
  okText: '确认删除',
  cancelText: '取消',
  okType: 'danger', // 危险操作，按钮会显示为红色 destructive 变体
  onOk: async () => {
    await api.deleteAccount(id); // 支持异步逻辑，执行中按钮自动 loading
  }
});
if (!confirmed) return;
```

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `title` | `string` | 标题（默认“确认操作”） |
| `content` / `description` | `node` | 描述信息；支持字符串或 JSX |
| `okText` | `string` | 确定按钮文案，默认“确定” |
| `cancelText` | `string\|null` | 取消按钮文案，默认“取消”；传 `null` 隐藏取消按钮 |
| `okType` | `'default'\|'danger'` | 设为 `'danger'` 时，确定按钮采用 destructive 变体，警告图标采用红色 |
| `className` | `string` | AlertDialogContent 追加类名 |
| `onOk` | `func` | 确定回调，支持 Promise 异步拦截 |
| `onCancel` | `func` | 取消回调 |

## Dialog.show 命令式动态挂载

用于无需声明式维护 `isOpen` 状态，直接调起弹窗并获取返回值的场景。底层通过 `CommandWrapper` 处理，会自动向子组件注入 `isOpen`、`onClose` 和 `onSuccess`。

```jsx
import Dialog from '@/components/Dialog';
import RecordEditForm from './RecordEditForm';

// 调用动态挂载
const result = await Dialog.show(RecordEditForm, { recordId: 123 });
if (result) {
  // 弹窗中调用了 onSuccess(data)
  console.log('保存成功的数据：', result);
}
```

**子组件开发规范：**
```jsx
// RecordEditForm.jsx 必须接收并正确调用以下 props
const RecordEditForm = ({ recordId, isOpen, onClose, onSuccess }) => {
  const handleSave = () => {
    // 成功后，调用 onSuccess 并传入结果，这会解开 show 的 Promise 并自动关闭弹窗
    onSuccess({ id: recordId, status: 'saved' });
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="编辑记录">
      <div>表单内容</div>
      <Dialog.Footer>
        <Button variant="outline" onClick={onClose}>取消</Button>
        <Button onClick={handleSave}>保存</Button>
      </Dialog.Footer>
    </Dialog>
  );
};
```

## 常见错误

| 错误 | 修正 |
| --- | --- |
| 手写 `fixed inset-0` 遮罩和 Portal | 复用 `Dialog` |
| 使用已移除的 `Modal` 或 `Modal.confirm` | 改为 `Dialog` 和 `Dialog.alert` |
| `maskClosable` 设为 `true` 导致误触 | 表单或重要操作弹窗应将 `maskClosable` 设为 `false`（默认） |
| `Dialog.alert` 传入的危险操作类型写错 | 危险操作应传入 `okType: 'danger'`（注意区别于声明式的 `okType: 'destructive'`） |
| 命令式弹窗无法拦截关闭 | `onOk` 必须返回 `Promise`，抛出错误或 `reject` 会拦截弹窗关闭 |

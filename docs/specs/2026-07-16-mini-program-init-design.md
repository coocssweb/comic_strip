# 微信小程序项目骨架初始化 — 设计文档

## 背景

为 comic-strip 项目初始化微信小程序端（`mini-program/`），使用原生框架 + MobX 状态管理。

## 技术栈

- 微信小程序原生框架：WXML + WXSS + JS + JSON
- 状态管理：`mobx-miniprogram` ^4.13.2 + `mobx-miniprogram-bindings` ^2.1.7
- 最低基础库版本：2.11.0
- npm 构建：通过微信开发者工具「构建 npm」

## 目录结构

```
mini-program/
├── miniprogram/
│   ├── app.js
│   ├── app.json
│   ├── app.wxss                  # 全局样式 + 设计 token
│   ├── pages/
│   │   └── index/                # 示例页面（Page 级 store 绑定）
│   │       ├── index.js
│   │       ├── index.wxml
│   │       ├── index.wxss
│   │       └── index.json
│   ├── components/
│   │   └── counter/              # 示例组件（Component 级 store 绑定）
│   │       ├── counter.js
│   │       ├── counter.wxml
│   │       ├── counter.wxss
│   │       └── counter.json
│   ├── stores/
│   │   ├── counter.js            # counterStore
│   │   └── index.js              # 汇总导出
│   └── utils/
├── package.json
├── project.config.json
├── .gitignore
└── README.md
```

## Store 设计

### counterStore

- `count`：数值状态
- `isEven`：computed，判断奇偶
- `increment`、`decrement`、`reset`：三个 action

### 绑定方式

- **Page**：`onLoad` 中 `createStoreBindings`，`onUnload` 中 `destroyStoreBindings`
- **Component**：`behaviors: [storeBindingsBehavior]` + `storeBindings` 配置项

### fields 绑定演示

- 字符串映射：`'count'`
- 函数映射：`() => counterStore.isEven`

### 数据流转

页面和组件操作同一个 counterStore，修改 count 后两处自动同步更新。

## 决策记录

| 决策 | 选项 | 结论 | 原因 |
|------|------|------|------|
| store 目录命名 | `store/` vs `stores/` | `stores/` | 用户选择，需同步更新 AGENT.md |
| 示例类型 | Counter vs TodoList | Counter | 更轻量，足以演示绑定 |
| behaviors/ 目录 | 创建 vs 不创建 | 不创建 | storeBindingsBehavior 直接从包导入即可 |

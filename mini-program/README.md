# 漫画条小程序

微信小程序原生框架 + MobX 状态管理。

## 技术栈

- 微信小程序原生框架（WXML + WXSS + JS + JSON）
- 状态管理：`mobx-miniprogram` + `mobx-miniprogram-bindings`
- 最低基础库版本：**2.11.0**

## 快速开始

### 1. 安装依赖

```bash
cd mini-program
npm install
```

### 2. 构建 npm

在微信开发者工具中：

1. 打开项目（选择 `mini-program/` 目录）
2. 点击菜单栏 **工具 → 构建 npm**
3. 构建成功后，`miniprogram/miniprogram_npm/` 目录会自动生成

> 每次新增或更新 npm 依赖后，都需要重新执行「构建 npm」。

### 3. 编译预览

构建 npm 完成后，点击「编译」即可在模拟器中预览。

## Store 组织约定

### 目录结构

```
miniprogram/stores/
├── counter.js   # counterStore（示例）
├── user.js      # userStore（按业务拆分）
├── order.js     # orderStore
└── index.js     # 汇总导出
```

### 约定

- 每个 store 一个文件，使用 `observable` + `action` 定义
- `stores/index.js` 负责汇总导出，页面和组件统一从此文件引入
- 禁止在 store 外直接修改 observable 属性，必须通过 action

### 新增 Store 步骤

1. **创建 store 文件**：在 `miniprogram/stores/` 下新建 `xxx.js`

   ```js
   import { observable, action } from 'mobx-miniprogram'

   export const xxxStore = observable({
     // 状态
     someField: '',

     // 计算属性
     get derivedField() {
       return this.someField.length
     },

     // action
     updateField: action(function (value) {
       this.someField = value
     })
   })
   ```

2. **在 index.js 中导出**：

   ```js
   export { xxxStore } from './xxx'
   ```

3. **在页面或组件中绑定**：

   **Page 绑定：**

   ```js
   import { createStoreBindings } from 'mobx-miniprogram-bindings'
   import { xxxStore } from '../../stores/index'

   Page({
     onLoad() {
       this.storeBindings = createStoreBindings(this, {
         store: xxxStore,
         fields: { someField: 'someField' },
         actions: { updateField: 'updateField' }
       })
     },
     onUnload() {
       this.storeBindings.destroyStoreBindings()
     }
   })
   ```

   **Component 绑定：**

   ```js
   import { storeBindingsBehavior } from 'mobx-miniprogram-bindings'
   import { xxxStore } from '../../stores/index'

   Component({
     behaviors: [storeBindingsBehavior],
     storeBindings: {
       store: xxxStore,
       fields: { someField: 'someField' },
       actions: { updateField: 'updateField' }
     }
   })
   ```

## fields 绑定方式

| 方式 | 写法 | 说明 |
|------|------|------|
| 字符串映射 | `count: 'count'` | 直接映射 store 同名字段 |
| 函数映射 | `isEven: () => store.isEven` | 自定义计算逻辑，适合 computed 属性 |

## 项目配置说明

`project.config.json` 中 `packNpmManually` 设为 `true`，并通过 `packNpmRelationList` 指定：

- `packageJsonPath`：`./package.json`（项目根目录）
- `miniprogramNpmDistDir`：`./miniprogram/`（构建产物输出目录）

这样 npm 依赖安装在项目根目录的 `node_modules/`，构建后输出到 `miniprogram/miniprogram_npm/`。

## 公开内容接口配置

公开阅读页通过 `miniprogram/config.js` 的 `API_BASE_URL` 访问后端。默认值指向本地后端 `http://127.0.0.1:3000/api/v1`，仅适用于微信开发者工具的本地调试。

真机调试和发布前，必须改为已在微信公众平台配置的 HTTPS 服务域名；不要把会话令牌、微信密钥或 COS 凭据写入小程序配置。

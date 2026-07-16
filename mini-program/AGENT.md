# 项目规则

本项目所有对话、分析、代码修改和文档生成必须遵守以下规则。

## 测试铁律

- TDD 或其它测试相关改动的测试文件必须集中放在 `mini-program/tests` 目录下，严格禁止直接放在业务代码目录或业务文件旁边。

## 技术栈

- 微信小程序原生框架（WXML + WXSS + JS + JSON）
- 状态管理：`mobx-miniprogram` + `mobx-miniprogram-bindings`
- 不使用 React、Vue 等 Web 框架
- 不使用 Tailwind、Redux 等 Web 生态库
- 样式使用 WXSS（rpx 单位），禁止使用 px 硬编码（导航栏等系统级尺寸除外）

## 前端通用规则

开发、修改或审查 mini-program 前，必须阅读并遵守：

- `../.agents/rules/02_engineering_general.md`

> `03_react_hooks.md`、`04_frontend_style.md`、`05_redux_data_flow.md`、`06_redux_state_placement.md` 为 admin-web（React）专用规则，不适用于本项目。

## 小程序专用约束

### 页面与组件

- 页面放在 `pages/` 目录下，自定义组件放在 `components/` 目录下。
- 组件必须在 JSON 中声明 `"component": true`，页面必须在 `app.json` 的 `pages` 中注册。
- 页面与组件的 WXML、WXSS、JS、JSON 四个文件必须同名同目录。
- 组件通过 `properties` 接收外部数据，通过 `triggerEvent` 向外通信；禁止组件直接读写页面 data 或全局变量。

### 数据与状态

#### 页面局部状态

- 仅当前页面使用、不跨页面共享的临时状态（表单输入、UI 开关等），使用 `this.data` + `this.setData()`。
- 禁止直接赋值 `this.data.xxx = ...`，必须通过 `this.setData()` 触发视图更新。
- `setData` 只传必要字段，避免整页 data 全量更新。

#### 全局 / 跨页面状态（MobX）

- 跨页面共享的业务状态（用户信息、登录态、阅读进度、收藏列表、钱包余额等）必须使用 MobX store 管理。
- store 文件集中放在 `stores/` 目录下，按业务领域拆分，例如 `stores/user.js`、`stores/order.js`、`stores/reader.js`。
- 每个 store 使用 `observable`、`action` 定义状态和修改方法；禁止在 store 外直接修改 observable 属性。
- 页面通过 `createStoreBindings(this, { store, fields, actions })` 绑定 store（在 `onLoad` 中创建，`onUnload` 中调用 `destroyStoreBindings` 清理）。
- 组件通过 `storeBindingsBehavior` behavior 绑定 store，在组件 JS 的 `storeBindings` 配置项中声明 `fields` 和 `actions`。
- `fields` 绑定只读取需要的字段，不要把整个 store 绑定到页面/组件。
- `actions` 绑定只绑定当前页面/组件需要的 action，不要全量绑定。

#### 状态归属判断

| 状态类型 | 存放位置 | 示例 |
|---------|---------|------|
| 页面独占的临时 UI 状态 | `this.data` | 弹窗开关、输入框内容、loading |
| 跨页面共享的业务状态 | MobX store | 用户信息、登录态、购物车、阅读进度 |
| 需要持久化但不需要响应式更新 | `wx.setStorageSync` | token、用户偏好设置 |
| 页面间一次性传参 | URL query 或 `EventChannel` | 订单 ID、来源页标识 |

- 禁止使用 `getApp().globalData` 管理业务状态（已由 MobX 替代）；`globalData` 仅保留应用级配置（如 systemInfo）。
- 从后端接口获取的数据，需在 store 或页面服务层做数据映射，不直接透传到 WXML 模板。

### 样式

- 使用 rpx 作为主要尺寸单位，保证多机型适配。
- 颜色、字号、间距等设计 token 集中定义在公共 WXSS 文件中，禁止在业务页面散落硬编码。
- 组件样式隔离使用 `styleIsolation` 配置，默认 `isolated`；需要继承页面样式时显式声明并注释原因。
- WXSS 中 `background-image` 不支持本地路径，只能使用网络图片或 base64。
- 禁止使用 `!important` 覆盖样式，除非第三方组件库强制要求（需注释说明）。

### 图片与静态资源

- `<image>` 组件必须显式指定 `mode` 属性（如 `aspectFill`、`widthFix`），禁止依赖默认拉伸行为。
- 页面内引用的图片优先使用 CDN 地址；仅图标类小体积资源允许放在本地。
- 注意包体积，本地静态资源需压缩后再引入。

### 分包加载

- 主包大小不得超过 2MB，总包大小不得超过 20MB。
- 非首屏、非 tabBar 页面应放入分包（`subpackages`）。
- 分包目录按业务领域命名，例如 `packageOrder/`、`packageUser/`。
- 高频访问的分包可配置 `preloadRule` 预下载，需在 `app.json` 中声明。

### 导航

- 普通页面跳转使用 `wx.navigateTo`；页面栈上限 10 层，深层级流程优先使用 `wx.redirectTo` 替换当前页。
- tabBar 页面必须使用 `wx.switchTab`，禁止对 tabBar 页面使用 `navigateTo` 或 `redirectTo`。
- 需要清空页面栈重新开始时使用 `wx.reLaunch`（如退出登录后跳转登录页）。
- 返回上一页使用 `wx.navigateBack`，禁止用 `navigateTo` 跳转到上一页造成栈堆积。

### 生命周期与事件

- 页面生命周期使用 `onLoad`、`onShow`、`onReady`、`onHide`、`onUnload`。
- 组件生命周期优先使用 `lifetimes` 对象声明（`attached`、`detached` 等），保持项目一致性。
- 事件绑定统一使用冒号语法：`bind:tap`、`catch:tap`、`capture-bind:tap`；禁止混用 `bindtap` 和 `bind:tap`。
- 需要阻止冒泡时使用 `catch:`，并注释原因。
- 异步操作（网络请求、定时器、订阅）必须在 `onUnload` / `detached` 中清理，防止内存泄漏。

### WXS

- WXS 用于模板层的数据格式化、过滤、简单计算，禁止在 WXS 中调用小程序 API 或发起网络请求。
- WXS 文件放在使用它的页面或组件同目录下，或集中放在 `utils/wxs/` 目录下。

### API 调用

- 网络请求统一封装，禁止在页面中直接调用 `wx.request`。
- 小程序 `wx.request` 最大并发数为 10，请求封装层应有提示或排队机制。
- 请求封装必须处理：loading 状态、错误提示（中文）、token 过期自动刷新或跳转登录。
- 微信原生交互 API 按场景使用：
  - 轻提示 → `wx.showToast`
  - 模态确认 → `wx.showModal`
  - 操作菜单 → `wx.showActionSheet`
  - 加载提示 → `wx.showLoading` / `wx.hideLoading`
- 交互提示文案必须使用中文。

### 权限与隐私

- 涉及位置、相册、蓝牙、摄像头等敏感 API 时，必须先通过 `wx.authorize` 或 `wx.getSetting` 检查权限状态，再发起调用。
- 权限被拒绝时，提供引导用户前往设置页开启权限的交互路径。
- 隐私协议相关接口（如 `wx.requirePrivacyAuthorize`）按微信官方要求接入。

## API 规范

开发、修改或排查 mini-program 的接口调用、请求封装、类型定义、数据映射、mock 数据、响应字段、状态枚举或上传业务类型前，必须先使用 API skill，并阅读 API 规范：

- `../.agents/skills/api-contract/mini-program-api.md`

新增、删除或修改接口封装、请求参数、响应字段、枚举值、上传业务类型时，必须同步更新 API 规范。

## 公共组件复用规范

新增弹窗、确认框、Toast、分页、空状态等通用交互前，必须先检索 `components/` 目录下是否已有对应公共组件，优先复用而非重复创建。

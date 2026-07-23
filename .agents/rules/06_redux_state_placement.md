---
trigger: manual
---

# Redux Store 与页面 State 决策规则

> 本文件解决“这份数据该放哪里”的决策问题（Local State / URL Query / RTK Query / Redux Slice）。
> Redux Store 内部的组织方式（Slice 拆分、命名规范、Selector 写法等）请参考 `05_redux_data_flow.md`。

---

## 核心原则

默认优先使用 **Page State**。

只有当状态具备**共享性、持久性、缓存价值、业务重要性或调试价值**时，才提升到 Redux Store。

状态归属优先级（从上到下依次判断，命中即止）：

1. **URL Query**
   - 可分享
   - 可刷新恢复
   - 影响列表查询的筛选 / 分页 / 排序

2. **Page State**
   - 页面独占
   - 临时 UI
   - 表单编辑中状态

3. **RTK Query / asyncThunk**
   - 服务端数据
   - 请求状态
   - 缓存数据

4. **Redux Slice**
   - 客户端全局业务状态

5. **localStorage / sessionStorage**
   - 需要持久化
   - 不需要频繁响应式更新的数据

---

## 必须使用 Redux Store 的情况

满足以下任一条件时，应优先使用 Redux Store：

1. 多页面共享，例如：
   - 登录态
   - 用户信息
   - 角色
   - 权限
   - 系统配置

2. 多组件远距离共享，且 Props 传递会明显复杂。

3. 路由切换后仍需要保留状态。

4. 状态属于核心业务流程，例如：
   - 认证
   - 订单
   - 审批
   - 钱包
   - 邀请
   - 提现

5. 状态需要统一管理 **Pagination / Filter / Selection** 等**纯客户端计算**状态。

6. 服务端数据需要：
   - 缓存
   - 复用
   - 去重请求
   - 统一刷新

7. 状态变化需要通过 Redux DevTools 追踪。

---

## 禁止放入 Redux Store 的情况

以下状态默认不得放入 Store：

1. Modal / Dialog Open 状态
2. Dropdown / Popover 展开状态
3. Hover / Focus / Active 等纯交互状态
4. 单个页面独占的临时输入值
5. 未提交的局部表单草稿
6. 仅影响当前组件展示的 UI 状态
7. 可以通过组件组合或 Props 简单传递的状态

---

## RTK Query 优先原则

### 服务端状态优先使用 RTK Query

服务端数据的：

- Loading
- Error
- Cache
- Request Deduplication（请求去重）

一律优先使用 **RTK Query** 自动管理。

**禁止手写 Slice + Thunk 重复实现 RTK Query 已提供的能力。**

---

### 第 5 条"统一管理"的说明

"必须使用 Redux Store" 第 5 条中的"统一管理"，仅适用于：

- Filter
- Pagination
- Selection
- 排序
- Tab
- 其它纯客户端计算状态

**不包含：**

- Loading
- Error
- 请求缓存
- 请求生命周期

这些属于 RTK Query 的职责。

---

### 如何判断是否属于服务端数据

只要数据来源于接口返回，即使：

- 需要二次加工
- 需要格式转换
- 需要排序
- 需要过滤

都应**优先考虑 RTK Query**，而不是把接口结果放进普通 Slice。

---

## 项目正反例参考

> 以下路径为示例占位，落地时请替换为项目内真实模块路径，并持续维护。

| 状态 | 推荐归属 | 参考实现 |
|------|----------|----------|
| 当前登录用户 / Token | Redux Slice | `src/features/auth` |
| 购物车商品列表 | Redux Slice | `src/features/cart` |
| 列表筛选条件（可分享链接） | URL Query | `src/pages/OrderList` |
| 商品详情弹窗开关 | Page State | 不进入 Store |
| 表单草稿（未提交） | Page State | 不进入 Store |
| 订单列表数据 | RTK Query | `src/services/orderApi` |

---

## 存量代码边界

发现现有代码的状态归属与本规则不符时：

- **不得擅自重构**
- 应在代码审查或对话中指出问题
- 给出建议归属
- 由开发决定是否单独立项处理

仅当本次任务明确包含：

> 状态管理重构

时，才允许调整存量代码的状态归属。

---

## 编码前要求

涉及状态管理的功能，编码前必须先输出 **状态归属设计表**。

| 状态 | 类型 | 存放位置 | 原因 |
|------|------|----------|------|
| xxx | UI / 业务 / 服务端数据 | useState / URL / Redux Slice / RTK Query | xxx |

未完成状态归属判断前，不得直接新增：

- Slice
- Thunk
- RTK Query
- Page State

---

## 决策留痕要求

状态归属设计表必须写入本次改动的设计说明。

建议位置：

- PR Description
- Design Proposal
- Task Plan
- Architecture Note

> **不建议强制要求写入 Commit Message。**

原因：

- AI 编码工具（Codex、Cursor、Claude Code 等）通常不会负责最终 Git Commit。
- Commit Message 由开发者自行整理更符合实际流程。

若功能涉及 **3 个及以上新增状态**，建议在对应模块下创建或更新：

```
STATE_DESIGN.md
```

记录每个状态的：

- 状态名称
- 数据来源
- 生命周期
- 存放位置
- 决策原因

供后续维护者查阅。
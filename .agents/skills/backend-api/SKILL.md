---
name: backend-api
description: Use when 在 backend 中新增、修改、排查路由、控制器、数据库模型、响应格式、数据验证或接口中间件逻辑时必须使用
---

# Backend API 开发规范

## Overview
在 `backend` 中开发或修改 API 接口时，必须遵循标准的三层架构（Route -> Controller -> Model）以及统一的错误处理和数据验证模式。

## When to Use
- 添加新的 API 路由或修改现有路由
- 编写或调整 Controller 逻辑
- 新增或调整 Mongoose Model (Schema)
- 排查后端的 400/500 等接口报错

## 核心开发链路

### 1. Model (数据层)
- 放在 `src/models/xxx.model.js`
- 仅负责数据库字段定义、Schema 级别校验。
- **禁止**在此层使用 Koa `ctx` 对象，保持对 HTTP 的无知。

### 2. Controller (控制层)
- 放在 `src/controllers/xxx.controller.js`
- 负责：提取请求参数 (ctx.request.body / ctx.params) -> 数据校验 -> 调用 Model 查询/更新 -> 返回统一结构。
- **返回结构**：
  ```javascript
  // 成功
  ctx.ok(data, '成功信息'); 
  // 失败
  ctx.fail(400, '错误信息'); 
  ```

### 3. Route (路由层)
- 放在 `src/routes/xxx.route.js`
- 仅负责绑定 HTTP 方法与 Controller，配置鉴权中间件。

## Common Mistakes
- **在 Controller 中硬编码状态码 JSON**：错误。必须使用 `ctx.ok()` 或 `ctx.fail()` 以保证响应格式统一 (`{ code, data, msg }`)。
- **在 Model 保存时不校验输入**：错误。应当在 Controller 拦截明显的格式错误，并在 Model Schema 设置 `required`, `enum`, `match` 进行兜底。
- **无事务的跨表写**：若新建用户同时新建钱包，必须使用 MongoDB `startSession` 开启事务，保证 ACID。

---
name: admin-web-api
description: Use when 在 admin-web 中新增、修改、排查接口调用、请求封装、数据映射、响应字段、状态枚举、上传业务类型、mock 数据或接口联调问题；修改 admin-web/src/api、admin-web/src/utils/request.js，或在页面、组件、hooks 中调整 API 调用时必须使用
---

# admin-web API 工作流

## 事实源

接口清单、请求参数、响应结构、枚举值和上传业务类型以 `.agents/skills/api-contract/admin-web-api.md` 为准。本 skill 只定义工作流，不复制接口表。

## 工作流程

1. 先确认任务是否涉及接口调用、请求封装、数据映射、mock 数据、联调、响应字段或枚举值。
2. 阅读 API 规范后，再对照 `admin-web/src/api`、`admin-web/src/utils/request.js` 和具体调用点。
3. 优先复用 `admin-web/src/api/index.js` 已导出的 API 实例，不在页面、组件或 hooks 中直接使用 `axios`。
4. 新增 API 封装时，放在 `admin-web/src/api` 对应业务域文件中，并从 `admin-web/src/api/index.js` 导出。
5. 业务失败以后端响应 `code` 判断，不只依赖 HTTP 状态。
6. 文件上传使用 `multipart/form-data`，字段名使用 `file`，上传业务类型先查 API 规范。
7. 如果代码和 API 规范冲突，先说明冲突；不要自行猜测接口路径、字段名或枚举值。
8. 新增、删除或修改接口封装、请求参数、响应字段、枚举值、上传业务类型时，同步更新 `.agents/skills/api-contract/admin-web-api.md`。

## 常见错误

| 错误 | 修正 |
| --- | --- |
| 在页面或组件中直接调用 `axios` | 通过 `admin-web/src/api` 封装后调用 |
| 新增 API 文件后未在 `src/api/index.js` 导出 | 补充统一导出 |
| 只判断 HTTP 状态，不判断业务 `code` | 按项目响应约定处理业务状态 |
| 接口未出现在规范中就臆造路径 | 先查后端实现或向用户说明规范缺口 |
| 修改接口字段后忘记更新规范 | 同步更新 API 契约文档 |
| 上传字段名不是 `file` | 改为统一字段名 `file` |

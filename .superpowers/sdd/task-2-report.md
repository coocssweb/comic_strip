# Task 2 实施报告

## 完成状态

已完成数据库连接、统一响应、异常边界和请求校验基础设施实现。

## 变更范围

- `backend/src/config/database.js`
  - 导出 `connectDatabase()`，消费 `env.mongodbUri`、`env.mongodbRetryTimes` 和 `env.mongodbRetryIntervalMs`。
  - 使用 Mongoose 连接 MongoDB；失败时按配置进行有限重试，记录中文诊断日志；最终失败时抛出中文启动异常。
- `backend/src/utils/api-error.js`
  - 导出受控异常类 `ApiError(status, code, message)`。
- `backend/src/middlewares/response.middleware.js`
  - 导出 `responseMiddleware`，向 Koa 上下文注册 `ctx.success(status, message, data)` 与 `ctx.fail(status, code, message)`。
  - 统一响应结构为 `{ code, message, data }`。
- `backend/src/middlewares/error.middleware.js`
  - 导出 `errorMiddleware`。
  - 保留 `ApiError`，将 Mongoose `CastError` 转为 `40002`，将 MongoDB 重复键错误转为 `40901`，其他异常转为 `50000`；所有对外错误信息均为中文。
- `backend/src/middlewares/validate.middleware.js`
  - 导出 `validate(schema)`，校验 `ctx.request.body` 与 `ctx.params`，并将校验后的值回写到上下文。
  - 校验失败抛出 `ApiError(400, 40001, ...)`。

## 检查结果

- `npm run format`：通过。
- `npm run lint`：通过。
- 未创建测试文件或测试依赖，符合任务范围。
- 未修改任务 1 的 `src/config/env.js` 或 ESLint 配置。

## 注意事项

- 当前 PowerShell 版本不支持命令中的 `&&`，因此按要求顺序分别执行了格式化和静态检查，两项均以状态码 0 完成。
- 本任务未启动 Koa 应用、未连接 MongoDB，也未实现 User、路由或应用装配；这些属于后续任务范围。

## 审查修复记录

- 参数校验失败改为固定返回“请求参数不合法”，不再向客户端暴露 Joi 的原始校验信息。
- MongoDB 连接失败日志改为仅记录中文固定文案和尝试次数，不再拼接原始异常信息。
- 请求异常日志改为记录映射后的中文 `ApiError.message` 与请求方法、路径、状态码和业务码，不再记录原始异常信息。

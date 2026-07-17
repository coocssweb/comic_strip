# Task 4 实施报告

## 状态

已完成应用装配、服务启动入口和后端使用说明；未执行 `git add`、`git commit` 或 `git reset`。

## 检查摘要

- `npm run format`：通过。
- `npm run lint`：通过。
- `git diff --check`：通过，未发现空白字符错误。
- 中间件装配顺序为：错误处理、CORS、日志、请求体解析、统一响应能力、路由。
- `server.js` 仅在 `connectDatabase()` 成功后调用 `app.listen()`；启动异常会输出中文日志并设置非零退出状态。

## 真实联调结果与阻塞

未进行 CRUD 真实联调：本机 MongoDB 在 `127.0.0.1:27018` 不可用，不能伪造成功结果。

已使用本地回环地址和短超时验证启动失败重试：设置 `MONGODB_RETRY_TIMES=2` 后，服务实际输出两次“MongoDB 第 N 次连接失败”，随后输出“服务启动失败：MongoDB 连接重试耗尽，服务未启动”，进程以退出码 `1` 结束。

## 审查修复

- `app.listen()` 返回的 HTTP server 已保存。
- 为该 server 注册一次性 `error` 监听器；端口绑定失败时输出“服务启动失败：端口无法监听”，并设置非零退出状态，避免 Node 输出未处理的英文异常栈。
- 数据库或配置加载失败仍由启动入口捕获，并使用受控异常信息输出中文最终失败原因。
- 审查修复后再次执行 `npm run format`、`npm run lint` 和 `git diff --check`，均通过。

## 报告路径

`.superpowers/sdd/task-4-report.md`

# 项目规则
本项目所有对话、分析、代码修改和文档生成必须遵守以下规则。

## 安全铁律
- 严格禁止主动连接正式环境数据库、操作正式环境数据库、查看正式环境数据；即使为了排查问题，也必须拒绝此类主动行为，并改用本地、开发、测试或脱敏数据方案。

## 测试铁律
- TDD 或其它测试相关改动的测试文件必须集中放在 `backend/tests` 目录下，严格禁止直接放在业务代码目录或业务文件旁边。

## 分层架构规范

### 依赖方向
`Route → Controller → Service → Model`，单向依赖，严禁跨层调用、严禁反向调用。

### 目录职责
- `src/app.js`: 应用入口，负责创建 Koa 应用，注册中间件，加载路由，连接数据库等。
- `src/config/`: 配置文件，负责加载配置文件，配置信息不应出现在代码中。
- `src/routes/`：路由声明和中间件绑定。**禁止出现任何业务逻辑代码**，只做路径与中间件的绑定。命名以 `.route.js` 结尾。
- `src/controllers/`：请求参数提取 → 调用 Service → 组装响应。**禁止出现业务判断逻辑**（超过 3 行 `if/else` 视为违规，必须下沉至 Service）。禁止直接操作 Model。命名以 `.controller.js` 结尾。
- `src/services/`：业务逻辑层，承载所有业务规则判断，可调用多个 Model。**禁止访问 `ctx` / `req` / `res`**，保证可以脱离 HTTP 环境单测，也保证同一套业务逻辑可以被多端（如 admin/user 不同前端）复用。命名以 `.service.js` 结尾。
- `src/models/`：MongoDB Schema 与静态方法定义。只允许 Schema 定义、索引、数据库级 hook（`pre`/`post`）。**禁止包含跨表业务判断，禁止在 Model 层直接向客户端输出响应**。命名以 `.model.js` 结尾。
- `src/utils/`：纯函数或与业务无关的通用工具。
- `src/middlewares/`: 中间件，负责处理跨域，日志，鉴权，参数校验等。命名以 `.middleware.js` 结尾。
- `src/validators/`: 参数校验，以 `zod` 实现。

### 可选的 Repository 层
非强制。以下任一情况出现时可增设 `src/repositories/`（命名以 `.repository.js` 结尾）：
- 同一 Model 的查询逻辑在多个 Service 中重复出现；
- Service 内出现大段链式查询（`.find().sort().populate()...`），导致业务意图不清晰。

Repository 只做数据存取封装，不含业务判断，插入在 Service 与 Model 之间：`Service → Repository → Model`。

## 中间件与依赖库选型
以下功能对应的库已锁定，**禁止在 spec 未指定替代方案的情况下自行选型或手搓等效实现**：
- 路由：`koa-router`
- Body 解析：`koa-bodyparser`
- 鉴权：`koa-jwt`
- 安全头：`koa-helmet`
- 跨域：`@koa/cors`
- 压缩：`koa-compress`
- 日志：`pino`（生产环境结构化日志，开发环境可用 `koa-logger`）
- 限流：`koa-ratelimit`
- 参数校验：`zod`（项目内统一使用，不与 `joi` 混用）

若某个功能在上表之外且 spec 未指定对应库，Agent 必须先向人确认选型，禁止直接手写实现或自行引入未经确认的第三方库。

## 错误处理模式
- Service 层的业务异常通过抛出结构化异常对象（如 `AppError`）表达，禁止在 Service 内直接操作 `ctx`。
- Controller 默认不做 try/catch，异常交由全局错误中间件统一捕获并转换为 `ctx.fail(status, message)` 格式的响应；仅当 Controller 需要做异常相关的额外处理（如清理已上传的临时文件）时才允许局部 try/catch。
- 不要在 Model 层直接向客户端输出响应。
- 使用事务（Session）时，如果涉及多个跨表写操作，确保在异常捕获时调用 `session.abortTransaction()`。

## RESTful API 规范

### URL 设计
- 使用名词复数表示资源，路径中禁止出现动词（禁止 `GET /getComics`，应为 `GET /comics`）。
- 层级资源用嵌套路径表达从属关系，如 `/comics/:comicId/comments`；嵌套不超过两层，超过两层的关系改用独立资源 + query 参数表达（如 `/comments?comicId=xxx`）。
- 路由统一加版本前缀 `/api/v1/...`，不允许无版本号的路由。

### HTTP 方法语义
| 方法 | 语义 | 幂等性 |
|---|---|---|
| GET | 查询，无副作用 | 是 |
| POST | 创建资源 | 否 |
| PUT | 全量更新资源 | 是 |
| PATCH | 部分更新资源 | 否（通常） |
| DELETE | 删除资源 | 是 |

### 状态码
- `200` 成功（GET/PUT/PATCH）
- `201` 创建成功（POST）
- `204` 成功但无返回内容（DELETE）
- `400` 参数校验失败
- `401` 未认证
- `403` 无权限
- `404` 资源不存在
- `409` 状态冲突（如重复创建、并发写冲突）
- `500` 服务器内部错误

### 响应体格式
成功与失败必须遵循统一结构，禁止各 Controller 自定义响应字段名：
```json
// 成功
{ "success": true, "data": {} }

// 失败
{ "success": false, "message": "错误信息", "code": "OPTIONAL_ERROR_CODE" }
```

### 列表接口
- 必须支持分页，统一使用 `page` + `pageSize`（项目内保持统一，不与 `limit`/`offset` 混用），响应体中包含 `total` 字段。
- 过滤、排序、搜索统一通过 query string 表达（如 `?status=published&sort=-createdAt`），禁止用 POST body 传递查询条件（复杂查询条件超出 URL 长度限制的场景除外）。
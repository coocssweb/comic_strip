# 后端安全启停运行基线实施计划

> **给 AI 执行者：** 必须使用子技能：使用 subagent-driven-development 逐任务实施此计划。步骤使用复选框（`- [ ]`）语法跟踪进度。仓库规则禁止 AI 执行 `git commit`；完成后由开发者创建 Ticket 独立提交。

**目标：** 在 Node.js `22.21.0` 上交付只在 MongoDB 校验器与索引就绪后监听、可观测且可安全排空的 Koa 服务基线。

**架构：** 入口先校验完整运行配置，再建立 Mongoose 连接并通过可注入的集合定义注册表建立/核验 MongoDB 校验器与索引，最后只在 `127.0.0.1` 监听。Koa 中间件统一生成请求标识、设置安全响应头和输出白名单结构化日志；生命周期对象负责就绪状态、信号处理、HTTP 排空和 MongoDB 关闭。生产默认注册表允许为空，后续 Ticket 增加集合定义；真实集成测试注入专用集合定义验证校验器、索引和漂移拒绝。

**技术栈：** Node.js `22.21.0`、原生 ESM、Koa、Mongoose、Node.js 内置 `node:test`、真实 MongoDB、真实 HTTP。

---

### 任务 1：实现并验收 Ticket #20 后端运行基线

**文件：**
- 创建：`.nvmrc`
- 创建：`backend/package.json`
- 创建：`backend/package-lock.json`
- 创建：`backend/.env.example`
- 创建：`backend/src/config/runtime-config.js`
- 创建：`backend/src/db/collection-registry.js`
- 创建：`backend/src/db/mongo-connection.js`
- 创建：`backend/src/http/create-app.js`
- 创建：`backend/src/http/health.routes.js`
- 创建：`backend/src/http/middleware/request-context.js`
- 创建：`backend/src/http/middleware/security-headers.js`
- 创建：`backend/src/observability/json-logger.js`
- 创建：`backend/src/runtime/service-runtime.js`
- 创建：`backend/src/server.js`
- 创建：`backend/tests/runtime-config.test.js`
- 创建：`backend/tests/collection-registry.integration.test.js`
- 创建：`backend/tests/http-runtime.integration.test.js`
- 创建：`backend/tests/service-lifecycle.integration.test.js`
- 创建：`backend/tests/helpers/test-mongodb.js`
- 创建：`backend/tests/helpers/test-config.js`

- [ ] **步骤 1：先写配置失败测试**

覆盖允许的 `NODE_ENV`、开发默认端口、完整 MongoDB URI、两个解码后不少于 32 字节且互不相同的安全秘密、固定管理端 Origin 和日志级别；验证缺失、弱值、相同秘密和生产 Origin 冲突均在连接 MongoDB 前失败，错误不得包含秘密或 URI。加载器只读取白名单键，但不得因操作系统或进程环境中存在无关变量而失败。

运行：`npm test -- tests/runtime-config.test.js`

预期：首次因 `runtime-config.js` 尚不存在或行为缺失而失败。

- [ ] **步骤 2：实现最小配置加载器并转绿**

导出 `loadRuntimeConfig(env)`，返回冻结后的配置对象；只接受父 Spec 白名单，密钥只保留为解码后的 `Buffer`，异常使用稳定中文摘要。`.env.example` 只放不可用占位值，不放真实连接信息。

运行：`npm test -- tests/runtime-config.test.js`

预期：配置测试全部通过。

- [ ] **步骤 3：先写真实 MongoDB 集合基线失败测试**

测试辅助器从 `TEST_MONGODB_URI` 派生 `comic_strip_test_<UUID>` 随机数据库；只允许删除本次创建且名称严格匹配的数据库，任何不安全名称在执行删除前拒绝。测试注入一个专用集合定义，验证首次创建、重复核验、JSON Schema 漂移拒绝、索引漂移拒绝以及失败时未进入就绪状态。

运行：`npm test -- tests/collection-registry.integration.test.js`

预期：首次因集合注册表尚未实现而失败；不得使用内存 MongoDB 或 Model mock。

- [ ] **步骤 4：实现集合建立与核验并转绿**

集合定义只包含 `name`、权威 `validator` 与权威 `indexes`。启动时创建缺失集合，已存在集合使用 `collMod` 设置当前校验器，再核验服务端实际校验器与索引；未声明的默认生产注册表为空。所有数据库错误向上抛出安全摘要，不记录 MongoDB URI。

运行：`npm test -- tests/collection-registry.integration.test.js`

预期：真实 MongoDB 集成测试全部通过，随机数据库清理成功。

- [ ] **步骤 5：先写真实 HTTP 失败测试**

在 `127.0.0.1` 随机端口启动真实 Koa，验证：

```text
GET /health/live  -> 200 {"status":"ok"}
GET /health/ready -> 200 {"status":"ok"}
依赖失效时       -> 503 {"status":"unavailable"}
```

同时验证每次响应都有服务端 UUID v4 `X-Request-ID`、忽略客户端同名头、安全响应头完整、开发无 HSTS、生产有一年 HSTS 且无 preload、健康端点无 CORS、成功健康检查不写访问日志。构造含 Cookie、JWT、CSRF、密码、原始 IP、登录名和 MongoDB URI 的未知请求，断言日志中不存在原值且只记录模板化路由。

运行：`npm test -- tests/http-runtime.integration.test.js`

预期：首次因 Koa 应用和中间件尚未实现而失败。

- [ ] **步骤 6：实现 Koa 应用、中间件和健康路由并转绿**

中间件顺序固定为请求标识、安全响应头、错误边界、访问日志、路由。`/health/live` 不访问 MongoDB；`/health/ready` 每次执行 MongoDB ping 并核验集合定义，排空状态直接返回 503。日志使用 `JSON.stringify` 单行输出，只允许时间、级别、稳定事件名、requestId、HTTP 方法、路由模板、状态码、耗时和安全错误摘要。

运行：`npm test -- tests/http-runtime.integration.test.js`

预期：真实 HTTP 契约测试全部通过。

- [ ] **步骤 7：先写启动顺序与停机失败测试**

验证端口只在配置、MongoDB 连接、集合校验器和索引全部成功后开放；任一前置步骤失败时端口不可连接。验证 `SIGINT`/`SIGTERM` 触发后立即标记非就绪、停止接收新连接、等待已有请求，十秒内完成时关闭 HTTP 与 Mongoose 并返回成功状态；超时或关闭失败返回非零状态并写脱敏错误日志。

运行：`npm test -- tests/service-lifecycle.integration.test.js`

预期：首次因生命周期实现缺失而失败。

- [ ] **步骤 8：实现服务生命周期和进程入口并转绿**

`createServiceRuntime` 负责 `start()` 与幂等 `shutdown(signal)`；`start()` 严格按配置、MongoDB、集合基线、HTTP 监听顺序执行。进程入口只注册一次 `SIGINT`/`SIGTERM`，正常排空设置退出码 0，超时或关闭失败设置非零退出码；不得调用不可测试的强制退出路径跳过资源关闭。

运行：`npm test -- tests/service-lifecycle.integration.test.js`

预期：生命周期集成测试全部通过。

- [ ] **步骤 9：完成脚本、静态检查和全量验证**

`backend/package.json` 必须包含：

```json
{
  "type": "module",
  "engines": { "node": ">=22.21.0 <23" },
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js",
    "test": "node --test",
    "check": "node --check src/server.js"
  }
}
```

执行：

```text
node --version
npm ci
npm run check
npm test
```

预期：Node 为 `v22.21.0`；依赖安装、静态检查、全部单元和真实集成测试通过；无跳过。测试运行时只通过进程环境注入远程测试 MongoDB URI，仓库、日志和错误输出不得出现连接串或凭据。

- [ ] **步骤 10：自审并交回 Main Agent**

对照 #20 五条验收标准逐条给出代码和测试证据，运行 `git diff --check` 与 `git status --short`，确认未修改 `admin-web`、`mini-program`、父 Spec 之外的契约，也未实现认证、CLI、管理员集合或后续 Ticket 功能。不得执行 `git commit`；由 Main Agent 完成规范审查、代码质量审查和复测后，请开发者创建 #20 独立提交。

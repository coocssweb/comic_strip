# Koa MongoDB 用户 CRUD 示例

这是一个使用 Koa、Mongoose 和 MongoDB 实现的用户 CRUD 后端示例。服务启动时会先连接 MongoDB；连接成功后才会监听 HTTP 端口。

## 环境要求

- Node.js LTS 版本。
- 可访问的本地或开发环境 MongoDB 实例。

## 安装与启动

在 `backend` 目录中执行：

```powershell
npm install
Copy-Item .env.example .env
npm start
```

开发时可使用热重载：

```powershell
npm run dev
```

## 环境变量

通过 `.env` 配置以下变量：

| 变量                        | 说明                                   | 默认值        |
| --------------------------- | -------------------------------------- | ------------- |
| `NODE_ENV`                  | 运行环境                               | `development` |
| `PORT`                      | HTTP 服务端口，必须为正整数            | `3000`        |
| `MONGODB_URI`               | MongoDB 连接字符串，必填               | 无            |
| `MONGODB_RETRY_TIMES`       | MongoDB 最大连接尝试次数，必须为正整数 | `3`           |
| `MONGODB_RETRY_INTERVAL_MS` | MongoDB 重试间隔（毫秒），必须为正整数 | `2000`        |

示例：

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/koa_mongodb_starter
```

## 接口

所有接口响应格式如下：

```json
{
  "code": 0,
  "message": "成功信息",
  "data": {}
}
```

| 方法     | 路径             | 说明         |
| -------- | ---------------- | ------------ |
| `GET`    | `/health`        | 健康检查     |
| `POST`   | `/api/users`     | 创建用户     |
| `GET`    | `/api/users`     | 查询用户列表 |
| `GET`    | `/api/users/:id` | 查询用户详情 |
| `PATCH`  | `/api/users/:id` | 更新用户     |
| `DELETE` | `/api/users/:id` | 删除用户     |

创建用户时，`name` 和 `email` 必填；`age` 可选，且必须为非负整数。更新用户时至少提供 `name`、`email` 或 `age` 中的一项。

## Windows PowerShell 手动 CRUD

先启动服务。以下命令中的 `$userId` 请替换为创建接口响应中 `data._id` 的实际值。

```powershell
curl.exe http://localhost:3000/health

curl.exe -X POST http://localhost:3000/api/users -H "Content-Type: application/json" --data-raw '{\"name\":\"张三\",\"email\":\"zhangsan@example.com\",\"age\":18}'

curl.exe http://localhost:3000/api/users

$userId = "请替换为用户 ID"
curl.exe "http://localhost:3000/api/users/$userId"

curl.exe -X PATCH "http://localhost:3000/api/users/$userId" -H "Content-Type: application/json" --data-raw '{\"age\":19}'

curl.exe -X DELETE "http://localhost:3000/api/users/$userId"
```

若 MongoDB 连接失败，服务会在重试耗尽后以非零状态退出，并输出中文启动失败日志。

# 四格漫画后端

服务使用 Koa、Mongoose 和 MongoDB。除旧的用户 CRUD 示例外，已提供读者微信登录、唯一管理员登录、会话隔离和管理员 COS 上传预签名接口。服务启动时会先连接 MongoDB，连接成功后才会监听 HTTP 端口。

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

| 变量                         | 说明                                     | 默认值        |
| ---------------------------- | ---------------------------------------- | ------------- |
| `NODE_ENV`                   | 运行环境                                 | `development` |
| `PORT`                       | HTTP 服务端口，必须为正整数              | `3000`        |
| `MONGODB_URI`                | MongoDB 连接字符串，必填                 | 无            |
| `MONGODB_RETRY_TIMES`        | MongoDB 最大连接尝试次数，必须为正整数   | `3`           |
| `MONGODB_RETRY_INTERVAL_MS`  | MongoDB 重试间隔（毫秒），必须为正整数   | `2000`        |
| `WECHAT_APP_ID`              | 微信小程序 AppID，仅后端使用             | 无            |
| `WECHAT_APP_SECRET`          | 微信小程序密钥，仅后端使用               | 无            |
| `ADMIN_USERNAME`             | 唯一管理员账号                           | 无            |
| `ADMIN_PASSWORD_HASH`        | 管理员密码的 bcrypt 哈希                 | 无            |
| `SESSION_SECRET`             | 会话令牌签名密钥                         | 无            |
| `SESSION_EXPIRES_SECONDS`    | 会话有效期，单位秒                       | `604800`      |
| `COS_BUCKET`                 | 腾讯云 COS 存储桶                        | 无            |
| `COS_REGION`                 | 腾讯云 COS 地域                          | 无            |
| `COS_PUBLIC_BASE_URL`        | 唯一允许持久化的 COS 公网 HTTPS 地址前缀 | 无            |
| `COS_UPLOAD_EXPIRES_SECONDS` | COS 上传预签名有效期，单位秒             | `300`         |
| `COS_ACCESS_KEY_ID`          | 腾讯云 COS 访问密钥 ID，仅后端使用       | 无            |
| `COS_SECRET_ACCESS_KEY`      | 腾讯云 COS 访问密钥，仅后端使用          | 无            |

示例：

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/koa_mongodb_starter
```

管理员密码可用以下命令生成 bcrypt 哈希，再写入 `ADMIN_PASSWORD_HASH`：

```powershell
node -e "import('bcryptjs').then(({default: bcrypt}) => bcrypt.hash('请替换为实际密码', 12).then(console.log))"
```

## 认证与上传接口

新接口统一以 `/api/v1` 为前缀，响应结构为 `{ code, message, data }`。读者和管理员令牌都通过 `Authorization: Bearer <sessionToken>` 传递，不能互用。

| 方法   | 路径                        | 说明                                                                          |
| ------ | --------------------------- | ----------------------------------------------------------------------------- |
| `POST` | `/api/v1/auth/wechat/login` | 使用微信临时凭证换取读者账户与会话；可选 `profile` 仅在登录时同步昵称和头像。 |
| `POST` | `/api/v1/admin/auth/login`  | 使用环境变量中的唯一管理员账号和 bcrypt 密码哈希登录。                        |
| `POST` | `/api/v1/auth/logout`       | 使当前读者或管理员会话失效。                                                  |
| `POST` | `/api/v1/admin/cos/presign` | 管理员获取 JPEG、PNG、WebP（最大 5 MB）的 COS `PUT` 上传预签名。              |

预签名返回的 `publicUrl` 是内容接口允许持久化的唯一图片地址。浏览器应按返回的 `method` 与 `headers` 直传 COS；不得将 COS 凭据或上传地址中的签名下发到其他客户端。

## 测试

```powershell
npm test
npm run lint
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

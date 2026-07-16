# admin-web API 规范

## 一、通用约定

- 请求工具统一使用 `admin-web/src/utils/request.js` 导出的 `request` 实例。
- API 封装统一放在 `admin-web/src/api`，按业务域拆分文件，并在 `admin-web/src/api/index.js` 统一导出。
- API 文件统一采用类实例导出风格：

```js
import request from '../utils/request';

/**
 * 业务域相关 API
 */
class ExampleAPI {
  basePath = '/admin/example';

  /**
   * 获取列表
   * @param {Object} [params]
   */
  get(params) {
    return request.get(this.basePath, { params });
  }
}

export const exampleAPI = new ExampleAPI();
```

- 登录后请求自动携带 `Authorization: Bearer ${token}`。
- 后端业务响应统一为：

```json
{
  "code": 200,
  "data": null,
  "msg": "操作成功"
}
```

- 业务失败仍可能返回 HTTP 200，以 `code` 判断业务状态。
- `code === 401` 表示登录失效，前端拦截器统一登出并跳转登录页。
- 文件上传使用 `multipart/form-data`，字段名统一为 `file`。

# Admin Web Agent

## 定位

负责 admin-web 端实现。任务涉及 backend + admin-web 时，只能在 Backend Agent 完成并由 Main Agent 确认后开始；仅涉及 min-program + admin-web 时，可在用户确认后开始。

## 可读范围

- `admin-web`
- `backend`
- `docs`
- `AGENTS.md`
- `.agents/rules/`
- `admin-web/AGENT.md`
- `backend/AGENT.md`
- Architecture / Contract Agent 输出的契约和设计文档

## 可写范围

- `admin-web`
- `admin-web/tests`

## 禁止范围

- 禁止修改 `backend`
- 禁止修改 `min-program` 业务代码
- 任务涉及 backend + admin-web 时，禁止在 backend 未完成前开始实现
- 禁止直接向用户请求确认
- 禁止执行 `git commit`

## 必须遵守

- 涉及接口调用、封装、响应字段、枚举或 mock 数据时必须使用 `admin-web-api`
- 开发前阅读 `admin-web/AGENT.md`
- 测试文件必须放在 `admin-web/tests`
- 弹窗必须复用公共 Modal 基座
- Toast、分页等交互优先复用现有公共组件
- 可以读取 backend 代码理解接口、权限和错误语义，但发现后端问题只能报告给 Main Agent

## 完成输出

```text
Admin Web 完成状态：
- 已完成 / 有阻塞

实现内容：
- 页面
- 组件
- API 封装
- 状态管理
- 管理端权限与操作反馈

验证：
- 已运行命令
- 结果

发现的后端问题：
- 无 / 问题清单
```

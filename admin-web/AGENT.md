# 项目规则
本项目所有对话、分析、代码修改和文档生成必须遵守以下规则。

## 测试铁律
- TDD 或其它测试相关改动的测试文件必须集中放在`admin-web/tests` 目录下，严格禁止直接放在业务代码目录或业务文件旁边。

## 前端通用规则

开发、修改或审查 admin-web 前，必须阅读并遵守：

- `../.agents/rules/02_engineering_general.md`
- `../.agents/rules/03_react_hooks.md`
- `../.agents/rules/04_frontend_style.md`
- `../.agents/rules/05_redux_data_flow.md`
- `../.agents/rules/06_redux_state_placement.md`


## API 规范

开发、修改或排查 admin-web 的接口调用、请求封装、类型定义、数据映射、mock 数据、响应字段、状态枚举或上传业务类型前，必须先使用 API skill，并阅读 API 规范：

- `../.agents/skills/admin-web-api/SKILL.md`
- `../.agents/skills/api-contract/admin-web-api.md`

API skill 负责工作流程，API 规范负责接口事实。新增、删除或修改接口封装、请求参数、响应字段、枚举值、上传业务类型时，必须同步更新 API 规范。

## 原型移植与公共组件复用规范

在将本地 HTML 原型或交互预览页面（如 `*.html` 演示文件）移植、转化为 React 业务组件时，必须严格遵守以下规范：

1. **严禁直接搬运 HTML 原型中的弹窗/交互遮罩层样式**：禁止复制如手写 `fixed inset-0` 遮罩等 inline styles 样式。
2. **必须优先检索并复用系统公共组件**：优先使用已有的公共组件，而不是重新创建。

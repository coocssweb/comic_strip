# 项目规则

本项目所有对话、分析、代码修改和文档生成必须遵守以下规则。

## 提交流程铁律

- 修改代码或文档后，严格禁止直接提交；不管当前处于什么分支，都不要执行 `git commit`，提交动作由开发自己完成。

## 规则源文件

详细规则维护在：

- `.agents/rules/00_general.md`
- `.agents/rules/01_chinese_language.md`
- `.agents/rules/02_engineering_general.md`
- 开发backend前，先阅读 `backend/AGENT.md`；
- 开发mini-program前，先阅读 `mini-program/AGENT.md`；
- 开发admin-web前，先阅读 `admin-web/AGENT.md`；

## 规则路由

- 全局任务默认只加载 `.agents/rules/00_general.md`、`.agents/rules/01_chinese_language.md`、`.agents/rules/02_engineering_general.md`。
- 修改 `backend/**` 时，额外阅读 `backend/AGENT.md`；不要加载前端专用规则。
- 修改 `mini-program/**` 时，额外阅读 `mini-program/AGENT.md`；前端专用规则由该文件显式引用。
- 修改 `admin-web/**` 时，额外阅读 `admin-web/AGENT.md`；前端专用规则由该文件显式引用。
- 多端任务按“多端任务编排”执行，由编排流程决定每个子任务需要加载的端内规则。

## 多端任务编排

- 当任务涉及 `backend`、`mini-program`、`admin-web` 中任意两个或以上子项目时，必须先使用 `.agents/skills/fullstack-feature-orchestration/SKILL.md`。
- 如果多端任务先进入 `brainstorming`，则 `.agents/skills/fullstack-feature-orchestration/SKILL.md` 只作为设计和计划约束；设计未确认前不得派发实现子代理。
- 多端任务进入编码前，必须先由 Architecture / Contract Agent 输出方案与契约摘要，再由 Main Agent 统一向用户确认。
- 用户确认前，禁止修改 `backend/src`、`mini-program/src`、`admin-web/src` 或测试代码。
- 用户确认后，Main Agent 必须按端派发独立子代理，并提供完整任务包；禁止由 Main Agent 自己扮演多个端角色包办实现。
- 涉及 `backend + mini-program`、`backend + admin-web` 或三端同时开发时，必须先完成 backend 端开发、验证和契约同步，再进入 `mini-program` / `admin-web` 开发。
- 涉及 `backend + mini-program`、`backend + admin-web` 或三端同时开发时，前后端完成后必须执行真实联调验证；高风险任务不得只依赖单测、构建或静态审查。
- 仅涉及 `mini-program + admin-web` 且不涉及 `backend` 的任务，用户确认后可由两个前端代理并行开发，不需要等待 Backend Agent。

当本文件与规则源文件冲突时，以本文件为准。

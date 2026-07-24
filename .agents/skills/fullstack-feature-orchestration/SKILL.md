---
name: fullstack-feature-orchestration
description: Use when 任务同时影响 backend、mini-program、admin-web 中任意两个或以上子项目，或涉及多端 API、权限、数据流、接口契约、跨端联调和全栈功能开发
---

# 全栈多端任务编排

## 核心原则

多端任务必须先冻结契约，再按端实现。用户确认入口只能是 Main Agent；子代理不得直接向用户确认。

多端任务确认后，Main Agent 不得直接包办各端实现，必须派发独立子代理执行对应端任务。角色名不是“思考视角”，而是实际子任务边界。

最重要的顺序门禁：

```text
Architecture / Contract Agent 完成契约并由 Main Agent 获得用户确认
  ↓
如果任务涉及 backend + 任一前端：Backend Agent 完成 backend 实现、测试和契约更新
  ↓
Mini Program Agent / Admin Web Agent 才能开始前端实现
  ↓
涉及 backend + 前端：Integration Verification Agent 执行真实联调验证
  ↓
Review Agent 跨端审查
  ↓
Main Agent 汇总
```

## 触发条件

当任务影响以下任意两个或以上子项目时，必须使用本技能：

| 影响范围 | 是否触发 |
| --- | --- |
| 仅 backend | 否，使用 backend 相关技能 |
| 仅 mini-program | 否，使用 mini-program 相关技能 |
| 仅 admin-web | 否，使用 admin-web 相关技能 |
| backend + mini-program | 是 |
| backend + admin-web | 是 |
| mini-program + admin-web | 是 |
| backend + mini-program + admin-web | 是 |

涉及多端消费或跨端契约的 API 字段、响应结构、权限、数据库模型、跨角色状态流转、资金、结算、提现、注册、邀请、定时任务时，即使改动看似很小，也按多端任务处理。

## 角色文件

执行前必须按需读取：

- `.agents/roles/architecture-contract-agent.md`
- `.agents/roles/backend-agent.md`
- `.agents/roles/mini-program-agent.md`
- `.agents/roles/admin-web-agent.md`
- `.agents/roles/integration-verification-agent.md`
- `.agents/roles/review-agent.md`

同时遵守：

- `AGENTS.md`
- `.agents/rules/00_general.md`
- `.agents/rules/01_chinese_language.md`
- 被影响子项目的 `AGENT.md`

## 强制流程

1. Main Agent 判断任务是否为多端任务。
2. Architecture / Contract Agent 分析影响范围、风险等级、API 契约、数据模型、权限、执行顺序和验收点。
3. Architecture / Contract Agent 输出确认内容，不直接询问用户。
4. Main Agent 整理确认内容并询问用户。
5. 用户确认前，任何实现代理不得修改 `backend/src`、`mini-program/src`、`admin-web/src` 或测试代码。
6. 用户确认后，Main Agent 必须构造任务包，并派发独立子代理，不得用 Main Agent 自己扮演各端角色来替代。
7. 如果任务涉及 backend + 任一前端，Backend Agent 必须先实现 backend。
8. 涉及 backend + 任一前端时，Backend Agent 完成后必须给出完成证据：改动文件、测试结果、契约更新、未解决风险。
9. 涉及 backend + 任一前端时，Main Agent 确认 backend 已完成后，才允许 Mini Program Agent 和 Admin Web Agent 开始。
10. 仅涉及 mini-program + admin-web 且不涉及 backend 时，用户确认后可由两个前端代理并行实现。
11. 前端代理可以并行，但只能修改各自端代码。
12. 涉及 backend + 任一前端时，前端实现完成后必须由 Integration Verification Agent 执行真实联调验证。
13. 真实联调验证通过后，Review Agent 才能做最终跨端审查；验证失败时，Main Agent 必须按责任端重新分派修复。
14. Review Agent 做跨端审查，发现问题后交回 Main Agent 分派修复。
15. Main Agent 汇总最终结果、验证命令、风险和未完成项。

## 与需求澄清流程的关系

本技能不替代 `brainstorming`、`writing-plans` 或 `subagent-driven-development`，而是作为多端任务的编排约束参与它们。

当任务先进入 `brainstorming` 流程时：

1. `brainstorming` 负责需求澄清、方案比较和设计确认。
2. 设计未获得用户确认前，不得触发实现子代理，不得修改业务代码。
3. 多端任务在设计阶段必须参考本技能的端边界、契约冻结、backend 先行、真实联调和审查门禁。
4. 用户确认设计后，进入 `writing-plans` 生成实施计划。
5. 实施计划必须把本技能的强制流程写成任务顺序和验收门禁。
6. 真正编码时，才由 `subagent-driven-development` 按计划派发独立子代理执行。

优先级规则：

| 场景 | 适用规则 |
| --- | --- |
| 需求尚未澄清 | 先执行 `brainstorming`，不得启动实现子代理 |
| 设计已确认但没有实施计划 | 执行 `writing-plans` |
| 已有实施计划且任务为多端 | 执行 `subagent-driven-development`，并遵守本技能 |
| 本技能与项目 `AGENTS.md` 冲突 | 以 `AGENTS.md` 为准，尤其禁止 `git commit` |

如果 `subagent-driven-development` 要求持续执行，但本技能要求用户确认，则必须先满足用户确认门禁。

## 子代理派发协议

子代理上下文必须按“全新上下文”处理。Main Agent 派发任何子代理前，必须构造完整任务包，不能假设子代理知道当前会话历史。

所有实现子代理的事实源顺序：

1. 用户确认后的 Architecture / Contract Agent 输出。
2. 被影响子项目的 `AGENT.md`。
3. 对应角色文件。
4. 对应端实际代码。
5. Backend Agent 完成报告；仅前端代理和联调代理需要。

任务包必须包含：

```text
用户需求摘要：
- ...

已确认契约：
- API 路径
- 请求参数
- 响应结构
- 错误语义
- 权限角色

数据和文档影响：
- Schema / TECH / ARCHITECTURE / contracts

当前代理职责：
- 负责范围
- 可写范围
- 禁止范围

前置输入：
- Architecture / Contract 输出
- Backend 完成报告（前端和联调代理必需）
- 前端完成报告（联调代理必需）

验证要求：
- 单测 / 构建 / 真实联调 / 审查点

完成输出格式：
- 改动文件
- 验证结果
- 阻塞问题
```

Main Agent 只负责准备上下文、派发子任务、等待结果、处理阻塞、分派修复和最终汇总。

## 用户确认内容格式

Main Agent 向用户确认时必须包含：

```text
影响范围：
- backend / mini-program / admin-web

风险等级：
- 低 / 中 / 高

契约变化：
- API 路径
- 请求参数
- 响应结构
- 错误语义
- 权限角色

数据变化：
- 是否修改 Schema
- 是否影响 TECH.md

前端变化：
- mini-program 改动点
- admin-web 改动点

执行顺序：
- 涉及 backend：Architecture / Contract -> Backend -> Frontend -> Integration Verification -> Review
- 不涉及 backend：Architecture / Contract -> Frontend -> Review

需要你确认的问题：
- ...
```

## 风险分级

| 风险 | 条件 | 确认要求 |
| --- | --- | --- |
| 低 | 不改 Schema，不改权限，仅新增简单展示或调用 | 契约摘要确认 |
| 中 | 新增或调整 API、状态、跨端展示逻辑 | 简版设计说明 + 契约摘要确认 |
| 高 | 认证、注册、邀请、权限、钱包、结算、提现、资金锁、Schema、定时任务、批量操作 | 完整设计文档 + API 契约 + 数据影响说明确认 |

## 端边界

| 代理 | 可读 | 可写 | 禁止 |
| --- | --- | --- | --- |
| Architecture / Contract Agent | 全项目 | `docs/specs/`、`docs/superpowers/specs/`、`docs/TECH.md`、`ARCHITECTURE.md` | 业务代码和测试代码 |
| Backend Agent | `backend`、`docs`、全局规则 | `backend`、`backend/tests`、相关契约和技术文档 | 修改 `mini-program`、`admin-web` 业务代码 |
| Mini Program Agent | `mini-program`、`backend`、`docs`、全局规则 | `mini-program`、`mini-program/tests` | 修改 `backend`、`admin-web` 业务代码 |
| Admin Web Agent | `admin-web`、`backend`、`docs`、全局规则 | `admin-web`、`admin-web/tests` | 修改 `backend`、`mini-program` 业务代码 |
| Integration Verification Agent | 全项目、本地服务、测试数据 | 默认不写；必要时只写指定联调报告 | 修改业务代码、修改测试代码、连接正式环境 |
| Review Agent | 全项目 | 默认不写；必要时只写审查报告 | 直接修业务代码 |

前端代理允许读取 backend 代码用于理解接口、权限和错误语义，但不得修改 backend。发现后端问题时，只能报告给 Main Agent，由 Main Agent 分派给 Backend Agent。

## 真实联调验证

涉及 backend + 任一前端的多端任务，不能只依赖单测、构建和静态审查。前端实现完成后，必须执行真实联调验证。

真实联调验证要求：

- 使用本地、开发、测试或脱敏数据，禁止连接、查看或操作正式环境数据。
- 必须启动实际 backend 服务和受影响前端服务，并通过前端或真实 HTTP 请求打到本地 backend。
- 至少覆盖本次契约新增或修改的核心 API。
- 高风险任务必须覆盖核心业务闭环，例如注册、邀请、权限、钱包、结算、提现、资金锁定。
- 记录实际请求路径、关键请求参数、关键响应结果、页面或接口结果。
- 如果 backend 或受影响前端服务无法启动、依赖缺失或环境不可用，必须作为阻塞问题报告，不得用接口脚本、mock、静态审查或代码阅读替代。

仅涉及 mini-program + admin-web 且不涉及 backend 的任务，不要求 backend 接口联调；应执行前端构建、关键页面交互或本地预览验证。

## 必须调用的配套技能

- 执行已确认的多任务计划：使用 `subagent-driven-development`

## 常见错误

| 错误 | 修正 |
| --- | --- |
| 用户未确认就开始写三端代码 | 先让 Architecture / Contract Agent 输出确认内容，再由 Main Agent 询问用户 |
| Main Agent 自己扮演多个角色包办实现 | 必须派发独立子代理，并为每个子代理提供完整任务包 |
| 涉及 backend + 前端时，backend 和前端同时开始实现 | 必须 backend 完成并验证后，前端才能开始 |
| 前端代理顺手修改 backend | 只能读取 backend，问题交回 Main Agent |
| 子代理直接询问用户 | 子代理把问题交回 Main Agent，由 Main Agent 统一询问 |
| 只改代码不改契约文档 | API、Schema、系统边界变化必须同步文档 |
| 高风险多端任务只做静态审查 | 启动本地服务执行真实联调验证，失败则分派修复 |
| Review Agent 直接修代码 | Review Agent 只提问题，修复由 Main Agent 分派 |

## 完成检查

- [ ] 已识别多端影响范围
- [ ] 已完成 Architecture / Contract Agent 契约输出
- [ ] 已由 Main Agent 获得用户确认
- [ ] 已按角色派发独立子代理，并提供完整任务包
- [ ] 如任务涉及 backend + 前端，backend 已先于前端完成
- [ ] 如任务涉及 backend，backend 测试或验证已执行并记录
- [ ] 前端代理未跨端写代码
- [ ] 如任务涉及 backend + 前端，真实联调验证已执行并记录
- [ ] API 契约、TECH 或 ARCHITECTURE 按需同步
- [ ] Review Agent 已完成跨端审查
- [ ] Main Agent 已汇总最终结果

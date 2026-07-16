---
name: requesting-code-review
description: 在完成任务、实现主要功能或合并代码之前使用，以验证工作是否符合要求
---

# 请求代码审查 (Requesting Code Review)

分派一个代码审查子代理（subagent），在问题蔓延之前捕捉它们。审查者将获得精确构造的上下文来进行评估——绝对不会包含你当前会话的历史记录。这让审查者能专注于工作产出，而不是你的思考过程，同时也为你继续后续工作保留了自身的上下文。

**核心原则：** 尽早审查，频繁审查。

## 何时请求审查

**必须审查的场景：**
- 在子代理驱动开发（subagent-driven development）中完成每个任务后
- 完成主要功能后
- 合并到 main 分支之前

**可选但有价值的场景：**
- 遇到瓶颈卡住时（获取全新视角）
- 重构之前（基线检查）
- 修复复杂 bug 之后

## 如何请求审查

**1. 获取 git SHA：**
```bash
BASE_SHA=$(git rev-parse HEAD~1)  # 或者 origin/main
HEAD_SHA=$(git rev-parse HEAD)
```

**2. 分派代码审查子代理：**

分派一个 `general-purpose`（通用）子代理，填写位于 [code-reviewer.md](code-reviewer.md) 的模板。

**占位符说明：**
- `{DESCRIPTION}` - 你所构建内容的简短总结
- `{PLAN_OR_REQUIREMENTS}` - 它应该实现什么功能
- `{BASE_SHA}` - 起始提交（commit）
- `{HEAD_SHA}` - 结束提交（commit）

**3. 根据反馈采取行动：**
- 立即修复 Critical（严重）问题
- 在继续推进前修复 Important（重要）问题
- 记录 Minor（次要）问题留待以后处理
- 如果审查者是错的，请予以反驳（附上技术理由）

## 示例

```
[刚完成任务 2：添加验证功能]

你：在继续之前，我先请求一次代码审查。

BASE_SHA=$(git log --oneline | grep "Task 1" | head -1 | awk '{print $1}')
HEAD_SHA=$(git rev-parse HEAD)

[分派代码审查子代理]
  DESCRIPTION: 添加了包含 4 种问题类型的 verifyIndex() 和 repairIndex()
  PLAN_OR_REQUIREMENTS: docs/superpowers/plans/deployment-plan.md 中的任务 2
  BASE_SHA: a7981ec
  HEAD_SHA: 3df7661

[子代理回复]:
  Strengths: 清晰的架构，真实的测试
  Issues:
    Important: 缺少进度指示器
    Minor: 报告间隔使用了魔法数字 (100)
  Assessment: 准备就绪，可以继续

你：[修复进度指示器问题]
[继续执行任务 3]
```

## 与工作流集成

**子代理驱动开发（Subagent-Driven Development）：**
- 每个任务后进行审查
- 在问题复合累积前捕捉它们
- 在进入下一个任务前修复问题

**执行计划（Executing Plans）：**
- 在每个任务后或自然的检查点进行审查
- 获取反馈、应用修复、继续推进

**临时开发（Ad-Hoc Development）：**
- 合并前进行审查
- 卡住时进行审查

## 危险信号 (Red Flags)

**绝对不要：**
- 因为“这很简单”就跳过审查
- 忽略 Critical（严重）问题
- 带着未修复的 Important（重要）问题继续开发
- 争论合理的技术反馈

**如果审查者错了：**
- 用技术理由反驳
- 展示能证明代码正常的代码或测试
- 请求澄清

请查看模板：[code-reviewer.md](code-reviewer.md)

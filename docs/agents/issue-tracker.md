# 议题跟踪器：GitHub

本仓库的议题和 PRD 使用 GitHub Issues 管理，所有操作通过 `gh` CLI 完成。

## 操作约定

- 创建议题：`gh issue create --title "..." --body "..."`
- 查看议题：`gh issue view <number> --comments`
- 列出议题：`gh issue list --state open --json number,title,body,labels,comments`
- 评论议题：`gh issue comment <number> --body "..."`
- 添加或移除标签：`gh issue edit <number> --add-label "..."` 或 `--remove-label "..."`
- 关闭议题：`gh issue close <number> --comment "..."`

在仓库克隆目录内执行命令，由 `gh` 根据 `git remote -v` 自动识别仓库。

## 拉取请求是否参与分诊

外部拉取请求不作为需求入口，不进入 `triage` 分诊队列。

GitHub Issues 与拉取请求共享编号。遇到无法确认类型的编号时，先执行 `gh pr view <number>`；失败后再执行 `gh issue view <number>`。

## 技能操作映射

- “发布到议题跟踪器”：创建 GitHub Issue。
- “读取相关工单”：执行 `gh issue view <number> --comments`。

## Wayfinder 操作

`wayfinder` 使用一个地图议题和若干子议题管理大型任务：

- 地图议题：使用 `wayfinder:map` 标签，正文记录当前信息、已有决策和待澄清事项。
- 子议题：优先使用 GitHub 子议题关联；不可用时，通过任务列表及 `Part of #<number>` 建立关联。
- 子议题类型：使用 `wayfinder:research`、`wayfinder:prototype`、`wayfinder:grilling` 或 `wayfinder:task`。
- 阻塞关系：优先使用 GitHub 原生议题依赖；不可用时，在子议题正文顶部记录 `Blocked by: #<number>`。
- 领取任务：执行 `gh issue edit <number> --add-assignee @me`。
- 完成任务：先添加结论评论，再关闭议题，并把结论索引补充到地图议题。

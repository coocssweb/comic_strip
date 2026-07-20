# 小程序公开阅读与发现实施计划

> **给 AI 执行者：** 按任务顺序执行测试先行；项目规则禁止执行 `git commit`。每完成一步更新复选框。

**目标：** 让匿名读者通过真实公开 API 浏览首页、阅读单话、系列、专题和月度热度榜，并可通过微信分享直达单话。

**架构：** 使用 `utils/request.js` 统一处理小程序网络请求与业务响应码；`api/discovery.js` 仅承载公开内容端点。各页面将接口数据归一化为 WXML 所需视图模型，分页游标和加载状态留在页面本地。阅读器以单话详情的四画格作为横向轮播数据，以 `readerFlow` 续读相邻单话。

**技术栈：** 原生微信小程序（WXML、WXSS、JavaScript）、Node 内置测试、既有 MobX 依赖。

---

### 任务 1：公开内容请求与数据映射

**文件：**
- 创建：`mini-program/tests/public-reading.test.js`
- 创建：`mini-program/miniprogram/utils/request.js`
- 创建：`mini-program/miniprogram/api/discovery.js`
- 创建：`mini-program/miniprogram/utils/discovery-view-model.js`

- [x] **步骤 1：编写失败的测试**

覆盖 `toEpisodeCard` 的互动计数兜底、四格排序和公开 API 路径构造。

- [x] **步骤 2：运行测试确认失败**

运行：`node --test tests/public-reading.test.js`

预期：因视图模型和 API 模块尚不存在而失败。

- [x] **步骤 3：实现最小公开请求层与映射**

统一以 `code === "OK"` 识别成功；网络、HTTP 和业务错误向页面返回中文 `Error`。封装单话、系列、专题、月榜读取及分享计数。

- [x] **步骤 4：运行测试确认通过**

运行：`node --test tests/public-reading.test.js`

预期：通过。

### 任务 2：首页推荐流与公开阅读器

**文件：**
- 修改：`mini-program/miniprogram/app.json`
- 修改：`mini-program/miniprogram/pages/index/index.js`
- 修改：`mini-program/miniprogram/pages/index/index.wxml`
- 修改：`mini-program/miniprogram/pages/index/index.wxss`
- 创建：`mini-program/miniprogram/packageReader/reader/reader.js`
- 创建：`mini-program/miniprogram/packageReader/reader/reader.json`
- 创建：`mini-program/miniprogram/packageReader/reader/reader.wxml`
- 创建：`mini-program/miniprogram/packageReader/reader/reader.wxss`

- [x] **步骤 1：编写失败的测试**

为阅读器模型补充“画格按 position 排序”与“不可用内容状态”的测试。

- [x] **步骤 2：运行测试确认失败**

运行：`node --test tests/public-reading.test.js`

预期：新增断言失败。

- [x] **步骤 3：实现首页与阅读器**

首页首次加载和触底续页均请求 `GET /episodes`，点击卡片进入阅读器。阅读器横向展示四画格，读取 `readerFlow` 中的相邻单话，加载失败时只显示“内容暂不可用”；`onShareAppMessage` 调用分享计数接口并带上目标 `episodeId`。

- [x] **步骤 4：运行测试确认通过**

运行：`node --test tests/public-reading.test.js`

预期：通过。

### 任务 3：系列、专题和月榜发现入口

**文件：**
- 创建：`mini-program/miniprogram/packageDiscover/discover/discover.js`
- 创建：`mini-program/miniprogram/packageDiscover/discover/discover.json`
- 创建：`mini-program/miniprogram/packageDiscover/discover/discover.wxml`
- 创建：`mini-program/miniprogram/packageDiscover/discover/discover.wxss`
- 创建：`mini-program/miniprogram/packageDiscover/series/series.js`
- 创建：`mini-program/miniprogram/packageDiscover/series/series.json`
- 创建：`mini-program/miniprogram/packageDiscover/series/series.wxml`
- 创建：`mini-program/miniprogram/packageDiscover/series/series.wxss`
- 创建：`mini-program/miniprogram/packageDiscover/topic/topic.js`
- 创建：`mini-program/miniprogram/packageDiscover/topic/topic.json`
- 创建：`mini-program/miniprogram/packageDiscover/topic/topic.wxml`
- 创建：`mini-program/miniprogram/packageDiscover/topic/topic.wxss`

- [x] **步骤 1：编写失败的测试**

为月榜、专题和系列的空数组与可空字段映射新增断言。

- [x] **步骤 2：运行测试确认失败**

运行：`node --test tests/public-reading.test.js`

预期：新增断言失败。

- [x] **步骤 3：实现发现及详情页**

发现页并行读取系列、专题与月榜；系列页和专题页展示后端已过滤的单话并跳转阅读器。所有图片声明 `mode`，所有视觉样式使用语义类和现有 token。

- [x] **步骤 4：运行测试确认通过**

运行：`node --test tests/public-reading.test.js`

预期：通过。

### 任务 4：验证与任务状态

**文件：**
- 修改：`tickets.md`

- [x] **步骤 1：运行小程序公开读取测试**

运行：`node --test tests/public-reading.test.js`

预期：通过。

- [x] **步骤 2：检查变更质量**

运行：`git diff --check` 与 `git diff -- mini-program tickets.md`。

预期：无空白错误，改动仅限本任务。

- [x] **步骤 3：执行代码审查并处理严重或重要问题**

按 `requesting-code-review` 流程审查工作区差异；修复严重和重要问题后重新运行测试。

- [x] **步骤 4：更新任务状态**

将 `tickets.md` 中“公开阅读与发现”的三项验收标记为已完成；不创建提交。

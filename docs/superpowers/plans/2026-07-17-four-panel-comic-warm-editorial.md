# 四格漫画柔雾编辑部视觉优化实施计划

> **给 AI 执行者：** 在当前会话内使用 `executing-plans` 逐任务实施此计划；每一步完成后更新复选框。项目规则禁止执行 `git commit`。

**目标：** 在不改变现有交互脚本、页面结构和功能的前提下，把四格漫画原型改为「柔雾编辑部」温馨阅读风格，并加入柔和纸张与植物氛围背景。

**架构：** 原型继续由单个 HTML 文件承载。样式只在既有 `<style>` 中替换设计 token 和组件外观；生成图经裁切后只作为页面外层背景，手机模拟器内仍保持纯色可读表面。静态 Node 测试检查新视觉 token、背景资产和原交互脚本哈希，防止样式改造影响功能。

**技术栈：** HTML、CSS、原生 JavaScript、Node.js 内置 `node:test`、`node:assert/strict`。

---

### 任务 1：添加视觉与交互回归测试

**文件：**
- 创建：`prototypes/four-panel-comic/tests/warm-editorial-style.test.mjs`
- 测试：`prototypes/four-panel-comic/tests/warm-editorial-style.test.mjs`

- [ ] **步骤 1：编写失败的测试**

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createHash } from 'node:crypto';

const prototypePath = new URL('../index.html', import.meta.url);
const originalScriptHash = '8ca678422418d848e9dcd97fd13dd7a85242bd8b9b364be2f20a2bd7d587fe0a';

test('柔雾编辑部视觉 token、背景资产与既有交互脚本同时存在', async () => {
  const html = await readFile(prototypePath, 'utf8');
  const script = html.match(/<script>([\\s\\S]*?)<\\/script>/)?.[1];

  assert.match(html, /--sage-600:\s*#4E6658/);
  assert.match(html, /--paper-ivory:\s*#FFFDF7/);
  assert.match(html, /background-image:\s*linear-gradient/);
  assert.match(html, /warm-editorial-background\.png/);
  assert.ok(script, '原型必须保留交互脚本');
  assert.equal(createHash('sha256').update(script).digest('hex'), originalScriptHash);
});
```

- [ ] **步骤 2：运行测试确认失败**

运行：`node --test prototypes/four-panel-comic/tests/warm-editorial-style.test.mjs`

预期：失败，原因是当前 HTML 尚未定义 `--sage-600`、`--paper-ivory` 或背景资产。

### 任务 2：引入外层背景并完成柔雾样式替换

**文件：**
- 创建：`prototypes/four-panel-comic/assets/warm-editorial-background.png`
- 修改：`prototypes/four-panel-comic/index.html`

- [ ] **步骤 1：复制并裁切背景素材**

将已确认视觉板中的 B 方向裁切为不包含界面文字与设备框的柔和纸张、植物背景，保存为 `prototypes/four-panel-comic/assets/warm-editorial-background.png`。保留手机模拟器外层所需的留白；不将人物、漫画格或 A/C 色板带入资产。

- [ ] **步骤 2：替换全局设计 token 和外层背景**

在 `index.html` 的 `:root` 中定义：

```css
--paper-ivory: #FFFDF7;
--paper-soft: #F4F2EA;
--sage-600: #4E6658;
--sage-500: #718A79;
--sage-100: #E7EEE7;
--ink: #303B34;
--ink-muted: #6F786E;
--line-soft: #D8DED5;
--rose-100: #F4E6E6;
--shadow-soft: 0 16px 40px rgba(49, 62, 53, 0.14);
```

并将 `body` 改为叠加柔和浅色遮罩的背景，保证背景纹理不会影响手机容器：

```css
background-color: #E9EDE7;
background-image:
  linear-gradient(rgba(244, 246, 240, 0.72), rgba(244, 246, 240, 0.72)),
  url('./assets/warm-editorial-background.png');
background-position: center;
background-size: cover;
```

- [ ] **步骤 3：将厚重游戏化组件统一为轻薄纸感组件**

把 `.phone-shell`、`.tab-bar`、`.app-header`、`.feed-card`、`.section-card`、`.user-card`、`.menu-group`、`.reader-modal`、`.comment-modal`、`.login-modal` 的白底替换为 `var(--paper-ivory)`；将厚底边框替换为 `1px solid var(--line-soft)`；使用 `var(--shadow-soft)` 或更低的局部阴影。将激活态、统计数字、标签、进度点、链接色统一映射到 `--sage-600`、`--sage-500`、`--rose-100`，不保留高饱和 Duo 色 token。

- [ ] **步骤 4：收束动效与可访问状态**

保留轮播、阅读器和点击反馈的现有时序与逻辑，但把装饰性跳动减少为 2–4px 的轻微位移；加入：

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **步骤 5：运行测试确认通过**

运行：`node --test prototypes/four-panel-comic/tests/warm-editorial-style.test.mjs`

预期：通过 1 项测试，证明新视觉 token、背景引用与未修改的交互脚本同时成立。

### 任务 3：视觉与交互验收

**文件：**
- 修改：`prototypes/four-panel-comic/index.html`
- 测试：`prototypes/four-panel-comic/tests/warm-editorial-style.test.mjs`

- [ ] **步骤 1：在浏览器中检查首页与外层背景**

打开 `prototypes/four-panel-comic/index.html`，确认背景图仅位于手机模拟器外侧，首页文字、标签、漫画格和底部导航均保持清晰；确认绿色不呈高饱和或游戏化效果。

- [ ] **步骤 2：检查既有交互**

在原型中依次操作：底部 Tab 切换、首页轮播左右按钮、卡片收藏、漫画阅读器打开与关闭、阅读器点赞与收藏、评论弹窗、登录弹窗。预期所有操作与改造前一致，且没有 JavaScript 控制台错误。

- [ ] **步骤 3：执行最终静态测试**

运行：`node --test prototypes/four-panel-comic/tests/warm-editorial-style.test.mjs`

预期：通过 1 项测试。

- [ ] **步骤 4：检查变更范围**

运行：`git diff --check -- prototypes/four-panel-comic/index.html prototypes/four-panel-comic/assets/warm-editorial-background.png prototypes/four-panel-comic/tests/warm-editorial-style.test.mjs`

预期：无输出。不要执行 `git add` 或 `git commit`。

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const htmlPath = new URL('../index.html', import.meta.url);
const backgroundAssetPath = new URL('../assets/warm-editorial-background.png', import.meta.url);

const softPaperSurfaceSelectors = [
  '.phone-shell',
  '.tab-bar',
  '.feed-card',
  '.reader-modal',
  '.login-card',
];

const interactionDomIds = [
  'readerOverlay',
  'readerSwipeArea',
  'readerTrack',
  'commentOverlay',
  'loginModal',
  'btnLike',
  'btnFavorite',
];

const inlineEventHooks = [
  "switchTab('home', this)",
  'handleCarouselPrev(event, 0)',
  'handleCardFavorite(event, this, 0)',
  'openReader(0)',
  'closeReader()',
  'handleReaderLike(event)',
  'handleReaderFav(event)',
  'handleReaderComment(event)',
  'showLogin()',
  'doLogin()',
];

function getCssRule(html, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ruleMatch = html.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`, 'i'));

  assert.ok(ruleMatch, `必须定义 ${selector} 样式规则`);
  return ruleMatch[1].replace(/\/\*[\s\S]*?\*\//g, '');
}

function assertSoftPaperSurface(cssRule, selector) {
  assert.ok(
    cssRule.includes('var(--paper-ivory)'),
    `${selector} 必须使用纸面背景 Token`,
  );
  assert.ok(
    /\bborder(?:-(?:top|right|bottom|left))?\s*:\s*1px\s+solid\s+var\(--[a-z0-9-]+\)/i.test(cssRule),
    `${selector} 必须使用 1px Token 化边框`,
  );
  assert.ok(
    /\bbox-shadow\s*:\s*var\(--[a-z0-9-]+\)/i.test(cssRule),
    `${selector} 必须使用低阴影 Token`,
  );
}

test('柔雾编辑部视觉样式与交互脚本保持预期', async () => {
  const html = await readFile(htmlPath, 'utf8');
  const bodyRule = getCssRule(html, 'body');
  const backgroundImageMatch = bodyRule.match(/background-image:\s*([^;]+);/i);

  assert.ok(backgroundImageMatch, 'body 必须定义 background-image');
  assert.ok(
    backgroundImageMatch[1].includes('linear-gradient'),
    'body 的 background-image 必须包含 linear-gradient',
  );
  assert.ok(
    backgroundImageMatch[1].includes("url('./assets/warm-editorial-background.png')"),
    'body 的 background-image 必须包含暖调编辑部背景图',
  );

  const backgroundAssetStats = await stat(backgroundAssetPath);
  assert.ok(backgroundAssetStats.isFile(), '暖调编辑部背景必须是常规文件');
  assert.ok(backgroundAssetStats.size > 0, '暖调编辑部背景文件不能为空');

  assert.ok(html.includes('--sage-600: #4E6658'), 'HTML 必须定义 sage-600 色彩 Token');
  assert.ok(html.includes('--paper-ivory: #FFFDF7'), 'HTML 必须定义 paper-ivory 色彩 Token');

  for (const selector of softPaperSurfaceSelectors) {
    assertSoftPaperSurface(getCssRule(html, selector), selector);
  }

  const loginModalRule = getCssRule(html, '.login-modal');
  const hasOpaqueLoginModalBackground = /\bbackground(?:-color)?\s*:\s*(?!transparent\b)/i.test(loginModalRule);
  assert.ok(!hasOpaqueLoginModalBackground, '.login-modal 背景必须透明或未定义');
  assert.ok(!/\bborder(?:-[a-z-]+)?\s*:/i.test(loginModalRule), '.login-modal 不得有卡片边框');
  assert.ok(!/\bbox-shadow\s*:/i.test(loginModalRule), '.login-modal 不得有卡片阴影');

  for (const id of interactionDomIds) {
    assert.ok(
      new RegExp(`\\bid=["']${id}["']`).test(html),
      `HTML 必须包含 #${id}`,
    );
  }

  for (const eventHook of inlineEventHooks) {
    assert.ok(html.includes(eventHook), `HTML 必须包含事件挂点 ${eventHook}`);
  }

  const scriptMatches = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.equal(scriptMatches.length, 1, 'HTML 必须且只能包含一个内联交互脚本');

  const scriptHash = createHash('sha256')
    .update(scriptMatches[0][1])
    .digest('hex');

  assert.equal(
    scriptHash,
    '8ca678422418d848e9dcd97fd13dd7a85242bd8b9b364be2f20a2bd7d587fe0a',
  );
});

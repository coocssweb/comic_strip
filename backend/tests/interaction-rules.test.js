import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeCommentContent } from '../src/interactions/comment-rules.js';

test('评论允许 1 至 200 个字符的纯文本、表情和换行', () => {
  assert.equal(normalizeCommentContent('  第一行\n😀 第二行  '), '第一行\n😀 第二行');
  assert.equal(normalizeCommentContent('a'.repeat(200)), 'a'.repeat(200));
});

test('评论拒绝空白、超长、链接和 @ 语义', () => {
  assert.equal(normalizeCommentContent(' \n '), null);
  assert.equal(normalizeCommentContent('a'.repeat(201)), null);
  assert.equal(normalizeCommentContent('请看 https://example.com'), null);
  assert.equal(normalizeCommentContent('回复 @小明'), null);
});

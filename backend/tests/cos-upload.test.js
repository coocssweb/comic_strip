import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildCosObjectKey,
  isAllowedCosPublicUrl,
  validateCosUploadRequest,
} from '../src/cos/cos-upload.js';

test('仅允许 JPEG、PNG、WebP 且文件大小不超过 5 MB', () => {
  assert.deepEqual(
    validateCosUploadRequest({
      fileName: 'panel.webp',
      contentType: 'image/webp',
      contentLength: 5 * 1024 * 1024,
    }),
    { fileName: 'panel.webp', contentType: 'image/webp', contentLength: 5 * 1024 * 1024 },
  );

  assert.equal(
    validateCosUploadRequest({
      fileName: 'panel.gif',
      contentType: 'image/gif',
      contentLength: 1024,
    }),
    null,
  );
  assert.equal(
    validateCosUploadRequest({
      fileName: 'panel.png',
      contentType: 'image/png',
      contentLength: 5 * 1024 * 1024 + 1,
    }),
    null,
  );
});

test('COS 对象键不接受目录穿越且公开地址必须位于已配置 HTTPS 前缀内', () => {
  assert.match(
    buildCosObjectKey({ fileName: 'cover image.png', now: new Date('2026-07-20T00:00:00.000Z') }),
    /^comic-images\/2026\/07\/20\/[0-9a-f-]+-cover-image\.png$/,
  );
  assert.equal(
    buildCosObjectKey({ fileName: '../cover.png', now: new Date('2026-07-20T00:00:00.000Z') }),
    null,
  );

  const publicBaseUrl = 'https://comic-123.cos.ap-shanghai.myqcloud.com/';
  assert.equal(
    isAllowedCosPublicUrl(
      'https://comic-123.cos.ap-shanghai.myqcloud.com/panels/1.webp',
      publicBaseUrl,
    ),
    true,
  );
  assert.equal(
    isAllowedCosPublicUrl('https://evil.example.com/panels/1.webp', publicBaseUrl),
    false,
  );
  assert.equal(
    isAllowedCosPublicUrl(
      'http://comic-123.cos.ap-shanghai.myqcloud.com/panels/1.webp',
      publicBaseUrl,
    ),
    false,
  );
});

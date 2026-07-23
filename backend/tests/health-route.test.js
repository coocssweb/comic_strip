import assert from 'node:assert/strict';
import test from 'node:test';

import Koa from 'koa';

import { createHealthRoutes } from '../src/http/health.route.js';

test('真实 Koa 服务在 draining 时就绪检查返回 503 且不核验依赖', async () => {
  let verificationCount = 0;
  const app = new Koa();
  app.use(createHealthRoutes({
    readiness: {
      isDraining: () => true,
      verify: async () => { verificationCount += 1; },
    },
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/health/ready`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: 'unavailable' });
    assert.equal(verificationCount, 0);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

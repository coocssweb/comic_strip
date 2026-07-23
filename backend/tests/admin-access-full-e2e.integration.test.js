import test, { describe } from 'node.test';
import assert from 'node.assert/strict';
import http from 'node.http';
import { createServerApp } from '../src/http/create-app.js';
import { createIsolatedTestDatabaseTarget, deriveTestMongoDbUri } from './helpers/test-mongodb.js';
import { runAdminInit } from '../src/cli/admin-init.js';
import { runAdminRecover } from '../src/cli/admin-recover.js';

describe('管理员访问与运行基线完整跨端 E2E 联调闭环测试', () => {
  let dbTarget;

  test('端到端全流程（CLI初始化、多会话隔离、密码修改撤销、CLI恢复、单点退出、门禁安全）', async () => {
    const mongoUri = deriveTestMongoDbUri();
    if (!mongoUri) {
      console.log('Skipping E2E test due to missing TEST_MONGODB_URI');
      return;
    }

    dbTarget = await createIsolatedTestDatabaseTarget();
    const config = {
      NODE_ENV: 'test',
      PORT: 0,
      MONGODB_URI: dbTarget.uri,
      ADMIN_JWT_SECRET: 'e2e_jwt_secret_32_bytes_long_string_xyz!',
      ADMIN_CSRF_SECRET: 'e2e_csrf_secret_32_bytes_long_string_abc!',
      ADMIN_WEB_ORIGIN: 'http://localhost:4000',
    };

    // 1. CLI 初始化唯一管理员
    const initResult = await runAdminInit({
      getDb: dbTarget.getDb,
      username: 'e2e_admin',
      password: 'Initial_Pass_12345!',
      isInteractive: false,
    });
    assert.equal(initResult.success, true);
    assert.equal(initResult.action, 'initialized');

    // 重载 CLI 初始化必须拒绝
    const reInitResult = await runAdminInit({
      getDb: dbTarget.getDb,
      username: 'e2e_admin',
      password: 'Initial_Pass_12345!',
      isInteractive: false,
    });
    assert.equal(reInitResult.success, false);
    assert.equal(reInitResult.reason, 'PRIMARY_ADMIN_ALREADY_EXISTS');

    // 2. 启动真实 HTTP 服务器
    const app = createServerApp({
      config,
      getDb: dbTarget.getDb,
      logger: { info: () => {}, warn: () => {}, error: () => {} },
    });
    const server = http.createServer(app.callback());
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    // HTTP Helper
    const makeRequest = (path, options = {}, cookie = '', csrfToken = '') => {
      return new Promise((resolve, reject) => {
        const url = new URL(path, baseUrl);
        const reqOptions = {
          method: options.method || 'GET',
          headers: {
            Origin: 'http://localhost:4000',
            'Content-Type': 'application/json',
            ...(cookie ? { Cookie: cookie } : {}),
            ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
            ...(options.headers || {}),
          },
        };

        const req = http.request(url, reqOptions, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            let body = null;
            try { body = JSON.parse(data); } catch { body = data; }
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body,
            });
          });
        });
        req.on('error', reject);
        if (options.body) {
          req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
        }
        req.end();
      });
    };

    const extractCookie = (res) => {
      const setCookie = res.headers['set-cookie'];
      if (!setCookie) return '';
      const match = setCookie[0].match(/admin_session=[^;]+/);
      return match ? match[0] : '';
    };

    try {
      // 3. 浏览器会话 1：登录
      const loginRes1 = await makeRequest('/admin/auth/login', {
        method: 'POST',
        body: { username: 'e2e_admin', password: 'Initial_Pass_12345!' },
      });
      assert.equal(loginRes1.status, 200);
      assert.equal(loginRes1.body.admin.username, 'e2e_admin');
      const cookie1 = extractCookie(loginRes1);
      const csrf1 = loginRes1.body.csrfToken;
      assert.ok(cookie1.includes('admin_session='));
      assert.ok(csrf1);

      // 会话 1 恢复验证
      const sessionRes1 = await makeRequest('/admin/auth/session', {}, cookie1);
      assert.equal(sessionRes1.status, 200);
      assert.equal(sessionRes1.body.admin.username, 'e2e_admin');

      // 4. 浏览器会话 2：并发登录（多会话隔离）
      const loginRes2 = await makeRequest('/admin/auth/login', {
        method: 'POST',
        body: { username: 'e2e_admin', password: 'Initial_Pass_12345!' },
      });
      assert.equal(loginRes2.status, 200);
      const cookie2 = extractCookie(loginRes2);
      const csrf2 = loginRes2.body.csrfToken;
      assert.ok(cookie2);
      assert.notEqual(cookie1, cookie2);

      // 5. 会话 1 修改密码
      const passwordChangeRes = await makeRequest('/admin/auth/password', {
        method: 'PATCH',
        body: {
          currentPassword: 'Initial_Pass_12345!',
          newPassword: 'Updated_Pass_99999!',
        },
      }, cookie1, csrf1);
      assert.equal(passwordChangeRes.status, 200);

      // 6. 验证修改密码后即时撤销全局所有会话
      const postRevoke1 = await makeRequest('/admin/auth/session', {}, cookie1);
      assert.equal(postRevoke1.status, 401);
      assert.equal(postRevoke1.body.code, 'ADMIN_AUTH_REQUIRED');

      const postRevoke2 = await makeRequest('/admin/auth/session', {}, cookie2);
      assert.equal(postRevoke2.status, 401);
      assert.equal(postRevoke2.body.code, 'ADMIN_AUTH_REQUIRED');

      // 7. 旧密码登录失败，新密码登录成功
      const oldLoginRes = await makeRequest('/admin/auth/login', {
        method: 'POST',
        body: { username: 'e2e_admin', password: 'Initial_Pass_12345!' },
      });
      assert.equal(oldLoginRes.status, 401);
      assert.equal(oldLoginRes.body.code, 'ADMIN_CREDENTIALS_INVALID');

      const newLoginRes = await makeRequest('/admin/auth/login', {
        method: 'POST',
        body: { username: 'e2e_admin', password: 'Updated_Pass_99999!' },
      });
      assert.equal(newLoginRes.status, 200);
      let cookie3 = extractCookie(newLoginRes);
      let csrf3 = newLoginRes.body.csrfToken;

      // 8. 通过 CLI 恢复管理员访问
      const recoverResult = await runAdminRecover({
        getDb: dbTarget.getDb,
        username: 'recovered_admin',
        password: 'Recovered_Pass_88888!',
        isInteractive: false,
      });
      assert.equal(recoverResult.success, true);
      assert.equal(recoverResult.action, 'recovered');

      // 验证 CLI 恢复后旧会话全部失效
      const postRecoverSession = await makeRequest('/admin/auth/session', {}, cookie3);
      assert.equal(postRecoverSession.status, 401);

      // 9. 使用恢复后的凭据登录并执行单点退出
      const recoveredLoginRes = await makeRequest('/admin/auth/login', {
        method: 'POST',
        body: { username: 'recovered_admin', password: 'Recovered_Pass_88888!' },
      });
      assert.equal(recoveredLoginRes.status, 200);
      const cookie4 = extractCookie(recoveredLoginRes);
      const csrf4 = recoveredLoginRes.body.csrfToken;

      const logoutRes = await makeRequest('/admin/auth/logout', { method: 'POST' }, cookie4, csrf4);
      assert.equal(logoutRes.status, 204);
      assert.ok(logoutRes.headers['set-cookie'][0].includes('Max-Age=0'));

      const postLogoutSession = await makeRequest('/admin/auth/session', {}, cookie4);
      assert.equal(postLogoutSession.status, 401);

      // 10. 默认拒绝与安全门禁验证
      // 10a. 未认证访问任意未映射管理路径 -> 401
      const unauthUnknownRes = await makeRequest('/admin/unknown-route');
      assert.equal(unauthUnknownRes.status, 401);
      assert.equal(unauthUnknownRes.body.code, 'ADMIN_AUTH_REQUIRED');

      // 重新登录获取有效 Session 验证门禁
      const gateLogin = await makeRequest('/admin/auth/login', {
        method: 'POST',
        body: { username: 'recovered_admin', password: 'Recovered_Pass_88888!' },
      });
      const gateCookie = extractCookie(gateLogin);
      const gateCsrf = gateLogin.body.csrfToken;

      // 10b. 已认证访问未知路径 -> 404
      const authUnknownRes = await makeRequest('/admin/unknown-route', {}, gateCookie);
      assert.equal(authUnknownRes.status, 404);
      assert.equal(authUnknownRes.body.code, 'NOT_FOUND');

      // 10c. 已认证写请求错误 CSRF -> 403
      const badCsrfRes = await makeRequest('/admin/auth/logout', { method: 'POST' }, gateCookie, 'wrong-csrf-token');
      assert.equal(badCsrfRes.status, 403);
      assert.equal(badCsrfRes.body.code, 'CSRF_VALIDATION_FAILED');

      // 10d. 非法 Origin 请求 -> 403
      const badOriginRes = await makeRequest('/admin/auth/session', {
        headers: { Origin: 'http://malicious-domain.com' },
      }, gateCookie);
      assert.equal(badOriginRes.status, 403);
      assert.equal(badOriginRes.body.code, 'CORS_ORIGIN_FORBIDDEN');

    } finally {
      await new Promise((resolve) => server.close(resolve));
      if (dbTarget) {
        await dbTarget.cleanup();
      }
    }
  });
});

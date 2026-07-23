import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { authAPI } from '../src/api/auth';
import { clearCsrfToken, getCsrfToken, setCsrfToken } from '../src/utils/request';
import App from '../src/App';
import { createStore } from '../src/store';

jest.mock('../src/api/auth');

describe('管理会话到期提醒与显式继续使用测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearCsrfToken();
    localStorage.clear();
    sessionStorage.clear();
    window.history.pushState({}, '', '/');
  });

  test('距离较早期限 5 分钟（300 秒）以内时触发到期提醒弹窗', async () => {
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const idleExpiresAt = new Date(now + 200 * 1000).toISOString(); // 200秒后到期
    const absoluteExpiresAt = new Date(now + 3600 * 1000).toISOString(); // 1小时后到期

    authAPI.getSession.mockResolvedValue({
      admin: { id: 'primary-admin', username: 'primary_admin' },
      session: { idleExpiresAt, absoluteExpiresAt },
      serverTime: nowIso,
    });

    render(<App store={createStore()} />);

    await waitFor(() => {
      expect(screen.getByText('管理会话即将到期')).toBeInTheDocument();
      expect(screen.getByText('3分20秒')).toBeInTheDocument();
    });
  });

  test('点击“继续使用”调用真实 restoreSession 成功更新期限', async () => {
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const initialIdle = new Date(now + 200 * 1000).toISOString();
    const absoluteExpiresAt = new Date(now + 3600 * 1000).toISOString();

    authAPI.getSession.mockResolvedValueOnce({
      admin: { id: 'primary-admin', username: 'primary_admin' },
      session: { idleExpiresAt: initialIdle, absoluteExpiresAt },
      serverTime: nowIso,
    });

    render(<App store={createStore()} />);

    await waitFor(() => {
      expect(screen.getByText('管理会话即将到期')).toBeInTheDocument();
    });

    // 模拟刷新后延长 30 分钟
    const extendedIdle = new Date(now + 1800 * 1000).toISOString();
    authAPI.getSession.mockResolvedValueOnce({
      admin: { id: 'primary-admin', username: 'primary_admin' },
      session: { idleExpiresAt: extendedIdle, absoluteExpiresAt },
      serverTime: new Date(now + 1000).toISOString(),
    });

    fireEvent.click(screen.getByRole('button', { name: '继续使用' }));

    await waitFor(() => {
      expect(authAPI.getSession).toHaveBeenCalledTimes(2);
      expect(screen.queryByText('管理会话即将到期')).not.toBeInTheDocument();
    });
  });

  test('恢复会话遭遇网络错误时保留弹窗并展现错误，不强行清空状态', async () => {
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const initialIdle = new Date(now + 200 * 1000).toISOString();
    const absoluteExpiresAt = new Date(now + 3600 * 1000).toISOString();

    authAPI.getSession.mockResolvedValueOnce({
      admin: { id: 'primary-admin', username: 'primary_admin' },
      session: { idleExpiresAt: initialIdle, absoluteExpiresAt },
      serverTime: nowIso,
    });

    render(<App store={createStore()} />);

    await waitFor(() => {
      expect(screen.getByText('管理会话即将到期')).toBeInTheDocument();
    });

    authAPI.getSession.mockRejectedValueOnce({
      code: 'NETWORK_ERROR',
      message: '网络连接超时',
    });

    fireEvent.click(screen.getByRole('button', { name: '继续使用' }));

    await waitFor(() => {
      expect(screen.getByText('管理会话即将到期')).toBeInTheDocument();
      expect(screen.getByText('网络连接超时')).toBeInTheDocument();
    });
  });

  test('会话已到期或 401 确认失效时自动清除认证与 CSRF 并跳转登录页', async () => {
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const initialIdle = new Date(now + 200 * 1000).toISOString();
    const absoluteExpiresAt = new Date(now + 3600 * 1000).toISOString();
    setCsrfToken('active-csrf-token');

    authAPI.getSession.mockResolvedValueOnce({
      admin: { id: 'primary-admin', username: 'primary_admin' },
      session: { idleExpiresAt: initialIdle, absoluteExpiresAt },
      serverTime: nowIso,
    });

    render(<App store={createStore()} />);

    await waitFor(() => {
      expect(screen.getByText('管理会话即将到期')).toBeInTheDocument();
    });

    authAPI.getSession.mockRejectedValueOnce({
      code: 'ADMIN_AUTH_REQUIRED',
      message: '管理会话已失效',
      status: 401,
    });

    fireEvent.click(screen.getByRole('button', { name: '继续使用' }));

    await waitFor(() => {
      expect(getCsrfToken()).toBeNull();
      expect(screen.getByText('管理会话已到期，请重新登录')).toBeInTheDocument();
    });
  });
});

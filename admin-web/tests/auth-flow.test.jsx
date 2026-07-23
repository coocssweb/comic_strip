import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { authAPI } from '../src/api/auth';
import { clearCsrfToken, getCsrfToken, setCsrfToken } from '../src/utils/request';
import App from '../src/App';
import { createStore } from '../src/store';

jest.mock('../src/api/auth');

describe('管理端登录、会话恢复与受保护空壳测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearCsrfToken();
    localStorage.clear();
    sessionStorage.clear();
    window.history.pushState({}, '', '/');
  });

  test('CSRF 令牌只存在于私有内存，不写入 localStorage 或 sessionStorage', () => {
    setCsrfToken('test-csrf-token-123');
    expect(getCsrfToken()).toBe('test-csrf-token-123');
    expect(localStorage.getItem('csrfToken')).toBeNull();
    expect(sessionStorage.getItem('csrfToken')).toBeNull();
  });

  test('未认证且 Session 恢复 401 时自动重定向到登录页', async () => {
    authAPI.getSession.mockRejectedValue({
      code: 'ADMIN_AUTH_REQUIRED',
      message: '管理会话已失效',
      status: 401,
    });

    render(<App store={createStore()} />);

    await waitFor(() => {
      expect(screen.getByText('天天种草平台管理端')).toBeInTheDocument();
      expect(screen.getByLabelText('管理员登录名')).toBeInTheDocument();
    });
  });

  test('有效会话登录成功进入受保护空壳', async () => {
    authAPI.getSession.mockRejectedValue({
      code: 'ADMIN_AUTH_REQUIRED',
      message: '管理会话已失效',
      status: 401,
    });

    authAPI.login.mockResolvedValue({
      admin: { id: 'primary-admin', username: 'primary_admin' },
      session: {
        idleExpiresAt: '2026-07-23T12:00:00.000Z',
        absoluteExpiresAt: '2026-07-23T22:00:00.000Z',
      },
      serverTime: '2026-07-23T10:00:00.000Z',
      csrfToken: 'mock-csrf-token-xyz',
    });

    render(<App store={createStore()} />);

    await waitFor(() => {
      expect(screen.getByLabelText('管理员登录名')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('管理员登录名'), { target: { value: 'primary_admin' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'ValidPass_12345!' } });
    fireEvent.click(screen.getByRole('button', { name: '安全登录' }));

    await waitFor(() => {
      expect(screen.getByText('管理员访问基线运行正常')).toBeInTheDocument();
      expect(screen.getByText('primary_admin')).toBeInTheDocument();
    });
  });
});

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { authAPI } from '../src/api/auth';
import { clearCsrfToken, getCsrfToken, setCsrfToken } from '../src/utils/request';
import App from '../src/App';
import { createStore } from '../src/store';

jest.mock('../src/api/auth');

describe('管理端退出登录与修改密码闭环测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearCsrfToken();
    localStorage.clear();
    sessionStorage.clear();
    window.history.pushState({}, '', '/');
  });

  test('退出登录成功后清除 CSRF 令牌并重定向到登录页', async () => {
    authAPI.getSession.mockResolvedValue({
      admin: { id: 'primary-admin', username: 'primary_admin' },
      session: { idleExpiresAt: '2026-07-23T12:00:00.000Z' },
      serverTime: '2026-07-23T10:00:00.000Z',
    });
    setCsrfToken('active-csrf-token');

    authAPI.logout.mockResolvedValue({});

    render(<App store={createStore()} />);

    await waitFor(() => {
      expect(screen.getByText('退出登录')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('退出登录'));

    await waitFor(() => {
      expect(authAPI.logout).toHaveBeenCalledTimes(1);
      expect(getCsrfToken()).toBeNull();
      expect(screen.getByLabelText('管理员登录名')).toBeInTheDocument();
    });
  });

  test('修改密码弹窗进行客户端前端校验', async () => {
    authAPI.getSession.mockResolvedValue({
      admin: { id: 'primary-admin', username: 'primary_admin' },
      session: { idleExpiresAt: '2026-07-23T12:00:00.000Z' },
      serverTime: '2026-07-23T10:00:00.000Z',
    });

    render(<App store={createStore()} />);

    await waitFor(() => {
      expect(screen.getByText('修改密码')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('修改密码'));

    await waitFor(() => {
      expect(screen.getByText('修改管理员密码')).toBeInTheDocument();
    });

    // 1. 未输入密码
    fireEvent.click(screen.getByRole('button', { name: '确认修改' }));
    await waitFor(() => {
      expect(screen.getByText('请输入当前密码')).toBeInTheDocument();
    });

    // 2. 密码太短
    fireEvent.change(screen.getByLabelText('当前密码'), { target: { value: 'old_pass' } });
    fireEvent.change(screen.getByLabelText('新密码'), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText('确认新密码'), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: '确认修改' }));
    await waitFor(() => {
      expect(screen.getByText('新密码长度必须在 15 至 128 个字符之间')).toBeInTheDocument();
    });

    // 3. 两次输入不一致
    fireEvent.change(screen.getByLabelText('新密码'), { target: { value: 'Valid_New_Password_123!' } });
    fireEvent.change(screen.getByLabelText('确认新密码'), { target: { value: 'Mismatch_New_Password_123!' } });
    fireEvent.click(screen.getByRole('button', { name: '确认修改' }));
    await waitFor(() => {
      expect(screen.getByText('两次输入的新密码不一致')).toBeInTheDocument();
    });
  });

  test('当前密码错误时保留已输入的新密码，提示错误信息', async () => {
    authAPI.getSession.mockResolvedValue({
      admin: { id: 'primary-admin', username: 'primary_admin' },
      session: { idleExpiresAt: '2026-07-23T12:00:00.000Z' },
      serverTime: '2026-07-23T10:00:00.000Z',
    });

    authAPI.updatePassword.mockRejectedValue({
      code: 'ADMIN_CREDENTIALS_INVALID',
      message: '当前密码错误',
      status: 401,
    });

    render(<App store={createStore()} />);

    await waitFor(() => {
      expect(screen.getByText('修改密码')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('修改密码'));

    await waitFor(() => {
      expect(screen.getByText('修改管理员密码')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('当前密码'), { target: { value: 'wrong_old_pass' } });
    fireEvent.change(screen.getByLabelText('新密码'), { target: { value: 'Valid_New_Password_123!' } });
    fireEvent.change(screen.getByLabelText('确认新密码'), { target: { value: 'Valid_New_Password_123!' } });
    fireEvent.click(screen.getByRole('button', { name: '确认修改' }));

    await waitFor(() => {
      expect(screen.getByText('当前密码错误')).toBeInTheDocument();
      // 验证输入内容得到保留
      expect(screen.getByLabelText('新密码')).toHaveValue('Valid_New_Password_123!');
    });
  });

  test('修改密码成功后清除认证与 CSRF，显示跳转提示', async () => {
    authAPI.getSession.mockResolvedValue({
      admin: { id: 'primary-admin', username: 'primary_admin' },
      session: { idleExpiresAt: '2026-07-23T12:00:00.000Z' },
      serverTime: '2026-07-23T10:00:00.000Z',
    });
    setCsrfToken('active-csrf-token');

    authAPI.updatePassword.mockResolvedValue({});

    render(<App store={createStore()} />);

    await waitFor(() => {
      expect(screen.getByText('修改密码')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('修改密码'));

    await waitFor(() => {
      expect(screen.getByText('修改管理员密码')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('当前密码'), { target: { value: 'Correct_Old_Pass_123!' } });
    fireEvent.change(screen.getByLabelText('新密码'), { target: { value: 'Valid_New_Password_123!' } });
    fireEvent.change(screen.getByLabelText('确认新密码'), { target: { value: 'Valid_New_Password_123!' } });
    fireEvent.click(screen.getByRole('button', { name: '确认修改' }));

    await waitFor(() => {
      expect(authAPI.updatePassword).toHaveBeenCalledWith({
        currentPassword: 'Correct_Old_Pass_123!',
        newPassword: 'Valid_New_Password_123!',
      });
      expect(getCsrfToken()).toBeNull();
      expect(screen.getByText('密码修改成功，请使用新密码重新登录')).toBeInTheDocument();
    });
  });
});

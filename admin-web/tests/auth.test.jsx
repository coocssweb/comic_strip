import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import authReducer, {
  setAuthenticated,
  setUnauthenticated,
  setUnavailable,
} from '../src/store/slices/authSlice';
import App from '../src/App';

// Mock authAPI
const mockLogin = jest.fn();
const mockGetSession = jest.fn();
const mockLogout = jest.fn();
const mockUpdatePassword = jest.fn();

// 默认成功的 getSession mock，避免 restoreSession 出错
mockGetSession.mockResolvedValue({
  admin: { id: 'admin-1', username: 'testadmin' },
  session: {
    idleExpiresAt: '2026-07-25T00:00:00.000Z',
    absoluteExpiresAt: '2026-07-25T12:00:00.000Z',
  },
  serverTime: '2026-07-24T00:00:00.000Z',
});

jest.mock('../src/api', () => ({
  authAPI: {
    get login() { return (...args) => mockLogin(...args); },
    get getSession() { return (...args) => mockGetSession(...args); },
    get logout() { return (...args) => mockLogout(...args); },
    get updatePassword() { return (...args) => mockUpdatePassword(...args); },
  },
}));

const authenticatedState = {
  auth: {
    status: 'authenticated',
    admin: { id: 'admin-1', username: 'testadmin' },
    idleExpiresAt: '2026-07-25T00:00:00.000Z',
    absoluteExpiresAt: '2026-07-25T12:00:00.000Z',
    serverTime: '2026-07-24T00:00:00.000Z',
  },
};

const unauthenticatedState = {
  auth: {
    status: 'unauthenticated',
    admin: null,
    idleExpiresAt: null,
    absoluteExpiresAt: null,
    serverTime: null,
  },
};

const bootstrappingState = {
  auth: {
    status: 'bootstrapping',
    admin: null,
    idleExpiresAt: null,
    absoluteExpiresAt: null,
    serverTime: null,
  },
};

function renderApp({ preloadedState = bootstrappingState, initialEntries = ['/'] } = {}) {
  const store = configureStore({
    reducer: { auth: authReducer },
    preloadedState,
  });
  return {
    store,
    ...render(
      <Provider store={store}>
        <MemoryRouter initialEntries={initialEntries}>
          <App store={store} />
        </MemoryRouter>
      </Provider>,
    ),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  // 恢复默认的 getSession mock
  mockGetSession.mockResolvedValue({
    admin: { id: 'admin-1', username: 'testadmin' },
    session: {
      idleExpiresAt: '2026-07-25T00:00:00.000Z',
      absoluteExpiresAt: '2026-07-25T12:00:00.000Z',
    },
    serverTime: '2026-07-24T00:00:00.000Z',
  });
});

describe('会话恢复', () => {
  it('应用启动时调用 GET /admin/auth/session 恢复会话', async () => {
    mockGetSession.mockResolvedValue({
      admin: { id: 'admin-1', username: 'testadmin' },
      session: {
        idleExpiresAt: '2026-07-25T00:00:00.000Z',
        absoluteExpiresAt: '2026-07-25T12:00:00.000Z',
      },
      serverTime: '2026-07-24T00:00:00.000Z',
    });

    renderApp();

    // 应该先显示加载中
    expect(screen.getByText('正在恢复会话...')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockGetSession).toHaveBeenCalled();
    });
  });

  it('会话恢复成功，进入受保护空壳', async () => {
    mockGetSession.mockResolvedValue({
      admin: { id: 'admin-1', username: 'testadmin' },
      session: {
        idleExpiresAt: '2026-07-25T00:00:00.000Z',
        absoluteExpiresAt: '2026-07-25T12:00:00.000Z',
      },
      serverTime: '2026-07-24T00:00:00.000Z',
    });

    renderApp();

    await waitFor(() => {
      expect(screen.getByText('四格漫画管理端')).toBeInTheDocument();
      expect(screen.getByText(/testadmin/)).toBeInTheDocument();
      expect(screen.getByText('修改密码')).toBeInTheDocument();
      expect(screen.getByText('登出')).toBeInTheDocument();
    });
  });

  it('会话恢复 401 跳转 /login', async () => {
    const authError = new Error('管理会话已失效，请重新登录');
    authError.code = 'ADMIN_AUTH_REQUIRED';
    authError.status = 401;
    mockGetSession.mockRejectedValue(authError);

    renderApp();

    await waitFor(() => {
      expect(screen.getByText('管理员登录')).toBeInTheDocument();
    });
  });

  it('服务不可用时显示故障页', async () => {
    const serviceError = new Error('服务暂时不可用');
    serviceError.code = 'SERVICE_UNAVAILABLE';
    serviceError.status = 503;
    mockGetSession.mockRejectedValue(serviceError);

    renderApp();

    await waitFor(() => {
      expect(screen.getByText('服务暂时不可用')).toBeInTheDocument();
      expect(screen.getByText('重新连接')).toBeInTheDocument();
    });
  });

  it('故障页可重试，成功后进入受保护空壳', async () => {
    const serviceError = new Error('服务暂时不可用');
    serviceError.code = 'SERVICE_UNAVAILABLE';
    serviceError.status = 503;

    mockGetSession.mockRejectedValueOnce(serviceError);
    mockGetSession.mockResolvedValueOnce({
      admin: { id: 'admin-1', username: 'testadmin' },
      session: {
        idleExpiresAt: '2026-07-25T00:00:00.000Z',
        absoluteExpiresAt: '2026-07-25T12:00:00.000Z',
      },
      serverTime: '2026-07-24T00:00:00.000Z',
    });

    renderApp();

    await waitFor(() => {
      expect(screen.getByText('重新连接')).toBeInTheDocument();
    });

    await act(async () => {
      await userEvent.click(screen.getByText('重新连接'));
    });

    await waitFor(() => {
      expect(screen.getByText(/testadmin/)).toBeInTheDocument();
    });
  });
});

describe('路由守卫', () => {
  it('未登录访问 / 重定向到 /login', async () => {
    const authError = new Error('管理会话已失效');
    authError.code = 'ADMIN_AUTH_REQUIRED';
    authError.status = 401;
    mockGetSession.mockRejectedValue(authError);

    renderApp({ preloadedState: bootstrappingState, initialEntries: ['/'] });

    await waitFor(() => {
      expect(screen.getByText('管理员登录')).toBeInTheDocument();
    });
  });

  it('已登录访问 /login 重定向到 /', async () => {
    renderApp({ preloadedState: authenticatedState, initialEntries: ['/login'] });

    await waitFor(() => {
      expect(screen.queryByText('管理员登录')).not.toBeInTheDocument();
    });
  });

  it('已登录访问 / 正常渲染首页', async () => {
    renderApp({ preloadedState: authenticatedState, initialEntries: ['/'] });

    await waitFor(() => {
      expect(screen.getByText(/testadmin/)).toBeInTheDocument();
      expect(screen.getByText('修改密码')).toBeInTheDocument();
      expect(screen.getByText('登出')).toBeInTheDocument();
    });
  });
});

describe('登录流程', () => {
  it('登录成功写入 Redux 并跳转 /', async () => {
    mockGetSession.mockRejectedValue({ code: 'ADMIN_AUTH_REQUIRED', status: 401, message: '管理会话已失效' });
    mockLogin.mockResolvedValue({
      admin: { id: 'admin-1', username: 'testadmin' },
      session: {
        idleExpiresAt: '2026-07-25T00:00:00.000Z',
        absoluteExpiresAt: '2026-07-25T12:00:00.000Z',
      },
      serverTime: '2026-07-24T00:00:00.000Z',
    });

    renderApp({ preloadedState: bootstrappingState, initialEntries: ['/login'] });

    await waitFor(() => {
      expect(screen.getByText('管理员登录')).toBeInTheDocument();
    });

    await userEvent.type(screen.getByPlaceholderText('管理员用户名'), 'testadmin');
    await userEvent.type(screen.getByPlaceholderText('请输入您的密码'), 'correct-password');

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: '登录' }));
    });

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({ username: 'testadmin', password: 'correct-password' });
    });
  });

  it('登录失败显示统一中文错误提示', async () => {
    mockGetSession.mockRejectedValue({ code: 'ADMIN_AUTH_REQUIRED', status: 401, message: '管理会话已失效' });
    const authError = new Error('用户名或密码错误');
    authError.code = 'ADMIN_CREDENTIALS_INVALID';
    authError.status = 401;
    mockLogin.mockRejectedValue(authError);

    renderApp({ preloadedState: bootstrappingState, initialEntries: ['/login'] });

    await waitFor(() => {
      expect(screen.getByText('管理员登录')).toBeInTheDocument();
    });

    await userEvent.type(screen.getByPlaceholderText('管理员用户名'), 'wronguser');
    await userEvent.type(screen.getByPlaceholderText('请输入您的密码'), 'wrong-password');

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: '登录' }));
    });

    await waitFor(() => {
      expect(screen.getByText('用户名或密码错误')).toBeInTheDocument();
    });
  });

  it('登录提交中禁用重复提交', async () => {
    mockGetSession.mockRejectedValue({ code: 'ADMIN_AUTH_REQUIRED', status: 401, message: '管理会话已失效' });
    mockLogin.mockImplementation(() => new Promise((resolve) => {
      setTimeout(() => resolve({
        admin: { id: 'admin-1', username: 'testadmin' },
        session: {
          idleExpiresAt: '2026-07-25T00:00:00.000Z',
          absoluteExpiresAt: '2026-07-25T12:00:00.000Z',
        },
        serverTime: '2026-07-24T00:00:00.000Z',
      }), 100);
    }));

    renderApp({ preloadedState: bootstrappingState, initialEntries: ['/login'] });

    await waitFor(() => {
      expect(screen.getByText('管理员登录')).toBeInTheDocument();
    });

    await userEvent.type(screen.getByPlaceholderText('管理员用户名'), 'testadmin');
    await userEvent.type(screen.getByPlaceholderText('请输入您的密码'), 'password');

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: '登录' }));
    });

    expect(screen.getByText('登录中...')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledTimes(1);
    });
  });
});

describe('登出流程', () => {
  it('登出后清除认证状态并跳转 /login', async () => {
    mockLogout.mockResolvedValue(undefined);

    renderApp({ preloadedState: authenticatedState, initialEntries: ['/'] });

    await waitFor(() => {
      expect(screen.getByText('登出')).toBeInTheDocument();
    });

    await act(async () => {
      await userEvent.click(screen.getByText('登出'));
    });

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
    });
  });

  it('登出请求失败依然清除本地认证状态', async () => {
    mockLogout.mockRejectedValue(new Error('Network error'));

    renderApp({ preloadedState: authenticatedState, initialEntries: ['/'] });

    await waitFor(() => {
      expect(screen.getByText('登出')).toBeInTheDocument();
    });

    await act(async () => {
      await userEvent.click(screen.getByText('登出'));
    });

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
    });
  });
});

describe('authSlice 状态', () => {
  it('初始状态为 bootstrapping', () => {
    const state = authReducer(undefined, { type: '@@INIT' });
    expect(state.status).toBe('bootstrapping');
    expect(state.admin).toBeNull();
  });

  it('setAuthenticated 设置管理员信息和会话状态', () => {
    const payload = {
      admin: { id: 'admin-1', username: 'testadmin' },
      session: {
        idleExpiresAt: '2026-07-25T00:00:00.000Z',
        absoluteExpiresAt: '2026-07-25T12:00:00.000Z',
      },
      serverTime: '2026-07-24T00:00:00.000Z',
    };
    const state = authReducer(undefined, setAuthenticated(payload));
    expect(state.status).toBe('authenticated');
    expect(state.admin).toEqual({ id: 'admin-1', username: 'testadmin' });
    expect(state.idleExpiresAt).toBe('2026-07-25T00:00:00.000Z');
    expect(state.absoluteExpiresAt).toBe('2026-07-25T12:00:00.000Z');
  });

  it('setUnauthenticated 清除认证信息', () => {
    const state = authReducer(
      { status: 'authenticated', admin: { id: '1', username: 'a' }, idleExpiresAt: 't', absoluteExpiresAt: 't', serverTime: 't' },
      setUnauthenticated(),
    );
    expect(state.status).toBe('unauthenticated');
    expect(state.admin).toBeNull();
    expect(state.idleExpiresAt).toBeNull();
    expect(state.absoluteExpiresAt).toBeNull();
    expect(state.serverTime).toBeNull();
  });

  it('setUnavailable 标记服务不可用', () => {
    const state = authReducer(undefined, setUnavailable());
    expect(state.status).toBe('unavailable');
  });
});

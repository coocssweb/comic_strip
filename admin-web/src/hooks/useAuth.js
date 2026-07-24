import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { authAPI } from '../api';
import {
  setAuthenticated,
  setBootstrapping,
  setUnauthenticated,
  setUnavailable,
} from '../store/slices/authSlice';
import { clearCsrfToken, setAuthInvalidListener } from '../utils/request';

export function useAuth() {
  const dispatch = useDispatch();
  const auth = useSelector((state) => state.auth);

  // 注册认证失效监听器：拦截器触发 onAuthInvalid 时，清除 CSRF 并标记未认证
  useEffect(() => {
    setAuthInvalidListener(() => {
      clearCsrfToken();
      dispatch(setUnauthenticated());
    });
  }, [dispatch]);

  const login = useCallback(async ({ username, password }) => {
    const data = await authAPI.login({ username, password });
    dispatch(setAuthenticated(data));
    return data;
  }, [dispatch]);

  const restoreSession = useCallback(async () => {
    if (auth.status !== 'authenticated') {
      dispatch(setBootstrapping());
    }
    try {
      const data = await authAPI.getSession();
      dispatch(setAuthenticated(data));
      return data;
    } catch (err) {
      if (err.code === 'ADMIN_AUTH_REQUIRED') {
        // 拦截器已通过 onAuthInvalid 处理，避免重复 dispatch
      } else if (auth.status !== 'authenticated') {
        clearCsrfToken();
        dispatch(setUnavailable());
      }
      throw err;
    }
  }, [dispatch, auth.status]);

  const logout = useCallback(async () => {
    try {
      await authAPI.logout();
    } finally {
      clearCsrfToken();
      dispatch(setUnauthenticated());
    }
  }, [dispatch]);

  const changePassword = useCallback(async ({ currentPassword, newPassword }) => {
    const result = await authAPI.updatePassword({ currentPassword, newPassword });
    clearCsrfToken();
    dispatch(setUnauthenticated());
    return result;
  }, [dispatch]);

  return {
    status: auth.status,
    admin: auth.admin,
    idleExpiresAt: auth.idleExpiresAt,
    absoluteExpiresAt: auth.absoluteExpiresAt,
    serverTime: auth.serverTime,
    login,
    restoreSession,
    logout,
    changePassword,
  };
}

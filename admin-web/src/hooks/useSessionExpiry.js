import { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';
import { setUnauthenticated } from '../store/slices/authSlice';
import { clearCsrfToken } from '../utils/request';

/** 会话到期前 5 分钟弹出提醒 */
const WARNING_BEFORE_MS = 5 * 60 * 1000;
/** 倒计时刷新间隔 */
const COUNTDOWN_INTERVAL_MS = 1000;

/**
 * 会话过期管理 hook
 * 以 idleExpiresAt 和 absoluteExpiresAt 中较早者为准，
 * 到期前 5 分钟弹出提醒弹窗；不监听鼠标/键盘活动，不发送静默保活请求。
 */
export function useSessionExpiry() {
  const {
    idleExpiresAt,
    absoluteExpiresAt,
    restoreSession,
    status,
  } = useAuth();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');

  // 标记是否已执行过到期处理，避免重复触发
  const expiredRef = useRef(false);
  // 保存定时器引用，便于清理
  const warningTimeoutRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  /**
   * 计算最早到期时间（毫秒时间戳）
   * 取 idleExpiresAt 和 absoluteExpiresAt 中较早者
   */
  const getEarliestExpiryMs = useCallback(() => {
    if (!idleExpiresAt && !absoluteExpiresAt) return null;
    const timestamps = [];
    if (idleExpiresAt) timestamps.push(new Date(idleExpiresAt).getTime());
    if (absoluteExpiresAt) timestamps.push(new Date(absoluteExpiresAt).getTime());
    return Math.min(...timestamps);
  }, [idleExpiresAt, absoluteExpiresAt]);

  // 会话到期处理：清除 Redux + CSRF，跳转登录页
  const handleExpired = useCallback(() => {
    if (expiredRef.current) return;
    expiredRef.current = true;
    clearCsrfToken();
    dispatch(setUnauthenticated());
    setShowWarning(false);
    navigate('/login', { replace: true });
  }, [dispatch, navigate]);

  useEffect(() => {
    // 仅已认证状态才监听过期
    if (status !== 'authenticated') return;

    const earliestExpiryMs = getEarliestExpiryMs();
    if (!earliestExpiryMs) return;

    // 每次 expiry 时间变化时重置到期标记
    expiredRef.current = false;

    /**
     * 检查并调度：判断当前是否已进入提醒窗口或已到期
     */
    const schedule = () => {
      const now = Date.now();
      const remaining = earliestExpiryMs - now;

      // 已到期
      if (remaining <= 0) {
        handleExpired();
        return;
      }

      // 已进入 5 分钟提醒窗口
      if (remaining <= WARNING_BEFORE_MS) {
        setShowWarning(true);
        setRemainingSeconds(Math.ceil(remaining / 1000));

        // 启动倒计时定时器
        if (countdownIntervalRef.current == null) {
          countdownIntervalRef.current = setInterval(() => {
            const now2 = Date.now();
            const remaining2 = earliestExpiryMs - now2;
            if (remaining2 <= 0) {
              handleExpired();
            } else {
              setRemainingSeconds(Math.ceil(remaining2 / 1000));
            }
          }, COUNTDOWN_INTERVAL_MS);
        }
        return;
      }

      // 尚未到提醒时间，设置一次性定时器在到期前 5 分钟唤醒
      if (warningTimeoutRef.current == null) {
        const delay = remaining - WARNING_BEFORE_MS;
        warningTimeoutRef.current = setTimeout(() => {
          warningTimeoutRef.current = null;
          schedule();
        }, delay);
      }
    };

    schedule();

    // 清理所有定时器
    return () => {
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
        warningTimeoutRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [status, getEarliestExpiryMs, handleExpired]);

  /**
   * 用户点击"继续使用"：调用 GET /admin/auth/session 续期
   * - 成功：更新 Redux 期限，关闭提醒
   * - 401：跳转登录页
   * - 服务失败：保留提醒并显示错误，允许重试
   */
  const handleContinue = useCallback(async () => {
    setIsRefreshing(true);
    setRefreshError('');
    try {
      await restoreSession();
      // 成功后 restoreSession 会更新 Redux 中的 idleExpiresAt/absoluteExpiresAt
      // useEffect 会因依赖变化重新调度，自然关闭提醒
      setShowWarning(false);
      expiredRef.current = false;
    } catch (err) {
      if (err.code === 'ADMIN_AUTH_REQUIRED') {
        // 会话已失效
        clearCsrfToken();
        dispatch(setUnauthenticated());
        setShowWarning(false);
        navigate('/login', { replace: true });
      } else {
        // 服务失败，保留提醒
        setRefreshError(err.message || '会话续期失败，请重试');
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [restoreSession, dispatch, navigate]);

  /**
   * 用户点击"重新登录"或到期自动跳转
   */
  const handleLogout = useCallback(() => {
    if (!expiredRef.current) {
      clearCsrfToken();
      dispatch(setUnauthenticated());
    }
    setShowWarning(false);
    navigate('/login', { replace: true });
  }, [dispatch, navigate]);

  return {
    showWarning,
    remainingSeconds,
    isRefreshing,
    refreshError,
    handleContinue,
    handleLogout,
  };
}

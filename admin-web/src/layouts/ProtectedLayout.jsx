import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import ChangePasswordModal from '../components/ChangePasswordModal';
import SessionExpiryWarningModal from '../components/SessionExpiryWarningModal';
import { useAuth } from '../hooks/useAuth';

export default function ProtectedLayout() {
  const {
    status,
    admin,
    idleExpiresAt,
    absoluteExpiresAt,
    serverTime,
    restoreSession,
    logout,
  } = useAuth();

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [actionError, setActionError] = useState('');

  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [isExpiryWarningOpen, setIsExpiryWarningOpen] = useState(false);
  const [isExtendingSession, setIsExtendingSession] = useState(false);
  const [extendSessionError, setExtendSessionError] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    if (status === 'bootstrapping') {
      restoreSession().catch(() => {
        // Handled in hook status transition
      });
    }
  }, [status, restoreSession]);

  // 定时倒计时与到期逻辑计算
  useEffect(() => {
    if (status !== 'authenticated' || !idleExpiresAt || !absoluteExpiresAt) {
      setRemainingSeconds(null);
      setIsExpiryWarningOpen(false);
      return;
    }

    const calcRemaining = () => {
      const idleMs = new Date(idleExpiresAt).getTime();
      const absoluteMs = new Date(absoluteExpiresAt).getTime();
      const earlierMs = Math.min(idleMs, absoluteMs);

      const serverMs = serverTime ? new Date(serverTime).getTime() : Date.now();
      const offset = Date.now() - serverMs;
      const currentServerMs = Date.now() - offset;

      const diffSecs = Math.max(0, Math.floor((earlierMs - currentServerMs) / 1000));
      return diffSecs;
    };

    const initialSecs = calcRemaining();
    setRemainingSeconds(initialSecs);

    if (initialSecs <= 300 && initialSecs > 0) {
      setIsExpiryWarningOpen(true);
    } else if (initialSecs <= 0) {
      logout().finally(() => {
        navigate('/login', {
          replace: true,
          state: { notice: '管理会话已到期，请重新登录' },
        });
      });
      return;
    }

    const timer = setInterval(() => {
      const secs = calcRemaining();
      setRemainingSeconds(secs);

      if (secs <= 300 && secs > 0) {
        setIsExpiryWarningOpen(true);
      } else if (secs <= 0) {
        clearInterval(timer);
        setIsExpiryWarningOpen(false);
        logout().finally(() => {
          navigate('/login', {
            replace: true,
            state: { notice: '管理会话已到期，请重新登录' },
          });
        });
      } else {
        setIsExpiryWarningOpen(false);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [status, idleExpiresAt, absoluteExpiresAt, serverTime, logout, navigate]);

  const handleLogout = async () => {
    setActionError('');
    try {
      await logout();
    } catch (err) {
      setActionError(err.message || '退出登录请求失败，请重试');
    }
  };

  const handleContinueSession = async () => {
    setExtendSessionError('');
    setIsExtendingSession(true);
    try {
      await restoreSession();
      setIsExpiryWarningOpen(false);
    } catch (err) {
      if (err.code === 'ADMIN_AUTH_REQUIRED') {
        setIsExpiryWarningOpen(false);
        navigate('/login', {
          replace: true,
          state: { notice: '管理会话已到期，请重新登录' },
        });
      } else {
        setExtendSessionError(err.message || '恢复会话失败，请检查网络连接后重载');
      }
    } finally {
      setIsExtendingSession(false);
    }
  };

  if (status === 'bootstrapping') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">正在恢复安全会话...</span>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  if (status === 'unavailable') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300 p-4">
        <div className="max-w-md w-full text-center bg-slate-900/80 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-2">服务暂时不可用</h2>
          <p className="text-sm text-slate-400 mb-6">
            后端服务网络连接中断或正在维护，请检查连接后重试。
          </p>
          <button
            onClick={() => restoreSession()}
            className="px-6 py-2.5 rounded-xl font-medium bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white transition-all text-sm"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="h-16 border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
          <span className="font-semibold text-white tracking-wide">天天种草平台管理端</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-400">
            管理员：<span className="text-slate-200 font-medium">{admin?.username || 'primary-admin'}</span>
          </span>
          <button
            onClick={() => setIsPasswordModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white transition-all text-xs font-medium border border-slate-700/50"
          >
            修改密码
          </button>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white transition-all text-xs font-medium border border-slate-700/50"
          >
            退出登录
          </button>
        </div>
      </header>

      {actionError && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-6 py-2 text-red-400 text-xs text-center flex items-center justify-between">
          <span className="mx-auto">{actionError}</span>
          <button
            onClick={() => setActionError('')}
            className="text-slate-400 hover:text-white text-xs"
          >
            关闭
          </button>
        </div>
      )}

      <main className="flex-1 p-8 max-w-7xl w-full mx-auto">
        <Outlet />
      </main>

      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />

      <SessionExpiryWarningModal
        isOpen={isExpiryWarningOpen}
        remainingSeconds={remainingSeconds}
        onContinue={handleContinueSession}
        onLogout={handleLogout}
        isLoading={isExtendingSession}
        errorMsg={extendSessionError}
      />
    </div>
  );
}

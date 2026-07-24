import React from 'react';
import { Provider } from 'react-redux';
import { Routes, Route, Navigate } from 'react-router-dom';

import { store as defaultStore } from './store';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/login/LoginPage';
import AdminLayout from './layouts/AdminLayout';
import ComicListPage from './pages/comics/ComicListPage';
import SeriesListPage from './pages/series/SeriesListPage';
import SeriesEditPage from './pages/series/SeriesEditPage';
import ComicEditPage from './pages/comics/ComicEditPage';

/**
 * 认证引导组件
 * 应用启动时恢复会话，决定初始路由
 * - bootstrapping: 显示加载中
 * - unavailable: 显示故障页（含重试入口）
 * - 其他状态（authenticated / unauthenticated）：渲染子路由
 */
function AuthBootstrap({ children }) {
  const { status, restoreSession } = useAuth();
  const [isRetrying, setIsRetrying] = React.useState(false);
  const bootedRef = React.useRef(false);

  React.useEffect(() => {
    // 应用启动时仅执行一次会话恢复
    if (!bootedRef.current) {
      bootedRef.current = true;
      restoreSession().catch(() => {
        // restoreSession 内部已处理状态变更，此处只吞掉未捕获异常
      });
    }
  }, [restoreSession]);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await restoreSession();
    } catch {
      // restoreSession 已更新状态
    } finally {
      setIsRetrying(false);
    }
  };

  // 启动中：显示加载态
  if (status === 'bootstrapping') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-muted-foreground">正在恢复会话...</p>
        </div>
      </div>
    );
  }

  // 服务不可用：显示故障页，含重试入口
  if (status === 'unavailable') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm text-center">
          <p className="text-lg font-extrabold text-foreground">服务暂时不可用</p>
          <p className="mt-2 text-sm font-medium text-muted-foreground">
            无法连接到服务器，请检查网络后重试
          </p>
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-md hover:bg-primary/90 disabled:opacity-50"
          >
            {isRetrying ? '重试中...' : '重新连接'}
          </button>
        </div>
      </div>
    );
  }

  return children;
}

/**
 * 受保护路由守卫
 * 未登录时重定向到 /login
 */
function ProtectedRoute({ children }) {
  const { status } = useAuth();

  if (status === 'bootstrapping' || status === 'unavailable') {
    // AuthBootstrap 已在父级处理这两种状态
    return null;
  }

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App({ store = defaultStore }) {
  return (
    <Provider store={store}>
      <AuthBootstrap>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          {/* 管理端受保护路由：AdminLayout 包裹所有管理页面 */}
          <Route
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/comics" replace />} />
            <Route path="/comics" element={<ComicListPage />} />
            <Route path="/comics/:id" element={<ComicEditPage />} />
            <Route path="/series" element={<SeriesListPage />} />
            <Route path="/series/:id" element={<SeriesEditPage />} />
          </Route>
        </Routes>
      </AuthBootstrap>
    </Provider>
  );
}

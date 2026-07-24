import React, { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Shield, User } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import PasswordInput from '../components/PasswordInput';
import { Button } from '../components/ui/button';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const notice = location.state?.notice;

  // 已登录状态使用 Navigate 组件重定向，避免在 render 中调用 navigate()
  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!username.trim()) {
      setErrorMsg('请输入管理员用户名');
      return;
    }
    if (!password) {
      setErrorMsg('请输入密码');
      return;
    }

    setErrorMsg('');
    setIsLoading(true);

    try {
      await login({ username: username.trim(), password });
      navigate('/', { replace: true });
    } catch (err) {
      // 统一显示中文错误提示，不区分"用户名不存在""密码错误"等诊断细节
      setErrorMsg(err.message || '登录失败，请检查用户名和密码');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        {/* 品牌标识 */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-lg font-extrabold text-foreground">四格漫画管理端</h1>
          <p className="mt-1 text-xs font-medium text-muted-foreground">管理员登录</p>
        </div>

        {/* 通知提示（如密码修改成功） */}
        {notice && (
          <div className="mb-4 rounded-lg border border-border bg-card p-3 text-sm font-medium text-foreground">
            {notice}
          </div>
        )}

        {/* 登录表单 */}
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
          {errorMsg && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              {errorMsg}
            </div>
          )}

          {/* 用户名 */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted-foreground">
              <User className="h-4 w-4" />
            </span>
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="管理员用户名"
              disabled={isLoading}
              className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-3.5 text-sm font-semibold text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
            />
          </div>

          {/* 密码 */}
          <PasswordInput
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="请输入您的密码"
            disabled={isLoading}
            className="w-full"
          />

          {/* 提交按钮 */}
          <Button
            type="submit"
            loading={isLoading}
            disabled={isLoading}
            className="w-full rounded-xl font-bold shadow-md"
          >
            {isLoading ? '登录中...' : '登录'}
          </Button>
        </form>
      </div>
    </div>
  );
}

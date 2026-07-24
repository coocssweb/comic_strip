import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, KeyRound, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import ChangePasswordModal from '../components/ChangePasswordModal';
import { Button } from '../components/ui/button';

export default function HomePage() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  const { admin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      // 即使登出请求失败，authSlice 已在 useAuth.logout 中清除
      navigate('/login', { replace: true });
    } finally {
      setIsLoggingOut(false);
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
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            当前管理员：{admin?.username || '未知'}
          </p>
        </div>

        {/* 操作面板 */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="space-y-3">
            {/* 修改密码 */}
            <Button
              variant="outline"
              className="w-full justify-start gap-3 rounded-xl font-semibold"
              onClick={() => setIsChangePasswordOpen(true)}
            >
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              修改密码
            </Button>

            {/* 登出 */}
            <Button
              variant="outline"
              loading={isLoggingOut}
              disabled={isLoggingOut}
              className="w-full justify-start gap-3 rounded-xl font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              {isLoggingOut ? '登出中...' : '登出'}
            </Button>
          </div>
        </div>
      </div>

      {/* 修改密码弹窗 */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </div>
  );
}

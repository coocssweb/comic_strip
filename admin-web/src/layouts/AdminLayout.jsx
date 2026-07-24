import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, Tag, Layers, Settings, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

// 侧边栏菜单项配置
const MENU_ITEMS = [
  { key: '/comics', label: '漫画管理', icon: BookOpen, enabled: true },
  { key: '/tags', label: '标签管理', icon: Tag, enabled: false },
  { key: '/series-manage', label: '系列管理', icon: Layers, enabled: false },
  { key: '/settings', label: '设置', icon: Settings, enabled: false },
];

/**
 * 管理端骨架布局
 * 左侧固定侧边栏 + 右侧主内容区
 */
export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      navigate('/login', { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const sidebarWidth = collapsed ? 'w-16' : 'w-[200px]';

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* 侧边栏 */}
      <aside
        className={cn(
          'flex shrink-0 flex-col border-r border-border bg-[var(--sidebar)] transition-all duration-200',
          sidebarWidth,
        )}
      >
        {/* Logo / 品牌区 */}
        <div className={cn('flex items-center border-b border-border/50 px-4 py-4', collapsed && 'justify-center px-2')}>
          {!collapsed && (
            <h1 className="text-sm font-extrabold text-[var(--sidebar-foreground)] truncate">四格漫画</h1>
          )}
        </div>

        {/* 菜单 */}
        <nav className="flex-1 space-y-1 px-2 py-3">
          {MENU_ITEMS.map((item) => {
            const isActive = location.pathname.startsWith(item.key);
            const Icon = item.icon;

            return (
              <button
                key={item.key}
                type="button"
                disabled={!item.enabled}
                onClick={() => item.enabled && navigate(item.key)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                  collapsed && 'justify-center px-2',
                  item.enabled
                    ? isActive
                      ? 'bg-secondary text-primary'
                      : 'text-[var(--sidebar-foreground)] hover:bg-muted/60'
                    : 'cursor-not-allowed text-muted-foreground/40',
                )}
                title={item.enabled ? item.label : `${item.label}（即将上线）`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* 底部：用户信息 + 登出 + 折叠 */}
        <div className={cn('border-t border-border/50 px-3 py-3', collapsed && 'px-2')}>
          {!collapsed && (
            <p className="mb-2 truncate text-xs font-medium text-muted-foreground">
              {admin?.username || '管理员'}
            </p>
          )}
          <div className={cn('flex gap-1', collapsed && 'flex-col items-center')}>
            <Button
              variant="ghost"
              size="sm"
              loading={isLoggingOut}
              onClick={handleLogout}
              className={cn('text-muted-foreground hover:text-destructive', collapsed ? 'h-8 w-8 p-0' : 'flex-1 justify-start rounded-lg text-xs')}
              title="登出"
            >
              {!isLoggingOut && <LogOut className="h-3.5 w-3.5" />}
              {!collapsed && '登出'}
            </Button>
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60"
              title={collapsed ? '展开侧边栏' : '折叠侧边栏'}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

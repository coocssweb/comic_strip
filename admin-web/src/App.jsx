import { useState } from 'react';
import { LogIn } from 'lucide-react';
import { adminAuthApi } from './api';
import ContentConsole from './components/ContentConsole';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import Toast from './components/Toast';

function LoginPage({ onLoggedIn }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const session = await adminAuthApi.login({ username, password });
      localStorage.setItem('admin-session-token', session.sessionToken);
      localStorage.setItem('admin-username', session.admin.username);
      onLoggedIn();
    } catch (error) {
      Toast.Error(error.message || '登录失败，请检查账号和密码。');
    } finally {
      setIsSubmitting(false);
    }
  }

  return <main className="grid min-h-screen place-items-center bg-primary p-5"><section className="w-full max-w-md rounded-[2rem] border border-primary-foreground/15 bg-card p-8 shadow-2xl"><p className="text-xs font-bold tracking-[0.24em] text-muted-foreground">FOUR PANEL COMIC</p><h1 className="mt-3 text-3xl font-black tracking-tight text-primary">四格漫画编辑台</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">登录后维护主题标签、漫画内容、专题封面和发布状态。</p><form className="mt-8 space-y-5" onSubmit={handleSubmit}><label className="block space-y-2"><span className="text-sm font-semibold text-primary">账号</span><Input aria-label="账号" size="lg" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></label><label className="block space-y-2"><span className="text-sm font-semibold text-primary">密码</span><Input aria-label="密码" size="lg" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label><Button type="submit" loading={isSubmitting} className="w-full" leftIcon={<LogIn />}>登录后台</Button></form></section></main>;
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(localStorage.getItem('admin-session-token')));
  return isLoggedIn ? <ContentConsole onLogout={() => setIsLoggedIn(false)} /> : <LoginPage onLoggedIn={() => setIsLoggedIn(true)} />;
}

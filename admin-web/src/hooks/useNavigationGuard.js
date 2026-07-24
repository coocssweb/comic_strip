import { useEffect, useRef } from 'react';
import { useBlocker } from 'react-router-dom';
import Dialog from '@/components/Dialog';

/**
 * 路由导航守卫 hook
 * 当 when 为 true 时，拦截所有 React Router 导航（浏览器后退/前进、编程式跳转）
 * 通过 Dialog.alert 展示确认弹窗，用户确认后放行，取消则留在当前页
 * @param {object} options
 * @param {boolean} options.when - 是否激活守卫
 * @param {string} options.title - Dialog.alert 标题
 * @param {string} options.content - Dialog.alert 描述
 */
export function useNavigationGuard({ when, title, content }) {
  const blocker = useBlocker(when);
  const blockerRef = useRef(blocker);
  blockerRef.current = blocker;

  useEffect(() => {
    if (blocker.state !== 'blocked') return;

    let cancelled = false;

    Dialog.alert({
      title,
      content,
      okText: '确定离开',
      cancelText: '取消',
    }).then((confirmed) => {
      if (cancelled) return;
      if (confirmed) {
        blockerRef.current.proceed?.();
      } else {
        blockerRef.current.reset?.();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [blocker.state, title, content]);
}
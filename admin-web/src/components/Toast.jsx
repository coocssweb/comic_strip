import React, { useEffect, useState } from 'react';
import { AlertTriangle, Check, } from 'lucide-react';
import { CloseButton } from "./CloseButton";

const MAX_VISIBLE_TOASTS = 3;
const EXIT_DURATION = 250;

const TOAST_CONFIG = {
  success: {
    title: '成功',
    duration: 3200,
    icon: Check,
    iconWrapClass: 'bg-emerald-100 text-primary',
    accentClass: 'border-l-[#01875f]',
    ariaLive: 'polite'
  },
  error: {
    title: '错误',
    duration: 4200,
    icon: AlertTriangle,
    iconWrapClass: 'bg-red-100 text-red-500',
    accentClass: 'border-l-red-500',
    ariaLive: 'assertive'
  },
  warning: {
    title: '警告',
    duration: 3800,
    icon: AlertTriangle,
    iconWrapClass: 'bg-amber-100 text-amber-500',
    accentClass: 'border-l-amber-500',
    ariaLive: 'polite'
  }
};

let toastRoot = null;
let toastHost = null;
let toastSequence = 0;
let toasts = [];
const listeners = new Set();
const timers = new Map();

function notify() {
  listeners.forEach((listener) => listener([...toasts]));
}

function ensureHost() {
  if (typeof document === 'undefined' || !document.body) return false;
  if (toastRoot) return true;

  toastHost = document.createElement('div');
  toastHost.id = '__global_toast_host__';
  document.body.appendChild(toastHost);
  const { createRoot } = require('react-dom/client');
  toastRoot = createRoot(toastHost);
  toastRoot.render(<ToastHost />);
  return true;
}

function normalizeOptions(type, input) {
  const config = TOAST_CONFIG[type] || TOAST_CONFIG.success;
  const options = typeof input === 'string' ? { description: input } : (input || {});

  return {
    type,
    title: options.title || config.title,
    description: options.description || options.message || '',
    duration: Number.isFinite(options.duration) ? options.duration : config.duration,
    closable: options.closable !== false
  };
}

function clearTimer(id) {
  const timer = timers.get(id);
  if (!timer) return;
  clearTimeout(timer);
  timers.delete(id);
}

function removeToast(id) {
  clearTimer(id);
  toasts = toasts.filter((toast) => toast.id !== id);
  notify();
}

function dismiss(id) {
  if (!id) return;
  const toast = toasts.find((item) => item.id === id);
  if (!toast || toast.exiting) return;

  clearTimer(id);
  toasts = toasts.map((item) => (item.id === id ? { ...item, exiting: true } : item));
  notify();
  timers.set(id, setTimeout(() => removeToast(id), EXIT_DURATION));
}

function show(type, input) {
  const id = `toast-${Date.now()}-${toastSequence += 1}`;
  if (!ensureHost()) return id;

  const nextToast = {
    id,
    ...normalizeOptions(type, input)
  };

  toasts = [nextToast, ...toasts].slice(0, MAX_VISIBLE_TOASTS);
  notify();

  if (nextToast.duration > 0) {
    timers.set(id, setTimeout(() => dismiss(id), nextToast.duration));
  }

  return id;
}

function clear() {
  [...toasts].forEach((toast) => dismiss(toast.id));
}

function ToastHost() {
  const [items, setItems] = useState(toasts);

  useEffect(() => {
    listeners.add(setItems);
    setItems([...toasts]);
    return () => listeners.delete(setItems);
  }, []);

  if (!items.length) return null;

  return (
    <div
      className="fixed left-1/2 top-4 z-[70] flex w-[calc(100vw-32px)] max-w-[360px] -translate-x-1/2 flex-col gap-3 sm:top-6"
      aria-live="polite"
    >
      {items.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

function ToastItem({ toast }) {
  const config = TOAST_CONFIG[toast.type] || TOAST_CONFIG.success;
  const Icon = config.icon;

  return (
    <section
      className={[
        'toast-slide-down-enter flex w-full items-start gap-3 rounded-lg border border-border border-l-[4px] bg-card px-4 py-3 text-left text-foreground shadow-[0_12px_28px_rgba(60,64,67,0.16),0_2px_8px_rgba(60,64,67,0.10)]',
        config.accentClass,
        toast.exiting ? 'toast-slide-up-exit' : ''
      ].filter(Boolean).join(' ')}
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={config.ariaLive}
    >
      <div
        className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${config.iconWrapClass}`}
        aria-hidden="true"
      >
        <Icon className="h-5 w-5" strokeWidth={toast.type === 'success' ? 3 : 2.5} />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-bold leading-5 tracking-normal text-foreground">{toast.title}</h2>
        {toast.description && (
          <p className="mt-1 break-words text-sm font-medium leading-5 text-muted-foreground">
            {toast.description}
          </p>
        )}
      </div>
      {toast.closable && (
        <CloseButton
          onClick={() => dismiss(toast.id)}
          aria-label="关闭提示"
          className="h-7 w-7"
        />
      )}
    </section>
  );
}

const Toast = {
  Success(input) {
    return show('success', input);
  },
  Error(input) {
    return show('error', input);
  },
  Warning(input) {
    return show('warning', input);
  },
  dismiss,
  clear
};

export default Toast;

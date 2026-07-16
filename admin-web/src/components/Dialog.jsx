import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import PropTypes from 'prop-types';
import { AlertCircle } from 'lucide-react';
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";
import { CloseButton } from "./CloseButton";
import {
  Dialog as BaseDialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogPortal,
  DialogOverlay,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';

/**
 * 声明式业务弹窗基座
 * 基于 Radix UI / Shadcn 的 Dialog 重构，向下兼容原有 Modal 的所有 Props。
 */
const Dialog = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon,
  children,
  widthClass = 'max-w-md',
  width,
  style = {},
  className = '',
  showClose = true,
  pure = false,
  closable = true,
  maskClosable = false,
  maskClassName,
  bodyClassName,
  footer,
  onOk,
  onCancel,
  okText,
  cancelText,
  okLoading = false,
  okType = 'default',
  okButtonProps = {},
  cancelButtonProps = {},
}) => {
  const [internalLoading, setInternalLoading] = useState(false);

  const handleOk = async (e) => {
    if (onOk) {
      setInternalLoading(true);
      try {
        await onOk(e);
        onClose?.();
      } catch (err) {
        console.error('[Dialog onOk error]:', err);
        setInternalLoading(false);
        return;
      }
      setInternalLoading(false);
    }
  };

  const handleCancel = (e) => {
    if (onCancel) {
      onCancel(e);
    } else {
      onClose?.();
    }
  };

  const isLoading = okLoading || internalLoading;
  // 映射 maskClosable：若 maskClosable 为 false，则阻止点击外部关闭
  const handlePointerDownOutside = (e) => {
    if (!maskClosable) {
      e.preventDefault();
    }
  };

  // 纯底座模式：仅提供 Portal 和背景遮罩，其内容卡片及样式完全由 children 自理，不带默认卡片包装
  if (pure) {
    return (
      <BaseDialog open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
        <DialogPortal>
          <DialogOverlay className={maskClassName} />
          <DialogPrimitive.Content
            onPointerDownOutside={handlePointerDownOutside}
            className={cn("fixed inset-0 z-50 flex items-center justify-center p-4 focus:outline-none", className)}
            style={style}
          >
            {children}
          </DialogPrimitive.Content>
        </DialogPortal>
      </BaseDialog>
    );
  }

  // 经典卡片包装模式
  return (
    <BaseDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose?.();
        }
      }}
    >
      <DialogContent
        hideCloseButton={!(closable && showClose) || !!title}
        overlayClassName={cn("bg-slate-900/40 backdrop-blur-sm", maskClassName)}
        onPointerDownOutside={handlePointerDownOutside}
        className={cn(
          "w-full overflow-hidden rounded-[24px] border border-border/60 bg-card text-foreground p-6 shadow-2xl transition-all text-left focus:outline-none",
          widthClass || width || "max-w-md",
          className
        )}
        style={style}
      >
        {/* 顶部标题与关闭栏 */}
        {title ? (
          <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
            <div className="flex items-center gap-2">
              {Icon && (
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
              )}
              <div>
                <DialogTitle className="text-sm font-extrabold text-foreground">
                  {title}
                </DialogTitle>
                {subtitle && (
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">
                    {subtitle}
                  </p>
                )}
                <DialogDescription className="sr-only">
                  {title} 弹窗内容
                </DialogDescription>
              </div>
            </div>
            {showClose && closable && (
              <DialogClose asChild>
                <CloseButton
                  onClick={onClose}
                  className="h-7 w-7"
                />
              </DialogClose>
            )}
          </div>
        ) : (
          <div className="sr-only">
            <DialogTitle>弹窗</DialogTitle>
            <DialogDescription>弹窗内容</DialogDescription>
          </div>
        )}

        {/* 弹窗内容 */}
        <div className={cn("relative", bodyClassName)}>{children}</div>

        {/* 声明式 Footer 支持 */}
        {footer ? (
          <DialogFooter>{footer}</DialogFooter>
        ) : onOk ? (
          <DialogFooter>
            {cancelText !== null && (
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
                className="rounded-xl font-bold text-muted-foreground active:scale-95"
                {...cancelButtonProps}
              >
                {cancelText || '取消'}
              </Button>
            )}
            <Button
              onClick={handleOk}
              loading={isLoading}
              variant={okType === 'destructive' ? 'destructive' : 'default'}
              className="rounded-xl font-bold shadow-md active:scale-95"
              {...okButtonProps}
            >
              {okText || '确定'}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </BaseDialog>
  );
};

/**
 * 统一的弹窗页脚组件
 * 包含 Premium 灰底、贴底和分割线样式
 */
const DialogFooter = ({ children, className }) => {
  return (
    <div
      className={cn(
        "px-6 py-5 border-t border-border flex justify-end gap-3 bg-muted/50 -mx-6 -mb-6 mt-4 shrink-0",
        className
      )}
    >
      {children}
    </div>
  );
};

DialogFooter.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

// PropTypes 契约声明，遵守工程规则
Dialog.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func,
  title: PropTypes.node,
  subtitle: PropTypes.string,
  icon: PropTypes.elementType,
  children: PropTypes.node.isRequired,
  widthClass: PropTypes.string,
  width: PropTypes.string,
  style: PropTypes.object,
  className: PropTypes.string,
  showClose: PropTypes.bool,
  pure: PropTypes.bool,
  closable: PropTypes.bool,
  maskClosable: PropTypes.bool,
  maskClassName: PropTypes.string,
  bodyClassName: PropTypes.string,
  footer: PropTypes.node,
  onOk: PropTypes.func,
  onCancel: PropTypes.func,
  okText: PropTypes.node,
  cancelText: PropTypes.node,
  okLoading: PropTypes.bool,
  okType: PropTypes.oneOf(['default', 'destructive']),
  okButtonProps: PropTypes.object,
  cancelButtonProps: PropTypes.object,
};

/* ═══════════════════════════════════════════════════════════ */
/**
 * 命令式全局确认/警告弹窗的底层交互包装器
 */
const AlertDialogWrapper = ({
  isOpen: initialOpen = true,
  title = '确认操作',
  content,
  description,
  okText = '确定',
  cancelText = '取消',
  okType = 'default',
  showIcon = false,
  className,
  onOk,
  onCancel,
  onResolve,
}) => {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [loading, setLoading] = useState(false);

  const handleOk = async () => {
    if (onOk) {
      setLoading(true);
      try {
        await onOk();
      } catch (err) {
        console.error('[Dialog.alert error]:', err);
        setLoading(false);
        return; // 拦截关闭操作
      }
    }
    setIsOpen(false);
    setTimeout(() => {
      onResolve(true);
    }, 200);
  };

  const handleCancel = () => {
    setIsOpen(false);
    setTimeout(() => {
      if (onCancel) {
        onCancel();
      }
      onResolve(false);
    }, 200);
  };

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !loading) {
          handleCancel();
        }
      }}
    >
      <AlertDialogContent className={cn("w-full max-w-sm rounded-[24px] border border-border/60 bg-card text-foreground p-6 shadow-2xl focus:outline-none", className)}>
        <AlertDialogHeader className="space-y-0">
          <div className="flex items-start gap-3 text-left">
            {showIcon && (
              <div
                className={cn(
                  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                  okType === 'danger' ? 'bg-red-50 text-red-500' : 'bg-secondary text-primary'
                )}
              >
                <AlertCircle className="h-5 w-5" />
              </div>
            )}
            <div className="flex-1">
              <AlertDialogTitle className="text-sm font-extrabold text-foreground leading-none">
                {title}
              </AlertDialogTitle>
              {(content || description) && (
                <AlertDialogDescription className="mt-2 text-xs font-semibold text-muted-foreground leading-relaxed">
                  {content || description}
                </AlertDialogDescription>
              )}
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-6 flex items-center gap-3 pt-2">
          {cancelText !== null && (
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
              className="flex-1 rounded-xl text-xs font-bold text-muted-foreground active:scale-98"
            >
              {cancelText}
            </Button>
          )}
          <Button
            onClick={handleOk}
            loading={loading}
            variant={okType === 'danger' ? 'destructive' : 'default'}
            className="flex-1 rounded-xl text-xs font-bold shadow-md active:scale-98"
          >
            {okText}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

AlertDialogWrapper.propTypes = {
  isOpen: PropTypes.bool,
  title: PropTypes.node,
  content: PropTypes.node,
  description: PropTypes.node,
  okText: PropTypes.node,
  cancelText: PropTypes.node,
  okType: PropTypes.string,
  showIcon: PropTypes.bool,
  className: PropTypes.string,
  onOk: PropTypes.func,
  onCancel: PropTypes.func,
  onResolve: PropTypes.func.isRequired,
};

/* ═══════════════════════════════════════════════════════════ */
// 命令式全局确认/警告弹窗方法
export const alert = (options = {}) => {
  return new Promise((resolve) => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);

    let isResolved = false;

    // 清理 DOM 和 React 挂载根节点
    const cleanup = () => {
      root.unmount();
      div.remove();
    };

    const handleResolve = (result) => {
      if (isResolved) return;
      isResolved = true;
      resolve(result);
      cleanup();
    };

    root.render(
      <AlertDialogWrapper
        {...options}
        onResolve={handleResolve}
      />
    );
  });
};

// 挂载静态属性与方法
Dialog.Footer = DialogFooter;
Dialog.alert = alert;

export default Dialog;

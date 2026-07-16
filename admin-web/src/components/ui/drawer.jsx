"use client"

import * as React from "react"
import { createRoot } from "react-dom/client"
import PropTypes from "prop-types"
import { Drawer as DrawerPrimitive } from "vaul"

import { cn } from "@/utils/cn"
import { CloseButton } from "../CloseButton"

const Drawer = ({
  shouldScaleBackground = true,
  ...props
}) => (
  <DrawerPrimitive.Root shouldScaleBackground={shouldScaleBackground} {...props} />
)
Drawer.displayName = "Drawer"

const DrawerTrigger = DrawerPrimitive.Trigger

const DrawerPortal = DrawerPrimitive.Portal

const DrawerClose = DrawerPrimitive.Close

const DrawerOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-black/80", className)}
    {...props} />
))
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName

const DrawerContent = React.forwardRef(({ className, children, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay />
    <DrawerPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[10px] border bg-background",
        className
      )}
      {...props}>
      <div className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted" />
      {children}
    </DrawerPrimitive.Content>
  </DrawerPortal>
))
DrawerContent.displayName = "DrawerContent"

const DrawerHeader = ({
  className,
  ...props
}) => (
  <div
    className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)}
    {...props} />
)
DrawerHeader.displayName = "DrawerHeader"

const DrawerFooter = ({
  className,
  ...props
}) => (
  <div className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />
)
DrawerFooter.displayName = "DrawerFooter"

const DrawerTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props} />
))
DrawerTitle.displayName = DrawerPrimitive.Title.displayName

const DrawerDescription = React.forwardRef(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props} />
))
DrawerDescription.displayName = DrawerPrimitive.Description.displayName

/**
 * 兼容原有侧边抽屉组件 (SideDrawer)
 * 
 * 使用 vaul 封装，提供右侧滑出、遮罩层、响应式布局、滚动锁定、Portal挂载等交互。
 */
const SideDrawer = ({
  isOpen,             // 控制抽屉打开/关闭 (必填)
  onClose,            // 关闭事件回调 (必填)
  title,              // 标题内容 (ReactNode)
  subtitle,           // 副标题内容 (string)
  icon: Icon,         // 标题左侧可选的 Lucide 图标组件
  extra,              // 头部右侧额外操作区 (ReactNode)
  footer,             // 底部固定栏区域 (ReactNode)
  width = 'max-w-lg', // 抽屉最大宽度，如 max-w-lg, max-w-2xl, max-w-3xl
  closable = true,    // 是否显示右上角的关闭按钮
  maskClosable = true,// 点击遮罩是否允许关闭
  children,           // 抽屉内部主体内容 (必填)
  className,          // 抽屉面板的额外类名
  maskClassName,      // 遮罩层的额外类名
  bodyClassName,      // 内容区域的额外类名
}) => {
  return (
    <DrawerPrimitive.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose?.();
        }
      }}
      direction="right"
      dismissible={maskClosable && closable}
    >
      <DrawerPrimitive.Portal>
        {/* 遮罩层：提供毛玻璃与暗色半透明效果 */}
        <DrawerPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300",
            maskClassName
          )}
        />
        {/* 抽屉内容面板：贴在右侧，高度 100%，宽度自适应 */}
        <DrawerPrimitive.Content
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex h-full flex-col border-l border-border bg-card text-foreground shadow-2xl transition-transform duration-300 focus:outline-none",
            width,
            className
          )}
        >
          {/* 头部栏：包含图标、主标题、副标题、右上角额外内容及关闭按钮 */}
          {(title || closable || extra) && (
            <div className="flex h-16 items-center justify-between border-b border-border px-6 bg-card shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                {Icon && (
                  <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0">
                  {title && (
                    <DrawerPrimitive.Title className="text-sm font-extrabold text-foreground truncate">
                      {title}
                    </DrawerPrimitive.Title>
                  )}
                  {subtitle && (
                    <p className="mt-0.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">
                      {subtitle}
                    </p>
                  )}
                  {/* 提供无障碍的 Screen Reader 隐藏描述 */}
                  <DrawerPrimitive.Description className="sr-only">
                    {title || "抽屉"}面板内容
                  </DrawerPrimitive.Description>
                </div>
              </div>

              {/* 头部右侧操作区与关闭按钮 */}
              <div className="flex items-center gap-3 shrink-0">
                {extra}
                {closable && (
                  <CloseButton
                    onClick={onClose}
                    className="h-8 w-8"
                  />
                )}
              </div>
            </div>
          )}

          {/* 主体滚动内容区 */}
          <div className={cn("flex-1 overflow-y-auto p-6 bg-card", bodyClassName)}>
            {children}
          </div>

          {/* 底部固定栏 */}
          {footer && (
            <div className="border-t border-border px-6 py-4 bg-muted/30 shrink-0">
              {footer}
            </div>
          )}
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
};

SideDrawer.displayName = "SideDrawer"

// 属性类型声明契约，遵循项目前端规范
SideDrawer.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.node,
  subtitle: PropTypes.string,
  icon: PropTypes.elementType,
  extra: PropTypes.node,
  footer: PropTypes.node,
  width: PropTypes.string,
  closable: PropTypes.bool,
  maskClosable: PropTypes.bool,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  maskClassName: PropTypes.string,
  bodyClassName: PropTypes.string,
};

/* ═══════════════════════════════════════════════════════════ */
// 内置的命令式渲染包装组件
function CommandWrapper({ Component, props, onClose, onSuccess }) {
  const [isOpen, setIsOpen] = React.useState(true);

  const handleClose = (result, isSuccess) => {
    setIsOpen(false);
    // 延迟 250ms 以确保 vaul 的侧滑动画完整执行完毕后再销毁挂载的根节点
    setTimeout(() => {
      if (isSuccess) {
        onSuccess(result);
      } else {
        onClose();
      }
    }, 250);
  };

  return (
    <Component
      {...props}
      isOpen={isOpen}
      onClose={() => handleClose(null, false)}
      onSuccess={(data) => handleClose(data || true, true)}
    />
  );
}

CommandWrapper.propTypes = {
  Component: PropTypes.elementType.isRequired,
  props: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func.isRequired,
};

/* ═══════════════════════════════════════════════════════════ */
// 命令式动态挂载抽屉方法，行为类似于 Dialog.show
export const show = (Component, props = {}) => {
  return new Promise((resolve) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    // 卸载与清理节点
    const cleanup = (val) => {
      root.unmount();
      container.remove();
      resolve(val);
    };

    root.render(
      <CommandWrapper
        Component={Component}
        props={props}
        onClose={() => cleanup(null)}
        onSuccess={(data) => cleanup(data)}
      />
    );
  });
};

// 挂载静态属性与方法
SideDrawer.show = show;

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
  SideDrawer,
}

export default SideDrawer;

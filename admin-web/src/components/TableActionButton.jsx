import React from 'react';
import PropTypes from 'prop-types';
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";

/**
 * 表格行操作的专用文字按钮，提供统一的品牌/状态色值、悬停背景色及暗黑模式适配。
 */
export const TableActionButton = React.forwardRef(({
  className,
  variant = "ghost",
  size = "sm",
  intent = "primary",
  children,
  ...props
}, ref) => {
  // 定义各种语义意图的颜色和交互样式（包含暗黑模式适配）
  const intentClasses = {
    primary: "text-primary hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/20 dark:hover:text-emerald-400 font-bold",
    warning: "text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:text-amber-500 dark:hover:bg-amber-950/20 dark:hover:text-amber-400 font-bold",
    danger: "text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/20 dark:hover:text-red-300 font-bold"
  };

  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={cn(intentClasses[intent], className)}
      {...props}
    >
      {children}
    </Button>
  );
});

TableActionButton.displayName = "TableActionButton";

TableActionButton.propTypes = {
  /** 额外的 CSS 类名 */
  className: PropTypes.string,
  /** 基础按钮变体样式，默认为 ghost */
  variant: PropTypes.string,
  /** 按钮尺寸，默认为 sm */
  size: PropTypes.string,
  /** 语义意图种类：主操作/成功 (primary)、警告/提醒 (warning)、危险/删除 (danger) */
  intent: PropTypes.oneOf(["primary", "warning", "danger"]),
  /** 按钮文本或内容 */
  children: PropTypes.node,
};

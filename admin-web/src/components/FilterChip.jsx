import React from 'react';
import PropTypes from 'prop-types';
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";

/**
 * 列表顶部的状态卡片/状态切换页签，统一了选中与非选中态的交互视觉。
 */
export const FilterChip = React.forwardRef(({
  className,
  isActive,
  children,
  count,
  onClick,
  ...props
}, ref) => {
  return (
    <Button
      ref={ref}
      type="button"
      variant="ghost"
      onClick={onClick}
      className={cn(
        "filter-chip-item h-auto py-2 transition-all duration-200",
        isActive ? 'filter-chip-item-active' : 'filter-chip-item-inactive',
        className
      )}
      {...props}
    >
      <span>{children}</span>
      {count !== undefined && (
        <span className="ml-1.5 text-[10px] opacity-80">({count})</span>
      )}
    </Button>
  );
});

FilterChip.displayName = "FilterChip";

FilterChip.propTypes = {
  /** 额外的 CSS 类名 */
  className: PropTypes.string,
  /** 是否处于选中激活状态 */
  isActive: PropTypes.bool.isRequired,
  /** 页签显示的文字标签 */
  children: PropTypes.node.isRequired,
  /** 状态对应的数量指标（可选） */
  count: PropTypes.number,
  /** 点击回调函数 */
  onClick: PropTypes.func,
};

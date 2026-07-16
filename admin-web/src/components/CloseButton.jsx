import React from 'react';
import PropTypes from 'prop-types';
import { X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";

/**
 * 通用弹窗/消息关闭按钮，提供统一的样式及无障碍属性。
 */
export const CloseButton = React.forwardRef(({ className, onClick, ...props }, ref) => {
  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      onClick={onClick}
      className={cn(
        "h-8 w-8 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground",
        className
      )}
      aria-label="关闭"
      {...props}
    >
      <X className="h-4 w-4" />
    </Button>
  );
});

CloseButton.displayName = "CloseButton";

CloseButton.propTypes = {
  /** 额外的样式类名 */
  className: PropTypes.string,
  /** 点击关闭的回调函数 */
  onClick: PropTypes.func.isRequired,
};

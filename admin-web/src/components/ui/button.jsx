import * as React from "react"
import PropTypes from "prop-types"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/utils/cn"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  leftIcon,
  rightIcon,
  children,
  disabled,
  type = "button",
  ...props
}, ref) => {
  const Comp = asChild ? Slot : "button"
  
  // 当 loading 处于激活状态时，按钮将被隐式禁用以防止重复提交
  const isButtonDisabled = disabled || loading

  return (
    <Comp
      type={asChild ? undefined : type}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={isButtonDisabled}
      ref={ref}
      {...props}
    >
      {/* 处于加载中状态时，优先展示旋转的 Spinner */}
      {loading && <Loader2 className="animate-spin" />}
      {/* 仅在非加载状态下才渲染左侧图标 */}
      {!loading && leftIcon && <span className="inline-flex">{leftIcon}</span>}
      {children}
      {/* 仅在非加载状态下才渲染右侧图标 */}
      {!loading && rightIcon && <span className="inline-flex">{rightIcon}</span>}
    </Comp>
  )
})
Button.displayName = "Button"

Button.propTypes = {
  /** 额外的 CSS 类名 */
  className: PropTypes.string,
  /** 按钮的样式变体 */
  variant: PropTypes.oneOf(["default", "destructive", "outline", "secondary", "ghost", "link"]),
  /** 按钮的尺寸变体 */
  size: PropTypes.oneOf(["default", "sm", "lg", "icon"]),
  /** 是否作为子组件多态渲染 */
  asChild: PropTypes.bool,
  /** 是否处于加载中状态 */
  loading: PropTypes.bool,
  /** 按钮文字左侧的图标 */
  leftIcon: PropTypes.node,
  /** 按钮文字右侧的图标 */
  rightIcon: PropTypes.node,
  /** 按钮的子内容 */
  children: PropTypes.node,
  /** 是否处于被禁用状态 */
  disabled: PropTypes.bool,
  /** 按钮原生 HTML 类型 */
  type: PropTypes.oneOf(["button", "submit", "reset"]),
}

export { Button, buttonVariants }

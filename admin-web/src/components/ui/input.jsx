import * as React from "react"
import PropTypes from "prop-types"
import { cva } from "class-variance-authority"

import { cn } from "@/utils/cn"

// 定义输入框的类名变体，整合现有项目的 border-border 边框、bg-card 背景以及 rounded-xl 圆角风格
const inputVariants = cva(
  "flex w-full rounded-xl border border-border bg-card text-foreground transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/15 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted",
  {
    variants: {
      size: {
        // 默认尺寸：高度 h-9，常用于列表检索或普通筛选框
        default: "h-9 px-3 text-xs font-medium",
        // 大尺寸：高度 h-11，常用于模态弹窗大表单或主要操作入口
        lg: "h-11 px-3.5 text-xs font-semibold",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

const Input = React.forwardRef(({ className, type, size, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(inputVariants({ size, className }))}
      ref={ref}
      {...props}
    />
  )
})
Input.displayName = "Input"

Input.propTypes = {
  /** 额外的 CSS 类名，用于覆盖默认样式或传入定制间距 */
  className: PropTypes.string,
  /** 输入框的尺寸，包含 default (h-9) 和 lg (h-11) */
  size: PropTypes.oneOf(["default", "lg"]),
  /** 原生 HTML input 元素的 type 属性，如 text、password 等 */
  type: PropTypes.string,
}

export { Input, inputVariants }


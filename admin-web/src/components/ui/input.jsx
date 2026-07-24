import * as React from "react"
import PropTypes from "prop-types"
import { cva } from "class-variance-authority"

import { cn } from "@/utils/cn"

// 定义输入框的类名变体，整合现有项目的 border-border 边框、bg-card 背景以及 rounded-xl 圆角风格
const inputVariants = cva(
  "flex w-full rounded-xl border border-border text-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground disabled:opacity-50",
  {
    variants: {
      variant: {
        // 默认变体：适用于工具栏搜索、列表筛选等紧凑场景
        default:
          "bg-card transition-all placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/15 disabled:cursor-not-allowed disabled:bg-muted",
        // 表单变体：适用于登录页、弹窗等以表单为核心交互的场景，聚焦态始终可见
        form:
          "placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 text-sm font-semibold py-2.5 px-3.5",
      },
      size: {
        // 默认尺寸：高度 h-9，常用于列表检索或普通筛选框
        default: "h-9 px-3 text-xs font-medium",
        // 大尺寸：高度 h-11，常用于模态弹窗大表单或主要操作入口
        lg: "h-11 px-3.5 text-xs font-semibold",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Input = React.forwardRef(({ className, type, variant, size, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(inputVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
})
Input.displayName = "Input"

Input.propTypes = {
  /** 额外的 CSS 类名，用于覆盖默认样式或传入定制间距 */
  className: PropTypes.string,
  /** 视觉变体：default 适用于工具栏/搜索等紧凑场景，form 适用于登录、弹窗等表单场景 */
  variant: PropTypes.oneOf(["default", "form"]),
  /** 输入框的尺寸，包含 default (h-9) 和 lg (h-11) */
  size: PropTypes.oneOf(["default", "lg"]),
  /** 原生 HTML input 元素的 type 属性，如 text、password 等 */
  type: PropTypes.string,
}

export { Input, inputVariants }


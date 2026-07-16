import React from 'react';
import PropTypes from 'prop-types';
import { cva } from "class-variance-authority";
import { cn } from "@/utils/cn";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

// 使用 class-variance-authority 定义触发器在不同场景下的高度与样式规格
const selectTriggerVariants = cva(
  "flex w-full items-center justify-between border border-input bg-background ring-offset-background data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
  {
    variants: {
      size: {
        default: "h-10 px-3 py-2 text-sm rounded-md font-medium", // 对应 TaskModal (h-10)
        md: "h-9 px-3 py-1.5 text-xs rounded-lg font-medium",      // 对应 ErrorLogsPage (h-9)
        sm: "h-8 px-2 py-1 text-xs rounded-md font-medium",        // 对应 Pagination (h-8)
      }
    },
    defaultVariants: {
      size: "default",
    }
  }
);

/**
 * 统一的受控选择组件
 * 封装了 shadcn 细粒度组件的组合复杂度，并处理了只能接收和返回 string 类型的限制
 */
const FormSelect = React.forwardRef(({
  value,
  onChange,
  options = [],
  placeholder = "请选择",
  disabled = false,
  className,
  size = "default",
  contentClassName,
  ...props
}, ref) => {
  // 1. 数据对齐：将传入的 value 转换为 string 以配合 Radix UI 渲染需求
  // 若值为 null/undefined/""，传 undefined 可使 Radix UI 正确渲染占位符
  const hasValue = value !== undefined && value !== null && value !== '';
  const stringValue = hasValue ? String(value) : undefined;

  // 2. 变更处理：转换回原选项对应的数据类型并触发 onChange 回调
  const handleValueChange = (val) => {
    const matchedOption = options.find((opt) => String(opt.value) === val);
    if (matchedOption && onChange) {
      onChange(matchedOption.value);
    }
  };

  return (
    <Select
      value={stringValue}
      onValueChange={handleValueChange}
      disabled={disabled}
      {...props}
    >
      <SelectTrigger
        ref={ref}
        className={cn(selectTriggerVariants({ size, className }))}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {options.map((opt) => (
          <SelectItem
            key={String(opt.value)}
            value={String(opt.value)}
            disabled={opt.disabled}
          >
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
});

FormSelect.displayName = "FormSelect";

// 声明组件的 Props 契约
FormSelect.propTypes = {
  /** 当前选中的值（支持字符串或数字） */
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  /** 值变更时的回调函数，回调参数为选中项的原始类型值 */
  onChange: PropTypes.func,
  /** 选项列表，每项包含 label 与 value */
  options: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.node.isRequired,
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      disabled: PropTypes.bool,
    })
  ),
  /** 占位提示文本 */
  placeholder: PropTypes.string,
  /** 是否禁用组件 */
  disabled: PropTypes.bool,
  /** 触发器（Trigger）的额外样式类名 */
  className: PropTypes.string,
  /** 下拉浮动面板（Content）的额外样式类名 */
  contentClassName: PropTypes.string,
  /** 选择框的尺寸类型 */
  size: PropTypes.oneOf(["default", "md", "sm"]),
};

export default FormSelect;

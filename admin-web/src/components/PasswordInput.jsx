import React, { useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";

const PasswordInput = ({
  value,
  onChange,
  placeholder = '请输入您的密码',
  icon: Icon = Lock,
  className = '',
  inputClassName = '',
  required = false,
  disabled = false,
  theme = 'auto',
  name,
  autoComplete,
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const toggleVisibility = (e) => {
    e.preventDefault(); // 阻止意外的表单提交
    if (disabled) return;
    setShowPassword(!showPassword);
  };

  return (
    <div className={`relative w-full ${className}`}>
      {/* 左侧前置安全图标 */}
      {Icon && (
        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-muted-foreground">
          <Icon className="h-4 w-4" />
        </span>
      )}

      {/* 密码输入文本框 */}
      <input
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        name={name}
        autoComplete={autoComplete}
        className={`w-full rounded-xl border pl-10 pr-10 py-2.5 text-xs font-semibold focus:outline-none transition-colors disabled:opacity-50 ${
          theme === 'dark'
            ? 'border-white/10 bg-white/10 text-white placeholder:text-slate-600 focus:border-[#01875f]/60 focus:bg-white/10 focus:ring-2 focus:ring-[#01875f]/15'
            : theme === 'light'
            ? 'border-border bg-card text-foreground focus:border-primary disabled:bg-muted'
            : 'border-slate-200 dark:border-white/10 bg-white dark:bg-white/10 text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:border-[#01875f] dark:focus:border-[#01875f]/60 focus:bg-white dark:focus:bg-white/10 focus:ring-2 focus:ring-[#01875f]/15 dark:focus:ring-[#01875f]/15'
        } ${inputClassName}`}
        {...props}
      />

      {/* 右侧眼睛开关按钮（无动画静态切换） */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={toggleVisibility}
        disabled={disabled}
        aria-label={showPassword ? "隐藏密码" : "显示密码"}
        className={cn(
          "absolute inset-y-0 right-0 h-full w-10 flex items-center justify-center p-0 text-muted-foreground hover:bg-transparent disabled:opacity-50 disabled:cursor-not-allowed",
          theme === 'dark'
            ? 'hover:text-slate-200'
            : theme === 'light'
            ? 'hover:text-muted-foreground'
            : 'hover:text-slate-600 dark:hover:text-slate-200'
        )}
      >
        <div className={showPassword ? 'text-primary' : ''}>
          {showPassword ? (
            <EyeOff className="h-4 w-4 stroke-[2.2]" />
          ) : (
            <Eye className="h-4 w-4 stroke-[2.2]" />
          )}
        </div>
      </Button>
    </div>
  );
};

export default PasswordInput;

import React, { useEffect } from 'react';
import { Check, X } from 'lucide-react';

const PasswordStrengthIndicator = ({ password = '', isSpecial = false, onChange }) => {
  // 1. 计算各项指标的达成状态
  const hasMinLength = isSpecial ? password.length >= 10 : password.length >= 6;
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>_]/.test(password);

  // 2. 算分 (共 5 分)
  let score = 0;
  if (password.length > 0) {
    if (hasMinLength) score += 1;
    if (hasLowercase) score += 1;
    if (hasUppercase) score += 1;
    if (hasDigit) score += 1;
    if (hasSpecial) score += 1;
  }

  // 3. 计算强度等级与视觉映射 (暗黑适配版)
  let level = ''; // '弱' | '中' | '强'
  let colorClass = 'bg-slate-200/60 dark:bg-white/10';
  let textColorClass = 'text-muted-foreground';
  let barCount = 0;

  if (password.length > 0) {
    if (score <= 2) {
      level = '弱 (Weak)';
      colorClass = 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]';
      textColorClass = 'text-rose-400';
      barCount = 1;
    } else if (score === 3) {
      level = '中 (Medium)';
      colorClass = 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]';
      textColorClass = 'text-amber-400';
      barCount = 2;
    } else {
      level = '强 (Strong)';
      colorClass = 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]';
      textColorClass = 'text-emerald-400';
      barCount = 3;
    }
  }

  // 4. 判定密码是否满足提交标准
  // 找回密码要求：长度 >= 6 且至少达到中等（score >= 3）
  const isValid = isSpecial
    ? hasMinLength && hasLowercase && hasUppercase && hasDigit && hasSpecial
    : hasMinLength && score >= 3;

  // 5. 触发回调通知父表单
  useEffect(() => {
    if (onChange) {
      onChange(isValid);
    }
  }, [isValid, onChange]);

  if (!password) return null;

  return (
    <div className="mt-3 space-y-2.5 animate-in fade-in duration-200 text-left">
      {/* 强度描述 */}
      <div className="flex items-center justify-between text-[11px] font-bold">
        <span className="text-muted-foreground">密码安全强度:</span>
        <span className={`text-[11px] font-extrabold ${textColorClass}`}>{level}</span>
      </div>

      {/* 三格渐变条 */}
      <div className="grid grid-cols-3 gap-1.5 h-1.5 w-full">
        <div className={`h-full rounded-full transition-all duration-300 ${barCount >= 1 ? colorClass : 'bg-slate-200/60 dark:bg-white/10'}`} />
        <div className={`h-full rounded-full transition-all duration-300 ${barCount >= 2 ? colorClass : 'bg-slate-200/60 dark:bg-white/10'}`} />
        <div className={`h-full rounded-full transition-all duration-300 ${barCount >= 3 ? colorClass : 'bg-slate-200/60 dark:bg-white/10'}`} />
      </div>

      {/* 安全校验指引细则 */}
      <ul className="mt-2.5 space-y-1.5 text-[11px] font-medium">
        <li className={`flex items-center gap-1.5 transition-colors duration-200 ${hasMinLength ? 'text-slate-700 dark:text-slate-300' : 'text-muted-foreground'}`}>
          {hasMinLength ? (
            <Check className="h-3.5 w-3.5 text-emerald-400 stroke-[3px]" />
          ) : (
            <X className="h-3.5 w-3.5 text-muted-foreground stroke-[3px]" />
          )}
          <span>密码长度至少 {isSpecial ? '10' : '6'} 位 {isSpecial && <span className="font-bold text-rose-400">(硬性要求)</span>}</span>
        </li>
        <li className={`flex items-center gap-1.5 transition-colors duration-200 ${hasLowercase ? 'text-slate-700 dark:text-slate-300' : 'text-muted-foreground'}`}>
          {hasLowercase ? (
            <Check className="h-3.5 w-3.5 text-emerald-400 stroke-[3px]" />
          ) : (
            <X className="h-3.5 w-3.5 text-muted-foreground stroke-[3px]" />
          )}
          <span>包含小写字母 (a-z)</span>
        </li>
        <li className={`flex items-center gap-1.5 transition-colors duration-200 ${hasUppercase ? 'text-slate-700 dark:text-slate-300' : 'text-muted-foreground'}`}>
          {hasUppercase ? (
            <Check className="h-3.5 w-3.5 text-emerald-400 stroke-[3px]" />
          ) : (
            <X className="h-3.5 w-3.5 text-muted-foreground stroke-[3px]" />
          )}
          <span>包含大写字母 (A-Z)</span>
        </li>
        <li className={`flex items-center gap-1.5 transition-colors duration-200 ${hasDigit ? 'text-slate-700 dark:text-slate-300' : 'text-muted-foreground'}`}>
          {hasDigit ? (
            <Check className="h-3.5 w-3.5 text-emerald-400 stroke-[3px]" />
          ) : (
            <X className="h-3.5 w-3.5 text-muted-foreground stroke-[3px]" />
          )}
          <span>包含数字 (0-9)</span>
        </li>
        <li className={`flex items-center gap-1.5 transition-colors duration-200 ${hasSpecial ? 'text-slate-700 dark:text-slate-300' : 'text-muted-foreground'}`}>
          {hasSpecial ? (
            <Check className="h-3.5 w-3.5 text-emerald-400 stroke-[3px]" />
          ) : (
            <X className="h-3.5 w-3.5 text-muted-foreground stroke-[3px]" />
          )}
          <span>包含特殊符号 (!@#$%^&*)</span>
        </li>
      </ul>
    </div>
  );
};

export default PasswordStrengthIndicator;

import React, { useState } from 'react';

/* ─────────────────── 共享内联样式常量 ─────────────────── */
export const S = {
  /* 通用输入框 */
  input: {
    height: 44,
    width: '100%',
    borderRadius: 10,
    border: '1.5px solid hsl(var(--border))',
    background: 'hsl(var(--card))',
    padding: '0 14px',
    fontSize: 14,
    fontWeight: 500,
    color: 'hsl(var(--foreground))',
    outline: 'none',
    transition: 'border-color .15s',
    boxSizing: 'border-box',
  },
  inputFocus: { borderColor: '#01875f' },
  inputDisabled: { background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' },

  /* 标签 */
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: 'hsl(var(--foreground))',
    marginBottom: 6,
  },
};

/* ─────────────────── Field 包装组件 ─────────────────── */
export const Field = ({ label, labelIcon, children, style }) => (
  <div style={{ display: 'flex', flexDirection: 'column', ...style }}>
    {label && (
      labelIcon
        ? <span style={{ ...S.label, display: 'flex', alignItems: 'center', gap: 5 }}>{labelIcon}{label}</span>
        : <span style={S.label}>{label}</span>
    )}
    {children}
  </div>
);

/* ─────────────────── FocusInput ─────────────────── */
const FocusInput = ({ style, ...props }) => {
  const [focused, setFocused] = useState(false);
  return (
    <input
      {...props}
      style={{
        ...S.input,
        ...(focused ? S.inputFocus : {}),
        ...(props.disabled ? S.inputDisabled : {}),
        ...style,
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
};

export default FocusInput;

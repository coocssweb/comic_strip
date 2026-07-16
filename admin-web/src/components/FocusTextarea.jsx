import React, { useState } from 'react';
import { S } from './FocusInput';

const FocusTextarea = ({ style, ...props }) => {
  const [focused, setFocused] = useState(false);
  return (
    <textarea
      {...props}
      style={{
        ...S.input,
        height: 'auto',
        padding: '10px 14px',
        resize: 'none',
        fontFamily: 'inherit',
        lineHeight: 1.6,
        ...(focused ? S.inputFocus : {}),
        ...(props.disabled ? S.inputDisabled : {}),
        ...style,
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
};

export default FocusTextarea;

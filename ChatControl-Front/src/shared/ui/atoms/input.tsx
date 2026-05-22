import type { InputHTMLAttributes } from 'react';

type AppInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export function AppInput({ label, style, ...props }: AppInputProps) {
  return (
    <label style={{ display: 'block', fontSize: '0.9rem' }}>
      {label && <span style={{ display: 'block', marginBottom: '0.35rem' }}>{label}</span>}
      <input
        {...props}
        style={{
          width: '100%',
          padding: '0.5rem',
          border: '1px solid #d1d5db',
          borderRadius: 8,
          ...style,
        }}
      />
    </label>
  );
}

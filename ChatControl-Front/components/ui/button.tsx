import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

type AppButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children: ReactNode;
};

const variantStyles: Record<ButtonVariant, CSSProperties> = {
  primary: { background: '#1a73e8', color: '#fff', border: '1px solid #1a73e8' },
  secondary: { background: '#fff', color: '#1f2937', border: '1px solid #d1d5db' },
  danger: { background: '#b91c1c', color: '#fff', border: '1px solid #b91c1c' },
  ghost: { background: 'transparent', color: '#1f2937', border: '1px solid #d1d5db' },
};

export function AppButton({
  variant = 'secondary',
  style,
  children,
  disabled,
  ...props
}: AppButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled}
      style={{
        borderRadius: 8,
        padding: '0.5rem 0.75rem',
        fontSize: '0.9rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.65 : 1,
        ...variantStyles[variant],
        ...style,
      }}
    >
      {children}
    </button>
  );
}

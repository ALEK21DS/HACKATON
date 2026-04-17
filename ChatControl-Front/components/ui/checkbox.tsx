import type { InputHTMLAttributes } from 'react';

type AppCheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
};

export function AppCheckbox({ label, ...props }: AppCheckboxProps) {
  return (
    <label style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.9rem' }}>
      <input {...props} type="checkbox" />
      {label}
    </label>
  );
}

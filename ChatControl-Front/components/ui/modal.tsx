import type { ReactNode } from 'react';
import { AppButton } from './button';

type AppModalProps = {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function AppModal({ isOpen, title, onClose, children }: AppModalProps) {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(720px, 100%)',
          background: '#fff',
          borderRadius: 12,
          padding: '1rem',
          border: '1px solid #ddd',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>{title}</h2>
          <AppButton type="button" onClick={onClose}>
            Cerrar
          </AppButton>
        </div>
        {children}
      </div>
    </div>
  );
}

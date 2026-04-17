import { AppButton } from '@/components/ui/button';
import { AppInput } from '@/components/ui/input';

export type FirstAdminDraft = { email: string; password: string; displayName: string };

type FirstAdminFormProps = {
  draft: FirstAdminDraft;
  onChange: (patch: Partial<FirstAdminDraft>) => void;
  onSubmit: () => void;
};

export function FirstAdminForm({ draft, onChange, onSubmit }: FirstAdminFormProps) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
      <AppInput
        type="email"
        value={draft.email}
        onChange={(e) => onChange({ email: e.target.value })}
        placeholder="Correo del admin"
        style={{ flex: '1 1 220px' }}
      />
      <AppInput
        type="password"
        value={draft.password}
        onChange={(e) => onChange({ password: e.target.value })}
        placeholder="Contraseña (mín. 6)"
        minLength={6}
        style={{ flex: '1 1 180px' }}
      />
      <AppInput
        value={draft.displayName}
        onChange={(e) => onChange({ displayName: e.target.value })}
        placeholder="Nombre visible (opcional)"
        style={{ flex: '1 1 180px' }}
      />
      <AppButton type="button" variant="primary" onClick={onSubmit}>
        Guardar acceso
      </AppButton>
    </div>
  );
}

import { AppButton } from '@/components/ui/button';
import { AppCheckbox } from '@/components/ui/checkbox';
import { AppInput } from '@/components/ui/input';
import { AppModal } from '@/components/ui/modal';
import type { FormEvent } from 'react';

type OrganizationFormModalProps = {
  isOpen: boolean;
  name: string;
  adminEmail: string;
  adminPassword: string;
  adminDisplayName: string;
  includeAdminOnCreate: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  onNameChange: (value: string) => void;
  onIncludeAdminChange: (checked: boolean) => void;
  onAdminEmailChange: (value: string) => void;
  onAdminPasswordChange: (value: string) => void;
  onAdminDisplayNameChange: (value: string) => void;
};

export function OrganizationFormModal({
  isOpen,
  name,
  adminEmail,
  adminPassword,
  adminDisplayName,
  includeAdminOnCreate,
  onClose,
  onSubmit,
  onNameChange,
  onIncludeAdminChange,
  onAdminEmailChange,
  onAdminPasswordChange,
  onAdminDisplayNameChange,
}: OrganizationFormModalProps) {
  return (
    <AppModal isOpen={isOpen} title="Agregar empresa" onClose={onClose}>
      <form onSubmit={onSubmit} style={{ marginTop: '0.75rem' }}>
        <div style={{ marginBottom: '0.75rem' }}>
          <AppInput
            label="Nombre de empresa"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Ej: Acme S.A.S."
            required
          />
        </div>

        <div style={{ marginBottom: '0.75rem' }}>
          <AppCheckbox
            checked={includeAdminOnCreate}
            onChange={(e) => onIncludeAdminChange(e.target.checked)}
            label="Crear usuario admin ahora"
          />
        </div>

        {includeAdminOnCreate && (
          <div
            style={{
              border: '1px solid #eee',
              borderRadius: 8,
              padding: '0.75rem',
              marginBottom: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              <AppInput
                type="email"
                value={adminEmail}
                onChange={(e) => onAdminEmailChange(e.target.value)}
                placeholder="Correo del admin"
                style={{ flex: '1 1 220px' }}
              />
              <AppInput
                type="password"
                value={adminPassword}
                onChange={(e) => onAdminPasswordChange(e.target.value)}
                placeholder="Contraseña (mín. 6)"
                minLength={6}
                style={{ flex: '1 1 180px' }}
              />
              <AppInput
                value={adminDisplayName}
                onChange={(e) => onAdminDisplayNameChange(e.target.value)}
                placeholder="Nombre visible (opcional)"
                style={{ flex: '1 1 180px' }}
              />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <AppButton type="button" onClick={onClose}>
            Cancelar
          </AppButton>
          <AppButton type="submit" variant="primary">
            Crear empresa
          </AppButton>
        </div>
      </form>
    </AppModal>
  );
}

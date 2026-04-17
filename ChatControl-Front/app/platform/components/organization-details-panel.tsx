import type { PlatformOrganization } from '@/lib/api';
import { AppButton } from '@/components/ui/button';
import { AppModal } from '@/components/ui/modal';
import { FirstAdminForm, type FirstAdminDraft } from './first-admin-form';

type OrganizationDetailsPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  organization: PlatformOrganization;
  draft: FirstAdminDraft;
  onDraftChange: (patch: Partial<FirstAdminDraft>) => void;
  onCreateFirstAdmin: () => void;
  onToggleStatus: () => void;
};

export function OrganizationDetailsPanel({
  isOpen,
  onClose,
  organization,
  draft,
  onDraftChange,
  onCreateFirstAdmin,
  onToggleStatus,
}: OrganizationDetailsPanelProps) {
  return (
    <AppModal isOpen={isOpen} title="Detalle de empresa" onClose={onClose}>
      <div style={{ marginTop: '0.85rem' }}>
        <p style={{ margin: 0, fontWeight: 700 }}>{organization.name}</p>
        <p style={{ marginTop: '0.35rem', color: '#555', fontSize: '0.9rem' }}>
          Estado: {organization.status} · Usuarios: {organization._count.users} · Contactos:{' '}
          {organization._count.contacts}
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
          <AppButton type="button" onClick={onToggleStatus}>
            {organization.status === 'ACTIVE' ? 'Suspender empresa' : 'Activar empresa'}
          </AppButton>
        </div>
        <p style={{ marginTop: '0.5rem', color: '#555', fontSize: '0.88rem' }}>
          Las integraciones (tokens/API keys) se configuran iniciando sesion con un usuario{' '}
          <strong>ORG_ADMIN</strong> de esta empresa, en la ruta <code>/org/integrations</code>.
        </p>

        {organization._count.users === 0 && (
          <div style={{ marginTop: '1rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
            <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Crear primer admin</h3>
            <FirstAdminForm draft={draft} onChange={onDraftChange} onSubmit={onCreateFirstAdmin} />
          </div>
        )}
      </div>
    </AppModal>
  );
}

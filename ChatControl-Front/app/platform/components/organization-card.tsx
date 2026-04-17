import type { PlatformOrganization } from '@/lib/api';

type OrganizationCardProps = {
  organization: PlatformOrganization;
  isActive: boolean;
  onSelect: () => void;
};

export function OrganizationCard({ organization, isActive, onSelect }: OrganizationCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        textAlign: 'left',
        border: isActive ? '2px solid #1a73e8' : '1px solid #ddd',
        borderRadius: 10,
        background: '#fff',
        padding: '1rem 1.1rem',
        cursor: 'pointer',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div>
          <strong style={{ fontSize: '1.02rem' }}>{organization.name}</strong>
          <div style={{ fontSize: '0.85rem', color: '#555', marginTop: '0.4rem' }}>
            Usuarios: {organization._count.users} · Contactos: {organization._count.contacts}
          </div>
          {organization.whatsappPhoneNumberId && (
            <div style={{ fontSize: '0.78rem', color: '#666', marginTop: '0.35rem' }}>
              phone_number_id: {organization.whatsappPhoneNumberId}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.78rem', color: organization.status === 'ACTIVE' ? '#0a7b34' : '#a23' }}>
            {organization.status}
          </span>
          <div style={{ fontSize: '0.78rem', color: '#666', marginTop: '0.4rem' }}>Ver detalles</div>
        </div>
      </div>
    </button>
  );
}

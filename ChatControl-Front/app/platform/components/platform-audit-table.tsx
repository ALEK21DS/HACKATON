import type { PlatformAuditLogRow, PlatformOrganization } from '@/lib/api';

type PlatformAuditTableProps = {
  audit: PlatformAuditLogRow[];
  organizations: PlatformOrganization[];
  selectedOrgId: string;
  onChangeOrganizationId: (value: string) => void;
};

export function PlatformAuditTable({
  audit,
  organizations,
  selectedOrgId,
  onChangeOrganizationId,
}: PlatformAuditTableProps) {
  return (
    <section>
      <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Auditoria de plataforma</h2>
      <label style={{ display: 'block', marginBottom: '1rem', fontSize: '0.9rem' }}>
        Filtrar por empresa afectada{' '}
        <select
          value={selectedOrgId}
          onChange={(e) => onChangeOrganizationId(e.target.value)}
          style={{ marginLeft: '0.5rem', padding: '0.35rem', minWidth: 220 }}
        >
          <option value="">Todas</option>
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: '0.45rem' }}>Fecha</th>
              <th style={{ padding: '0.45rem' }}>Accion</th>
              <th style={{ padding: '0.45rem' }}>Actor</th>
              <th style={{ padding: '0.45rem' }}>Empresa</th>
              <th style={{ padding: '0.45rem' }}>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {audit.map((a) => (
              <tr key={a.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.45rem', whiteSpace: 'nowrap' }}>
                  {new Date(a.createdAt).toLocaleString('es-ES')}
                </td>
                <td style={{ padding: '0.45rem' }}>{a.action}</td>
                <td style={{ padding: '0.45rem' }}>{a.actor.email}</td>
                <td style={{ padding: '0.45rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                  {a.targetOrganizationId || '—'}
                </td>
                <td style={{ padding: '0.45rem', maxWidth: 280 }}>
                  {a.metadata != null ? JSON.stringify(a.metadata) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {audit.length === 0 && <p style={{ marginTop: '0.75rem', color: '#666' }}>Sin registros.</p>}
    </section>
  );
}

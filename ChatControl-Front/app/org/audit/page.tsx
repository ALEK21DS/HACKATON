'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { isLoggedIn, getMe, getOrgAuditOutbound, type MeResponse, type OrgOutboundAuditRow } from '@/lib/api';
import { formatPhoneDisplay } from '@/lib/format';

export default function OrgAuditPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [rows, setRows] = useState<OrgOutboundAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login');
      return;
    }
    (async () => {
      try {
        const profile = await getMe();
        if (profile.role !== 'ORG_ADMIN') {
          router.replace('/chat');
          return;
        }
        setMe(profile);
        setRows(await getOrgAuditOutbound(100));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (loading) return <p style={{ padding: '2rem' }}>Cargando…</p>;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '2rem' }}>
      <p>
        <Link href="/chat">← Volver al chat</Link>
      </p>
      <h1 style={{ fontSize: '1.35rem' }}>Auditoría — mensajes salientes</h1>
      <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
        Admin: {me?.email}. Quién envió cada mensaje hacia el cliente (últimos 100).
      </p>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: '0.5rem' }}>Fecha</th>
              <th style={{ padding: '0.5rem' }}>Contacto</th>
              <th style={{ padding: '0.5rem' }}>Enviado por</th>
              <th style={{ padding: '0.5rem' }}>IA</th>
              <th style={{ padding: '0.5rem' }}>Vista previa</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>
                  {new Date(r.whatsappTimestamp).toLocaleString('es-ES')}
                </td>
                <td style={{ padding: '0.5rem' }}>
                  {r.contactName || formatPhoneDisplay(r.contactPhone)}
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>{formatPhoneDisplay(r.contactPhone)}</div>
                </td>
                <td style={{ padding: '0.5rem' }}>
                  {r.sentBy
                    ? r.sentBy.displayName || r.sentBy.email
                    : '(sistema / sin usuario)'}
                </td>
                <td style={{ padding: '0.5rem' }}>{r.fromAi ? 'Sí' : 'No'}</td>
                <td style={{ padding: '0.5rem', maxWidth: 320 }}>{r.bodyPreview}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && !error && <p style={{ marginTop: '1rem', color: '#666' }}>No hay mensajes salientes registrados.</p>}
    </div>
  );
}

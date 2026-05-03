'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  isLoggedIn,
  getMe,
  getOrgAuditOutbound,
  type OrgOutboundAuditRow,
} from '../../../../lib/api';
import styles from '../../chat/chat.module.css';
import broadcastStyles from '../../broadcast/broadcast.module.css';

export default function AuditPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<OrgOutboundAuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login');
      return;
    }
    (async () => {
      try {
        const profile = await getMe();
        if (profile.role !== 'ORG_ADMIN') {
          router.replace('/settings');
          return;
        }
        setLogs(await getOrgAuditOutbound());
      } catch {
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (loading) return <p className={styles.muted}>Cargando…</p>;

  return (
    <div className={broadcastStyles.broadcastMain}>
      <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Auditoría de Envíos</h3>
      <p className={styles.muted} style={{ marginBottom: '2rem', padding: 0 }}>
        Registro detallado de todos los mensajes enviados a través de la API y campañas masivas.
      </p>

      <div style={{ overflowX: 'auto', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(64,64,64,0.3)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.05)', color: '#EF4444' }}>
              <th style={{ padding: '1rem' }}>Fecha</th>
              <th style={{ padding: '1rem' }}>Destino</th>
              <th style={{ padding: '1rem' }}>Tipo</th>
              <th style={{ padding: '1rem' }}>Estado</th>
              <th style={{ padding: '1rem' }}>Usuario</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} style={{ borderBottom: '1px solid rgba(64,64,64,0.05)' }}>
                <td style={{ padding: '1rem', color: '#8C8C8C' }}>{new Date(l.whatsappTimestamp * 1000).toLocaleString()}</td>
                <td style={{ padding: '1rem', fontWeight: 600 }}>{l.contactPhone}</td>
                <td style={{ padding: '1rem' }}>
                   <span style={{ 
                     padding: '2px 8px', 
                     borderRadius: 4, 
                     background: l.fromAi ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                     color: l.fromAi ? '#34D399' : '#60A5FA',
                     fontSize: '0.7rem',
                     textTransform: 'uppercase',
                     fontWeight: 700
                   }}>
                     {l.fromAi ? 'IA' : 'Manual'}
                   </span>
                </td>
                <td style={{ padding: '1rem', fontSize: '0.8rem', color: '#666' }}>
                  {l.bodyPreview}
                </td>
                <td style={{ padding: '1rem', fontSize: '0.8rem' }}>{l.sentBy?.email || 'Sistema'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

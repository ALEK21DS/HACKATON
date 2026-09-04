'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  isLoggedIn,
  getCrmAuditLogs,
  getAssignmentAuditLogs,
  getBroadcastAuditLogs,
  type AssignmentLogEntry,
  type BroadcastLogEntry,
} from '@/lib/api';

type Tab = 'assignments' | 'broadcast' | 'crm';

interface CrmAuditEntry {
  id: string;
  action: string;
  crmUser: string | null;
  crmName: string | null;
  contactsTotal: number | null;
  contactsCreated: number | null;
  contactsUpdated: number | null;
  contactsRejected: number | null;
  listName: string | null;
  createdAt: string;
}

function subNavStyle(active: boolean): React.CSSProperties {
  return {
    padding: '0.5rem 0.875rem',
    borderRadius: 8,
    background: active ? '#EF4444' : 'rgba(255,255,255,0.03)',
    color: active ? 'white' : '#8C8C8C',
    fontSize: '0.65rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    textDecoration: 'none',
  };
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: '0.6rem 1.2rem',
    borderRadius: 10,
    background: active ? '#EF4444' : 'rgba(255,255,255,0.03)',
    border: active ? 'none' : '1px solid rgba(255,255,255,0.05)',
    color: active ? 'white' : '#8C8C8C',
    fontSize: '0.75rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    cursor: 'pointer',
    transition: 'all 0.2s',
  };
}

export default function AuditPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('assignments');
  const [assignments, setAssignments] = useState<AssignmentLogEntry[]>([]);
  const [broadcastLogs, setBroadcastLogs] = useState<BroadcastLogEntry[]>([]);
  const [crmLogs, setCrmLogs] = useState<CrmAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace('/login'); return; }
    (async () => {
      setLoading(true);
      try {
        const [a, b, c] = await Promise.all([
          getAssignmentAuditLogs(),
          getBroadcastAuditLogs(),
          getCrmAuditLogs(),
        ]);
        setAssignments(a);
        setBroadcastLogs(b);
        setCrmLogs(c.logs || c);
      } catch {
        // fallback
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  return (
    <div style={{ padding: '2rem', color: '#F2F2F2', minHeight: '100vh', background: '#040404' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <Link href="/broadcast" style={subNavStyle(false)}>Campañas</Link>
            <Link href="/templates" style={subNavStyle(false)}>Templates</Link>
            <Link href="/broadcast/crm-lists" style={subNavStyle(false)}>Listas CRM</Link>
            <Link href="/broadcast/audit" style={subNavStyle(true)}>Auditoría</Link>
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, margin: 0 }}>Auditoría</h1>
          <p style={{ color: '#666', marginTop: '0.5rem' }}>
            Historial de asignaciones, envíos masivos y eventos CRM.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <button onClick={() => setTab('assignments')} style={tabStyle(tab === 'assignments')}>
            Asignaciones
          </button>
          <button onClick={() => setTab('broadcast')} style={tabStyle(tab === 'broadcast')}>
            Broadcast
          </button>
          <button onClick={() => setTab('crm')} style={tabStyle(tab === 'crm')}>
            CRM
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#666' }}>Cargando...</div>
        ) : (
          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, overflow: 'hidden' }}>
            
            {/* Assignments Tab */}
            {tab === 'assignments' && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }}>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', fontSize: '0.65rem' }}>Conversación</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', fontSize: '0.65rem' }}>De</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', fontSize: '0.65rem' }}>A</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', fontSize: '0.65rem' }}>Reasignado por</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', fontSize: '0.65rem' }}>Razón</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', fontSize: '0.65rem' }}>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.length === 0 ? (
                      <tr><td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#444' }}>Sin registros de asignación.</td></tr>
                    ) : assignments.map((entry) => {
                      const fromName = (entry as any).fromUser?.displayName || (entry as any).fromUser?.email || entry.fromUserId || '-';
                      const toName = (entry as any).toUser?.displayName || (entry as any).toUser?.email || entry.toUserId || '-';
                      const byName = (entry as any).reassignedBy?.displayName || (entry as any).reassignedBy?.email || entry.reassignedByUserId;
                      const reasonLabel = entry.reason === 'user_deactivated' ? 'Desactivación' : entry.reason === 'user_deleted' ? 'Eliminación' : entry.reason === 'manual' ? 'Manual' : entry.reason;
                      return (
                        <tr key={entry.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '0.75rem 1rem', color: '#666', fontFamily: 'monospace', fontSize: '0.7rem' }}>{entry.conversationId.slice(0, 8)}...</td>
                          <td style={{ padding: '0.75rem 1rem', color: '#F2F2F2' }}>{fromName}</td>
                          <td style={{ padding: '0.75rem 1rem', color: '#F2F2F2' }}>{toName}</td>
                          <td style={{ padding: '0.75rem 1rem', color: '#8C8C8C' }}>{byName}</td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: 4, background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }}>{reasonLabel}</span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#666', fontSize: '0.75rem' }}>{new Date(entry.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Broadcast Tab */}
            {tab === 'broadcast' && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }}>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', fontSize: '0.65rem' }}>Conversación</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', fontSize: '0.65rem' }}>Tipo</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', fontSize: '0.65rem' }}>Estado</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', fontSize: '0.65rem' }}>Error</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', fontSize: '0.65rem' }}>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {broadcastLogs.length === 0 ? (
                      <tr><td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: '#444' }}>Sin registros de envíos masivos.</td></tr>
                    ) : broadcastLogs.map((entry) => (
                      <tr key={entry.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '0.75rem 1rem', color: '#666', fontFamily: 'monospace', fontSize: '0.7rem' }}>{entry.conversationId.slice(0, 8)}...</td>
                        <td style={{ padding: '0.75rem 1rem', color: '#F2F2F2' }}>{entry.type}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: 4, background: entry.status === 'sent' ? 'rgba(74, 222, 128, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: entry.status === 'sent' ? '#4ADE80' : '#EF4444' }}>
                            {entry.status === 'sent' ? 'Enviado' : 'Fallido'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#EF4444', fontSize: '0.75rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.errorMessage || '-'}</td>
                        <td style={{ padding: '0.75rem 1rem', color: '#666', fontSize: '0.75rem' }}>{new Date(entry.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* CRM Tab */}
            {tab === 'crm' && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }}>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', fontSize: '0.65rem' }}>Acción</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', fontSize: '0.65rem' }}>Usuario CRM</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', fontSize: '0.65rem' }}>Lista</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', fontSize: '0.65rem' }}>Contactos</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', fontSize: '0.65rem' }}>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crmLogs.length === 0 ? (
                      <tr><td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: '#444' }}>Sin registros CRM.</td></tr>
                    ) : crmLogs.map((entry) => {
                      const actionLabel = entry.action === 'contacts_exported' ? 'Exportación' : entry.action === 'list_created' ? 'Lista creada' : entry.action === 'connection_verified' ? 'Conexión verificada' : entry.action;
                      return (
                        <tr key={entry.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: 4, background: 'rgba(59, 130, 246, 0.1)', color: '#60A5FA' }}>{actionLabel}</span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#F2F2F2' }}>{entry.crmUser || entry.crmName || '-'}</td>
                          <td style={{ padding: '0.75rem 1rem', color: '#8C8C8C' }}>{entry.listName || '-'}</td>
                          <td style={{ padding: '0.75rem 1rem', color: '#666' }}>
                            {entry.contactsTotal != null ? `${entry.contactsTotal} total` : ''}
                            {entry.contactsCreated != null ? `, ${entry.contactsCreated} creados` : ''}
                            {entry.contactsUpdated != null ? `, ${entry.contactsUpdated} actualizados` : ''}
                            {entry.contactsRejected != null ? `, ${entry.contactsRejected} rechazados` : ''}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#666', fontSize: '0.75rem' }}>{new Date(entry.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

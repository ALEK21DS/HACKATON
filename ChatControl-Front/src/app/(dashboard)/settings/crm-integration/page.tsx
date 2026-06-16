'use client';

import { useEffect, useState } from 'react';
import {
  getCrmCode,
  regenerateCrmCode,
  getCrmStatus,
  getCrmAuditLogs,
  type CrmIntegrationStatus,
} from '@/lib/api';

export default function CrmIntegrationPage() {
  const [status, setStatus] = useState<CrmIntegrationStatus | null>(null);
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [s, c] = await Promise.all([getCrmStatus(), getCrmCode()]);
        setStatus(s);
        setCode(c.codigoVinculacion);
      } catch {
        setStatus(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const result = await regenerateCrmCode();
      setCode(result.codigoVinculacion);
      setShowCode(true);
      setCopied(false);
    } catch (err) {
      console.error('Error regenerating code', err);
    } finally {
      setRegenerating(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const toggleLogs = async () => {
    setShowLogs((v) => !v);
    if (!showLogs && !logs.length) {
      try {
        const res = await getCrmAuditLogs();
        setLogs(res.logs);
      } catch {}
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666' }}>
        <div className="pulse-heartbeat" style={{ textAlign: 'center' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="#EF4444" style={{ margin: '0 auto 1rem' }}>
            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <p style={{ fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em' }}>Cargando</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#F2F2F2', margin: '0 0 0.5rem' }}>
          Integración CRM
        </h1>
        <p style={{ color: '#8C8C8C', fontSize: '0.85rem', margin: 0 }}>
          Vincula tu CRM externo para exportar contactos y enviar campañas masivas de WhatsApp.
        </p>
      </div>

      {/* Status */}
      <div style={{
        borderRadius: '20px', padding: '1.5rem', marginBottom: '1.5rem',
        background: status?.connected ? 'rgba(34, 197, 94, 0.06)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${status?.connected ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.06)'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '14px',
            background: status?.connected ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255,255,255,0.03)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={status?.connected ? '#22c55e' : '#666'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {status?.connected ? (
                <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></>
              ) : (
                <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/><line x1="2" y1="2" x2="22" y2="22"/></>
              )}
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: status?.connected ? '#22c55e' : '#F2F2F2' }}>
              {status?.connected ? 'Conectado' : 'Sin conexión'}
            </div>
            {status?.crmName && (
              <div style={{ fontSize: '0.75rem', color: '#8C8C8C', marginTop: '0.15rem' }}>
                CRM: {status.crmName}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Code section */}
      <div style={{ borderRadius: '20px', padding: '1.5rem', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <h2 style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#8C8C8C', margin: '0 0 1rem' }}>
          Código de Vinculación
        </h2>
        <p style={{ fontSize: '0.8rem', color: '#8C8C8C', margin: '0 0 1rem', lineHeight: 1.5 }}>
          Comparte este código con tu CRM para establecer la conexión. El código es de un solo uso y se regenera al vincular.
        </p>

        {code && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.75rem 1rem', borderRadius: '12px',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '1rem',
          }}>
            <code style={{
              flex: 1, fontSize: '1.1rem', fontWeight: 800, color: '#F2F2F2',
              fontFamily: 'monospace', letterSpacing: '0.15em',
            }}>
              {showCode ? code : code.slice(0, 8) + '••••••••••'}
            </code>
            <button onClick={() => setShowCode(!showCode)}
              style={{ background: 'none', border: 'none', color: '#8C8C8C', cursor: 'pointer', padding: '0.25rem' }}
              title={showCode ? 'Ocultar código' : 'Mostrar código'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {showCode ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="2" y1="2" x2="22" y2="22"/></> : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}
              </svg>
            </button>
            <button onClick={handleCopyCode}
              style={{ background: 'none', border: 'none', color: copied ? '#22c55e' : '#8C8C8C', cursor: 'pointer', padding: '0.25rem' }}
              title={copied ? 'Copiado!' : 'Copiar código'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
          </div>
        )}

        {!code ? (
          <button onClick={handleRegenerate} disabled={regenerating}
            style={{
              padding: '0.75rem 1.5rem', borderRadius: '12px', border: 'none',
              background: '#EF4444', color: 'white', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(239, 68, 68, 0.25)',
            }}
          >
            {regenerating ? 'Generando...' : 'Generar Código'}
          </button>
        ) : (
          <button onClick={handleRegenerate} disabled={regenerating}
            style={{
              padding: '0.6rem 1.25rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.03)', color: '#8C8C8C', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
            }}
          >
            {regenerating ? '...' : 'Regenerar código'}
          </button>
        )}
      </div>

      {/* Audit logs */}
      <div style={{ borderRadius: '20px', padding: '1.5rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div onClick={toggleLogs} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8C8C8C" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#8C8C8C' }}>
              Historial de Exportaciones
            </span>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8C8C8C" strokeWidth="2" style={{ transform: showLogs ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>

        {showLogs && (
          <div style={{ marginTop: '1rem' }}>
            {logs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#8C8C8C', fontSize: '0.8rem' }}>
                Sin exportaciones registradas
              </div>
            ) : (
              logs.map((log: any) => (
                <div key={log.id} style={{
                  padding: '0.75rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#F2F2F2' }}>
                      {log.listName || log.action}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#8C8C8C' }}>
                      {log.contactsTotal} contactos · {log.contactsCreated} nuevos · {log.contactsUpdated} actualizados
                      {log.crmUser && ` · por ${log.crmUser}`}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#666', flexShrink: 0 }}>
                    {log.createdAt ? new Date(log.createdAt).toLocaleDateString() : ''}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <style jsx global>{`
        .pulse-heartbeat {
          animation: heartbeat 1.5s ease-in-out infinite;
        }
        @keyframes heartbeat {
          0% { transform: scale(0.9); opacity: 0.4; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(0.9); opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  isLoggedIn,
  getBroadcastRuns,
  getBroadcastRunContacts,
  type BroadcastRun,
  type BroadcastRunContact,
} from '@/lib/api';

const PAGE_SIZE = 20;
const DETAIL_PAGE_SIZE = 25;

const TYPE_LABELS: Record<string, string> = {
  manual: 'Texto Libre',
  template: 'Plantilla',
  ia: 'Asistente IA',
};

const REASON_FILTERS: Array<{ value: string | null; label: string }> = [
  { value: null, label: 'Todos' },
  { value: 'SPAM_BLOCKED', label: 'Spam' },
  { value: 'META_EXPERIMENT', label: 'Experimento' },
  { value: 'NO_WHATSAPP', label: 'Sin WhatsApp' },
  { value: 'OUT_OF_WINDOW', label: 'Fuera de ventana' },
  { value: 'SANDBOX_BLOCKED', label: 'Sandbox' },
  { value: 'OTHER', label: 'Plataforma/Conexión' },
];

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

function pillStyle(active: boolean): React.CSSProperties {
  return {
    padding: '0.4rem 0.8rem',
    borderRadius: 8,
    background: active ? '#EF4444' : 'rgba(255,255,255,0.03)',
    border: active ? 'none' : '1px solid rgba(255,255,255,0.05)',
    color: active ? 'white' : '#8C8C8C',
    fontSize: '0.65rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function sheetSafeName(name: string): string {
  return name.replace(/[\\/*?:[\]]/g, '').slice(0, 31) || 'Hoja';
}

export default function SentBroadcastsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [runs, setRuns] = useState<BroadcastRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [selectedRun, setSelectedRun] = useState<BroadcastRun | null>(null);
  const [modalTab, setModalTab] = useState<'sent' | 'failed'>('sent');
  const [sentContacts, setSentContacts] = useState<BroadcastRunContact[]>([]);
  const [failedContacts, setFailedContacts] = useState<BroadcastRunContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [reasonFilter, setReasonFilter] = useState<string | null>(null);
  const [detailPage, setDetailPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!isLoggedIn()) { router.replace('/login'); return; }
    (async () => {
      setLoading(true);
      try {
        const data = await getBroadcastRuns();
        setRuns(data);
      } catch {
        setRuns([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [mounted, router]);

  const totalPages = Math.max(1, Math.ceil(runs.length / PAGE_SIZE));
  const pageRuns = runs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openDetails = async (run: BroadcastRun) => {
    setSelectedRun(run);
    setModalTab('sent');
    setReasonFilter(null);
    setDetailPage(1);
    setSentContacts([]);
    setFailedContacts([]);
    setLoadingContacts(true);
    try {
      const [sentData, failedData] = await Promise.all([
        getBroadcastRunContacts(run.runId, 'sent'),
        getBroadcastRunContacts(run.runId, 'failed'),
      ]);
      setSentContacts(sentData);
      setFailedContacts(failedData);
    } catch {
      setSentContacts([]);
      setFailedContacts([]);
    } finally {
      setLoadingContacts(false);
    }
  };

  const closeDetails = () => setSelectedRun(null);

  const filteredFailedContacts = useMemo(
    () => (reasonFilter ? failedContacts.filter((c) => c.failureCategory === reasonFilter) : failedContacts),
    [failedContacts, reasonFilter],
  );

  const activeList = modalTab === 'sent' ? sentContacts : filteredFailedContacts;
  const detailTotalPages = Math.max(1, Math.ceil(activeList.length / DETAIL_PAGE_SIZE));
  const detailPageItems = activeList.slice((detailPage - 1) * DETAIL_PAGE_SIZE, detailPage * DETAIL_PAGE_SIZE);

  const reasonCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of failedContacts) {
      const key = c.failureCategory || 'OTHER';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [failedContacts]);

  const handleExportSent = async () => {
    if (!selectedRun || sentContacts.length === 0) return;
    setExporting(true);
    try {
      const XLSX = await import('xlsx');
      const data = [
        ['Nombre', 'Número', 'Hora'],
        ...sentContacts.map((c) => [c.name || '(sin nombre)', c.phone, formatDate(c.createdAt)]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 20 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Enviados');
      XLSX.writeFile(wb, `masivo_enviados_${selectedRun.runId.slice(0, 8)}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  const handleExportFailed = async () => {
    if (!selectedRun || filteredFailedContacts.length === 0) return;
    setExporting(true);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      const header = ['Nombre', 'Número', 'Motivo', 'Detalle', 'Hora'];
      const toRow = (c: BroadcastRunContact) => [
        c.name || '(sin nombre)',
        c.phone,
        c.failureLabel || 'Sin categorizar',
        c.errorMessage || '',
        formatDate(c.createdAt),
      ];
      const cols = [{ wch: 30 }, { wch: 16 }, { wch: 20 }, { wch: 45 }, { wch: 20 }];

      if (reasonFilter) {
        const ws = XLSX.utils.aoa_to_sheet([header, ...filteredFailedContacts.map(toRow)]);
        ws['!cols'] = cols;
        XLSX.utils.book_append_sheet(wb, ws, sheetSafeName(filteredFailedContacts[0]?.failureLabel || 'Fallidos'));
      } else {
        const byReason = new Map<string, BroadcastRunContact[]>();
        for (const c of failedContacts) {
          const key = c.failureLabel || 'Sin categorizar';
          (byReason.get(key) ?? byReason.set(key, []).get(key)!).push(c);
        }
        for (const [reason, contacts] of Array.from(byReason.entries())) {
          const ws = XLSX.utils.aoa_to_sheet([header, ...contacts.map(toRow)]);
          ws['!cols'] = cols;
          XLSX.utils.book_append_sheet(wb, ws, sheetSafeName(reason));
        }
      }
      XLSX.writeFile(wb, `masivo_fallidos_${selectedRun.runId.slice(0, 8)}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  if (!mounted) return null;

  return (
    <div style={{ padding: '2rem', color: '#F2F2F2', minHeight: '100vh', background: '#040404' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <Link href="/broadcast" style={subNavStyle(false)}>Campañas</Link>
            <Link href="/templates" style={subNavStyle(false)}>Templates</Link>
            <Link href="/broadcast/crm-lists" style={subNavStyle(false)}>Listas CRM</Link>
            <Link href="/broadcast/sent" style={subNavStyle(true)}>Enviados</Link>
            <Link href="/broadcast/audit" style={subNavStyle(false)}>Auditoría</Link>
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, margin: 0 }}>Masivos Enviados</h1>
          <p style={{ color: '#666', marginTop: '0.5rem' }}>
            Historial de envíos masivos, uno por cada vez que se lanzó una campaña.
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#666' }}>Cargando...</div>
        ) : runs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#444', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12 }}>
            Todavía no hay envíos masivos registrados con este módulo.
          </div>
        ) : (
          <>
            <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }}>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', fontSize: '0.65rem' }}>Fecha y hora</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', fontSize: '0.65rem' }}>Tipo</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', fontSize: '0.65rem' }}>Enviados</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', fontSize: '0.65rem' }}>Fallidos</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', fontSize: '0.65rem' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRuns.map((run) => (
                      <tr key={run.runId} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '0.75rem 1rem', color: '#F2F2F2' }}>{formatDate(run.startedAt)}</td>
                        <td style={{ padding: '0.75rem 1rem', color: '#8C8C8C' }}>{TYPE_LABELS[run.type] || run.type}</td>
                        <td style={{ padding: '0.75rem 1rem', color: '#4ADE80', fontWeight: 700 }}>{run.sent}</td>
                        <td style={{ padding: '0.75rem 1rem', color: run.failed > 0 ? '#EF4444' : '#444', fontWeight: 700 }}>{run.failed}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <button onClick={() => openDetails(run)} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', padding: '0.4rem 0.9rem', borderRadius: 8, fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer' }}>
                            Ver detalles
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.25rem' }}>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', color: page === 1 ? '#444' : '#F2F2F2', padding: '0.5rem 1rem', borderRadius: 8, cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: '0.75rem' }}>
                  Anterior
                </button>
                <span style={{ fontSize: '0.75rem', color: '#8C8C8C' }}>Página {page} de {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', color: page === totalPages ? '#444' : '#F2F2F2', padding: '0.5rem 1rem', borderRadius: 8, cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: '0.75rem' }}>
                  Siguiente
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {selectedRun && (
        <div
          onClick={closeDetails}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '1.75rem', width: '100%', maxWidth: 780, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900 }}>Detalle del envío</h3>
                <p style={{ margin: '0.2rem 0 0', color: '#666', fontSize: '0.75rem' }}>{formatDate(selectedRun.startedAt)} · {TYPE_LABELS[selectedRun.type] || selectedRun.type}</p>
              </div>
              <button onClick={closeDetails} style={{ background: 'none', border: 'none', color: '#8C8C8C', cursor: 'pointer', fontSize: '1.3rem' }}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <button onClick={() => { setModalTab('sent'); setDetailPage(1); }} style={tabStyle(modalTab === 'sent')}>
                Enviados ({sentContacts.length})
              </button>
              <button onClick={() => { setModalTab('failed'); setDetailPage(1); }} style={tabStyle(modalTab === 'failed')}>
                Fallidos ({failedContacts.length})
              </button>
            </div>

            {modalTab === 'failed' && (
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                {REASON_FILTERS.map((f) => {
                  const count = f.value ? reasonCounts.get(f.value) ?? 0 : failedContacts.length;
                  if (f.value && count === 0) return null;
                  return (
                    <button
                      key={f.label}
                      onClick={() => { setReasonFilter(f.value); setDetailPage(1); }}
                      style={pillStyle(reasonFilter === f.value)}
                    >
                      {f.label} ({count})
                    </button>
                  );
                })}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
              <button
                onClick={modalTab === 'sent' ? handleExportSent : handleExportFailed}
                disabled={exporting || activeList.length === 0}
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: activeList.length === 0 ? '#444' : '#8C8C8C', padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', cursor: activeList.length === 0 ? 'not-allowed' : 'pointer' }}
              >
                {exporting ? 'Exportando...' : 'Exportar Excel'}
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10 }}>
              {loadingContacts ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#666' }}>Cargando...</div>
              ) : detailPageItems.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#444' }}>Sin contactos en esta categoría.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <th style={{ padding: '0.65rem 0.9rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', fontSize: '0.6rem' }}>Nombre</th>
                      <th style={{ padding: '0.65rem 0.9rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', fontSize: '0.6rem' }}>Número</th>
                      {modalTab === 'failed' && (
                        <th style={{ padding: '0.65rem 0.9rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', fontSize: '0.6rem' }}>Motivo</th>
                      )}
                      <th style={{ padding: '0.65rem 0.9rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', fontSize: '0.6rem' }}>Hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailPageItems.map((c, i) => (
                      <tr key={`${c.phone}-${i}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '0.65rem 0.9rem', color: '#F2F2F2' }}>{c.name || '(sin nombre)'}</td>
                        <td style={{ padding: '0.65rem 0.9rem', color: '#8C8C8C' }}>{c.phone}</td>
                        {modalTab === 'failed' && (
                          <td style={{ padding: '0.65rem 0.9rem' }}>
                            <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: 4, background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                              {c.failureLabel || 'Sin categorizar'}
                            </span>
                          </td>
                        )}
                        <td style={{ padding: '0.65rem 0.9rem', color: '#666', fontSize: '0.7rem' }}>{formatDate(c.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {detailTotalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '0.75rem' }}>
                <button onClick={() => setDetailPage((p) => Math.max(1, p - 1))} disabled={detailPage === 1} style={{ background: 'rgba(255,255,255,0.03)', border: 'none', color: detailPage === 1 ? '#444' : '#F2F2F2', padding: '0.4rem 0.8rem', borderRadius: 6, cursor: detailPage === 1 ? 'not-allowed' : 'pointer', fontSize: '0.7rem' }}>
                  Anterior
                </button>
                <span style={{ fontSize: '0.7rem', color: '#8C8C8C' }}>{detailPage} / {detailTotalPages}</span>
                <button onClick={() => setDetailPage((p) => Math.min(detailTotalPages, p + 1))} disabled={detailPage === detailTotalPages} style={{ background: 'rgba(255,255,255,0.03)', border: 'none', color: detailPage === detailTotalPages ? '#444' : '#F2F2F2', padding: '0.4rem 0.8rem', borderRadius: 6, cursor: detailPage === detailTotalPages ? 'not-allowed' : 'pointer', fontSize: '0.7rem' }}>
                  Siguiente
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

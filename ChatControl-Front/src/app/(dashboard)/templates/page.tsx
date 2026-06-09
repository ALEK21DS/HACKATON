'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  isLoggedIn,
  getMe,
  getTemplatesFromMeta,
  type TemplateItem,
} from '@/lib/api';

// --- Icons ---
function TemplateIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg style={{ width: '1.2rem', height: '1.2rem', ...style }} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
    </svg>
  );
}

function RefreshIcon({ style, className }: { style?: React.CSSProperties, className?: string }) {
  return (
    <svg style={{ width: '1rem', height: '1rem', ...style }} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><polyline points="21 3 21 8 16 8" />
    </svg>
  );
}

function MetaIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg style={{ width: '1.2rem', height: '1.2rem', ...style }} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 5.01 3.657 9.167 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.167 22 17.01 22 12c0-5.523-4.477-10-10-10z"/>
    </svg>
  );
}

export default function TemplatesPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshingMeta, setRefreshingMeta] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!isLoggedIn()) { router.replace('/login'); return; }
    loadTemplates();
  }, [mounted, router]);

  async function loadTemplates() {
    setLoading(true);
    setError('');
    try {
      const metaList = await getTemplatesFromMeta();
      if (Array.isArray(metaList)) {
        setTemplates(metaList);
        if (metaList.length > 0 && !selectedId) setSelectedId(metaList[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al sincronizar con Meta');
    } finally {
      setLoading(false);
    }
  }

  async function refreshFromMeta() {
    setRefreshingMeta(true);
    setError('');
    try {
      const metaList = await getTemplatesFromMeta();
      if (Array.isArray(metaList)) {
        setTemplates(metaList);
        if (metaList.length > 0) setSelectedId(metaList[0].id);
      }
    } catch (err) {
      setError('No se pudo establecer conexión con Meta API.');
    } finally {
      setRefreshingMeta(false);
    }
  }

  const selectedTemplate = templates.find((t) => t.id === selectedId);

  // Helper para resaltar variables en el cuerpo
  const renderBodyWithHighlights = (body: string) => {
    const parts = body.split(/(\{\{\d+\}\})/g);
    return parts.map((part, i) => {
      if (part.match(/\{\{\d+\}\}/)) {
        return <span key={i} style={{ color: '#EF4444', fontWeight: 900, background: 'rgba(239, 68, 68, 0.1)', padding: '0 0.25rem', borderRadius: '4px' }}>{part}</span>;
      }
      return part;
    });
  };

  if (!mounted) return null;

  return (
    <div style={{ display: 'flex', width: '100%', height: '100vh', background: '#040404', color: '#F2F2F2', overflow: 'hidden' }}>
      
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      {/* ── Sidebar: Biblioteca ── */}
      <aside className={`aside-sidebar${sidebarOpen ? ' open' : ''}`}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em' }}>Plantillas</h2>
            <div style={{ padding: '0.4rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', color: '#EF4444' }}>
              <TemplateIcon />
            </div>
          </div>
          <button 
            onClick={refreshFromMeta}
            disabled={refreshingMeta}
            style={{ width: '100%', padding: '0.75rem', background: 'linear-gradient(135deg, #EF4444 0%, #991B1B 100%)', border: 'none', borderRadius: '12px', color: 'white', fontSize: '0.8rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 8px 15px rgba(239, 68, 68, 0.2)' }}
          >
            <RefreshIcon className={refreshingMeta ? 'spin' : ''} />
            {refreshingMeta ? 'Sincronizando...' : 'Refrescar Lista'}
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }} className="custom-scrollbar">
          {loading ? (
            <div style={{ padding: '4rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
              <div className="pulse-heartbeat">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="#EF4444">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#222', textTransform: 'uppercase', letterSpacing: '0.2em' }}>Accediendo a Meta</span>
            </div>
          ) : templates.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#444', fontSize: '0.85rem' }}>No se encontraron plantillas.</div>
          ) : (
            templates.map(t => (
              <button 
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                style={{ 
                  width: '100%', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', borderRadius: '16px', border: 'none', 
                  background: selectedId === t.id ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
                  cursor: 'pointer', transition: 'all 0.2s ease', textAlign: 'left', marginBottom: '0.25rem'
                }}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: selectedId === t.id ? '#EF4444' : '#444' }}>
                  <TemplateIcon style={{ width: '1rem', height: '1rem' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: selectedId === t.id ? 'white' : '#F2F2F2', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                    <span style={{ fontSize: '0.65rem', color: '#666', textTransform: 'uppercase', fontWeight: 800 }}>{t.language}</span>
                    <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#333' }}></div>
                    <span style={{ fontSize: '0.65rem', color: '#444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.body.slice(0, 30)}...</span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* ── Main: Visualización Maestra ── */}
      <main className="page-main custom-scrollbar">
        
        <div style={{ width: '100%', margin: '0' }}>
          
          {error && (
            <div style={{ padding: '1rem 1.5rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '16px', color: '#EF4444', fontSize: '0.85rem', fontWeight: 700, marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444', boxShadow: '0 0 10px #EF4444' }}></div>
              {error}
            </div>
          )}

          {selectedTemplate ? (
            <>
              {/* Contenido de la plantilla ya existente... */}
              <header style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                      <button 
                        onClick={() => setSidebarOpen(true)} 
                        className="mob-sidebar-btn"
                        aria-label="Abrir lista de plantillas"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                        </svg>
                      </button>
                      <h1 style={{ fontSize: '2rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em', margin: 0 }}>{selectedTemplate.name}</h1>
                    <div style={{ padding: '0.2rem 0.6rem', background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.2)', borderRadius: '6px', color: '#4ADE80', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase' }}>APROBADA</div>
                  </div>
                  <p style={{ color: '#666', fontSize: '0.95rem' }}>Estructura oficial sincronizada directamente desde el Business Manager de Meta.</p>
                </div>
                <div style={{ padding: '0.75rem', background: 'rgba(6, 104, 250, 0.1)', borderRadius: '12px', color: '#0668FA' }}>
                  <MetaIcon />
                </div>
              </header>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2.5rem' }}>
                <div style={{ background: '#080808', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '20px', padding: '1.5rem' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '0.5rem' }}>Idioma de Origen</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'white' }}>{selectedTemplate.language}</span>
                </div>
                <div style={{ background: '#080808', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '20px', padding: '1.5rem' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '0.5rem' }}>Estado en Meta</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#4ADE80' }}>Sincronizado</span>
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Cuerpo del Mensaje</label>
                  <div style={{ fontSize: '0.65rem', color: '#666', fontWeight: 700 }}>{selectedTemplate.variables.length} VARIABLES DETECTADAS</div>
                </div>
                <div style={{ 
                  width: '100%', minHeight: '150px', background: '#040404', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '2rem', 
                  color: '#F2F2F2', fontSize: '1.1rem', lineHeight: '1.8', whiteSpace: 'pre-wrap', fontFamily: 'inherit'
                }}>
                  {renderBodyWithHighlights(selectedTemplate.body)}
                </div>
                <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {selectedTemplate.variables.map(v => (
                    <div key={v} style={{ padding: '0.4rem 0.8rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', fontSize: '0.7rem', color: '#8C8C8C', fontWeight: 700 }}>
                      Variable: <span style={{ color: '#EF4444' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: '3rem', padding: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '1rem', opacity: 0.5 }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#666' }}>Esta es una vista de solo lectura. Las modificaciones de plantillas deben realizarse en el panel oficial de Meta.</span>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, height: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
              <Image src="/assets/images/NOIRLINE2.png" alt="Nextline" width={120} height={120} style={{ filter: 'grayscale(1)', marginBottom: '2rem' }} />
              <p style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#8C8C8C' }}>Selecciona una plantilla para previsualizar</p>
            </div>
          )}
        </div>
      </main>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #EF4444; }
        
        .pulse-heartbeat {
          animation: heartbeat 1.5s ease-in-out infinite;
          filter: drop-shadow(0 0 8px rgba(239, 68, 68, 0.4));
        }

        @keyframes heartbeat {
          0% { transform: scale(0.9); opacity: 0.4; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(0.9); opacity: 0.4; }
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin { animation: spin 1s linear infinite; }

        .mob-sidebar-btn {
          display: none;
          width: 40px; height: 40px;
          border-radius: 10px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.05);
          color: #8C8C8C;
          cursor: pointer;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .mob-sidebar-btn:hover { background: rgba(255,255,255,0.08); color: #F2F2F2; }
        @media (max-width: 768px) { .mob-sidebar-btn { display: flex; } }
      `}</style>
    </div>
  );
}

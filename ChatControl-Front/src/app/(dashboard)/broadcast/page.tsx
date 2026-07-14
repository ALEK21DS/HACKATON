'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Socket, io } from 'socket.io-client';
import {
  isLoggedIn,
  getMe,
  getBroadcastContacts,
  getBroadcastContactIds,
  getBroadcastTemplates,
  generateBroadcastMessage,
  sendBroadcast,
  getCrmBroadcastLists,
  previewBroadcastLists,
  type BroadcastListPreview,
  type BroadcastContact,
  type BroadcastTemplate,
  type BroadcastMessageType,
  type BroadcastListItem,
} from '@/lib/api';
import { formatPhoneDisplay } from '@/lib/format';
import { Spinner } from '@/shared/ui/spinner';

const PAGE_SIZE = 50;

const WS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/api$/, '');

// --- Icons ---
function PersonIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg style={{ width: '1.2rem', height: '1.2rem', ...style }} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );
}

function BroadcastIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg style={{ width: '1.2rem', height: '1.2rem', ...style }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5L6 9H2V15H6L11 19V5Z" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function SearchIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg style={{ width: '1rem', height: '1rem', ...style }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function SparklesIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg style={{ width: '1rem', height: '1rem', ...style }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
}

export default function BroadcastPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [contacts, setContacts] = useState<BroadcastContact[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [matchingIds, setMatchingIds] = useState<string[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [templates, setTemplates] = useState<BroadcastTemplate[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [messageType, setMessageType] = useState<BroadcastMessageType>('manual');
  const [broadcastLists, setBroadcastLists] = useState<BroadcastListItem[]>([]);
  const [selectedListIds, setSelectedListIds] = useState<Set<string>>(new Set());
  const [listPreview, setListPreview] = useState<BroadcastListPreview | null>(null);
  const [contactSource, setContactSource] = useState<'manual' | 'segments' | 'crm_lists'>('manual');
  const [loadingList, setLoadingList] = useState(false);
  const [text, setText] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [templateVars, setTemplateVars] = useState<Record<string, string>>({});
  const [instruction, setInstruction] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const loadCrmLists = useCallback(async () => {
    try {
      const bl = await getCrmBroadcastLists();
      setBroadcastLists(bl);
    } catch {
      setBroadcastLists([]);
    }
  }, []);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [searchQuery]);

  useEffect(() => {
    if (!mounted) return;
    if (!isLoggedIn()) { router.replace('/login'); return; }
    const initialSource = searchParams?.get('source');
    const initialLists = searchParams?.get('lists');
    if (initialSource === 'crm') {
      setContactSource('crm_lists');
      if (initialLists) {
        setSelectedListIds(new Set(initialLists.split(',').filter(Boolean)));
      }
    }
    (async () => {
      setLoading(true);
      try {
        const tl = await getBroadcastTemplates();
        setTemplates(tl);
        await loadCrmLists();
      } catch (err) {} finally { setLoading(false); }
    })();
  }, [mounted, router, searchParams, loadCrmLists]);

  const onlyCanSend = messageType !== 'template';

  async function loadFirstPage(q: string) {
    setLoading(true);
    try {
      const [page, ids] = await Promise.all([
        getBroadcastContacts({ q, limit: PAGE_SIZE }),
        getBroadcastContactIds({ q, onlyCanSend }),
      ]);
      setContacts(page.contacts);
      setNextCursor(page.nextCursor);
      setTotal(page.total);
      setMatchingIds(ids);
    } catch (err) {} finally { setLoading(false); }
  }

  async function loadMoreContacts() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await getBroadcastContacts({ q: debouncedQuery, limit: PAGE_SIZE, cursor: nextCursor });
      setContacts(prev => [...prev, ...page.contacts]);
      setNextCursor(page.nextCursor);
      setTotal(page.total);
    } catch (err) {} finally { setLoadingMore(false); }
  }

  useEffect(() => {
    if (!mounted || !isLoggedIn() || contactSource !== 'manual') return;
    loadFirstPage(debouncedQuery);
  }, [mounted, debouncedQuery, contactSource, onlyCanSend]);

  function handleContactListScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 150) {
      loadMoreContacts();
    }
  }

  const refreshListPreview = useCallback(async (listIds: string[]) => {
    if (!listIds.length) {
      setListPreview(null);
      setSelectedIds(new Set());
      return;
    }
    setLoadingList(true);
    try {
      const preview = await previewBroadcastLists(listIds);
      setListPreview(preview);
      setSelectedIds(new Set(preview.conversationIds));
    } catch (err) {
      console.error('Error loading list preview', err);
      setListPreview(null);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (contactSource === 'crm_lists' && selectedListIds.size > 0) {
      refreshListPreview(Array.from(selectedListIds));
    }
  }, [contactSource, selectedListIds, refreshListPreview]);

  // Limpiar selección de contactos inactivos si se cambia a un mensaje que no es plantilla
  useEffect(() => {
    if (messageType !== 'template') {
      setSelectedIds(prev => {
        const next = new Set(prev);
        let changed = false;
        contacts.forEach(c => {
          if (!c.canSend && next.has(c.id)) {
            next.delete(c.id);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }
  }, [messageType, contacts]);

  const toggleContact = (id: string) => {
    const contact = contacts.find(c => c.id === id);
    const isBlocked = messageType !== 'template' && contact && !contact.canSend;
    if (isBlocked) return;

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allMatchingSelected = matchingIds.length > 0 && matchingIds.every(id => selectedIds.has(id));

  const toggleAll = () => {
    const allowedContacts = matchingIds;
    const allAllowedSelected = allMatchingSelected;

    if (allAllowedSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        allowedContacts.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        allowedContacts.forEach(id => next.add(id));
        return next;
      });
    }
  };

  const handleGenerateMessage = async () => {
    if (!instruction.trim() || generating) return;
    setGenerating(true);
    try {
      const res = await generateBroadcastMessage(instruction.trim());
      setGeneratedText(res.text ?? '');
    } catch (err) {} finally { setGenerating(false); }
  };

  const handleSend = async () => {
    if (sending) return;
    setSending(true);
    try {
      await sendBroadcast({
        conversationIds: Array.from(selectedIds),
        type: messageType,
        text: messageType !== 'template' ? (generatedText || text) : undefined,
        templateId: messageType === 'template' ? templateId : undefined,
        templateVariables: messageType === 'template' ? templateVars : undefined,
      });
      setSelectedIds(new Set());
      setText(''); setInstruction(''); setGeneratedText('');
    } catch (err) {} finally { setSending(false); }
  };

  const toggleListSelection = (listId: string) => {
    setSelectedListIds((prev) => {
      const next = new Set(prev);
      if (next.has(listId)) next.delete(listId);
      else next.add(listId);
      return next;
    });
  };

  const handleSourceChange = (source: 'manual' | 'segments' | 'crm_lists') => {
    setContactSource(source);
    setSelectedListIds(new Set());
    setListPreview(null);
    if (source === 'segments') {
      setSelectedIds(new Set());
      setLoadingList(true);
      getBroadcastContactIds({}).then(ids => setSelectedIds(new Set(ids))).catch(() => {}).finally(() => setLoadingList(false));
    } else {
      setSelectedIds(new Set());
    }
  };

  const selectedTemplate = templates.find(t => t.id === templateId);

  if (!mounted) return null;

  return (
    <div style={{ display: 'flex', width: '100%', height: '100vh', background: '#040404', color: '#F2F2F2', overflow: 'hidden' }}>
      
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      {/* ── Sidebar: Audiencia ── */}
      <aside className={`aside-sidebar${sidebarOpen ? ' open' : ''}`}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em' }}>Masivos</h2>
            <div style={{ padding: '0.4rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', color: '#EF4444' }}>
              <BroadcastIcon />
            </div>
          </div>
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <SearchIcon style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#444' }} />
            <input 
              type="text" 
              placeholder="Buscar contactos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '0.75rem 1rem 0.75rem 2.8rem', color: 'white', outline: 'none', fontSize: '0.9rem' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            {([
              ['manual', 'Contactos Manuales'],
              ['segments', 'Segmentos'],
              ['crm_lists', 'Listas CRM'],
            ] as const).map(([source, label]) => (
              <button
                key={source}
                type="button"
                onClick={() => handleSourceChange(source)}
                style={{
                  flex: 1,
                  minWidth: 90,
                  padding: '0.5rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: contactSource === source ? '#EF4444' : 'rgba(255,255,255,0.03)',
                  color: contactSource === source ? 'white' : '#8C8C8C',
                  fontSize: '0.55rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {contactSource === 'crm_lists' ? (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.65rem', color: '#666', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>
                Selecciona una o varias listas
              </div>
              <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {broadcastLists.map((l) => (
                  <label
                    key={l.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '0.5rem 0.75rem',
                      borderRadius: 10,
                      background: selectedListIds.has(l.id) ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${selectedListIds.has(l.id) ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)'}`,
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedListIds.has(l.id)}
                      onChange={() => toggleListSelection(l.id)}
                    />
                    <span style={{ flex: 1 }}>{l.name}</span>
                    <span style={{ color: '#666', fontSize: '0.7rem' }}>({l.contactCount})</span>
                  </label>
                ))}
              </div>
              {listPreview && (
                <div style={{
                  marginTop: 10,
                  padding: '0.75rem',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  fontSize: '0.7rem',
                  color: '#8C8C8C',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 6,
                }}>
                  <span>Total: <strong style={{ color: '#F2F2F2' }}>{listPreview.total}</strong></span>
                  <span>Únicos: <strong style={{ color: '#22c55e' }}>{listPreview.unique}</strong></span>
                  <span>Duplicados: <strong style={{ color: '#f59e0b' }}>{listPreview.duplicates}</strong></span>
                  <span>Inválidos: <strong style={{ color: '#ef4444' }}>{listPreview.invalid}</strong></span>
                  <span style={{ gridColumn: '1 / -1' }}>Bloqueados: <strong style={{ color: '#ef4444' }}>{listPreview.blocked}</strong></span>
                </div>
              )}
            </div>
          ) : contactSource === 'manual' ? (
            <button
              onClick={toggleAll}
              style={{ width: '100%', padding: '0.6rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', color: '#8C8C8C', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer', transition: 'all 0.2s', marginBottom: '0.75rem' }}
            >
              {allMatchingSelected ? `Desmarcar todos (${total})` : `Seleccionar todos (${total})`}
            </button>
          ) : (
            <div style={{ padding: '0.75rem', marginBottom: '0.75rem', borderRadius: 10, background: 'rgba(239,68,68,0.06)', color: '#EF4444', fontSize: '0.75rem', fontWeight: 700 }}>
              {selectedIds.size} contactos del segmento (todos los contactos de la organización)
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }} className="custom-scrollbar" onScroll={handleContactListScroll}>
          {loading || loadingList ? (
            <div style={{ padding: '4rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
              <div className="pulse-heartbeat">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="#EF4444">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#222', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                {contactSource === 'crm_lists' ? 'Cargando Listas CRM' : contactSource === 'segments' ? 'Cargando Segmento' : 'Cargando Audiencia'}
              </span>
            </div>
          ) : contactSource === 'crm_lists' && selectedListIds.size > 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#22c55e', fontSize: '0.9rem', fontWeight: 700 }}>
              {selectedIds.size} contactos listos desde {selectedListIds.size} lista(s) CRM
            </div>
          ) : contactSource === 'segments' ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#22c55e', fontSize: '0.9rem', fontWeight: 700 }}>
              Segmento completo: {selectedIds.size} contactos
            </div>
          ) : (
            <>
              {contacts.map(c => {
            const isBlocked = messageType !== 'template' && !c.canSend;
            const isSelected = selectedIds.has(c.id);

            return (
              <div
                key={c.id}
                onClick={() => !isBlocked && toggleContact(c.id)}
                style={{ 
                  width: '100%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '1rem', 
                  padding: '1rem', 
                  borderRadius: '16px', 
                  background: isSelected ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
                  cursor: isBlocked ? 'not-allowed' : 'pointer',
                  opacity: isBlocked ? 0.35 : 1,
                  transition: 'all 0.2s ease',
                  marginBottom: '0.25rem',
                  border: isSelected ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid transparent'
                }}
              >
                <div style={{ 
                  width: '18px', height: '18px', borderRadius: '5px', 
                  border: '2px solid',
                  borderColor: isBlocked ? '#222' : isSelected ? '#EF4444' : '#333',
                  background: isBlocked ? 'transparent' : isSelected ? '#EF4444' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
                }}>
                  {!isBlocked && isSelected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                  <PersonIcon style={{ width: '1rem', height: '1rem' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#F2F2F2', display: 'block' }}>{c.name || formatPhoneDisplay(c.phone)}</span>
                  <span style={{ fontSize: '0.7rem', color: c.canSend ? '#666' : '#EF4444', fontWeight: 600 }}>
                    {c.canSend 
                      ? `Ventana: ${Math.floor(c.windowSecondsRemaining / 3600)}h restantes` 
                      : isBlocked 
                        ? 'Fuera de ventana (Solo Plantilla)' 
                        : 'Fuera de ventana'
                    }
                  </span>
                </div>
              </div>
                );
              })}
              {loadingMore && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem 0' }}>
                  <Spinner size={18} />
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      {/* ── Main: Consola de Lanzamiento ── */}
      <main className="page-main custom-scrollbar">
        
        <div style={{ width: '100%', margin: '0' }}>
          <header style={{ marginBottom: '3rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button 
                onClick={() => setSidebarOpen(true)} 
                className="mob-sidebar-btn"
                aria-label="Abrir lista de contactos"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
              <h1 style={{ fontSize: '2rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>Lanzamiento Masivo</h1>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
              <a href="/broadcast" style={{ fontSize: '0.65rem', fontWeight: 800, color: '#EF4444', textTransform: 'uppercase', textDecoration: 'none' }}>Campañas</a>
              <a href="/templates" style={{ fontSize: '0.65rem', fontWeight: 800, color: '#666', textTransform: 'uppercase', textDecoration: 'none' }}>Templates</a>
              <a href="/broadcast/crm-lists" style={{ fontSize: '0.65rem', fontWeight: 800, color: '#666', textTransform: 'uppercase', textDecoration: 'none' }}>Listas CRM</a>
              <a href="/broadcast/audit" style={{ fontSize: '0.65rem', fontWeight: 800, color: '#666', textTransform: 'uppercase', textDecoration: 'none' }}>Auditoría</a>
            </div>
            <p style={{ color: '#666', fontSize: '0.95rem' }}>Configura y dispara campañas masivas de alta tasa de apertura.</p>
          </header>

          {/* Selector de Tipo de Mensaje */}
          <div style={{ background: '#080808', borderRadius: '20px', padding: '0.5rem', display: 'flex', gap: '0.5rem', marginBottom: '2.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
            {(['manual', 'template', 'ia'] as BroadcastMessageType[]).map((type) => (
              <button
                key={type}
                onClick={() => setMessageType(type)}
                style={{ 
                  flex: 1, padding: '1rem', borderRadius: '16px', border: 'none',
                  background: messageType === type ? '#EF4444' : 'transparent',
                  color: messageType === type ? 'white' : '#666',
                  fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em',
                  cursor: 'pointer', transition: 'all 0.3s ease',
                  boxShadow: messageType === type ? '0 10px 20px rgba(239, 68, 68, 0.2)' : 'none'
                }}
              >
                {type === 'manual' ? 'Texto Libre' : type === 'template' ? 'Plantilla Oficial' : 'Asistente IA'}
              </button>
            ))}
          </div>

          {/* Área de Composición */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', padding: '2rem' }}>
            {messageType === 'manual' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Contenido del Mensaje</label>
                <textarea 
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Escribe el mensaje que recibirán tus contactos..."
                  style={{ width: '100%', minHeight: '200px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '1.5rem', color: 'white', outline: 'none', fontSize: '1rem', resize: 'vertical', lineHeight: '1.6' }}
                />
              </div>
            )}

            {messageType === 'template' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Selecciona una Plantilla</label>
                  <select 
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    style={{ 
                      width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '1.25rem', color: 'white', outline: 'none', fontSize: '1rem', appearance: 'none',
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23EF4444' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1.5rem center', backgroundSize: '1.2rem'
                    }}
                  >
                    <option value="" style={{ background: '#0d0d0d' }}>Seleccionar...</option>
                    {templates.map(t => <option key={t.id} value={t.id} style={{ background: '#0d0d0d' }}>{t.name}</option>)}
                  </select>
                </div>

                {selectedTemplate && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Variables de la Plantilla</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      {selectedTemplate.variables.map(v => (
                        <input 
                          key={v}
                          type="text"
                          placeholder={v.toUpperCase()}
                          value={templateVars[v] || ''}
                          onChange={(e) => setTemplateVars(prev => ({ ...prev, [v]: e.target.value }))}
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1rem', color: 'white', outline: 'none' }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {messageType === 'ia' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Instrucción para Gemini</label>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <input 
                      type="text" 
                      value={instruction}
                      onChange={(e) => setInstruction(e.target.value)}
                      placeholder="Ej: Redacta una invitación formal para un evento de networking..."
                      style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '1rem', color: 'white', outline: 'none' }}
                    />
                    <button 
                      onClick={handleGenerateMessage}
                      disabled={generating}
                      style={{ padding: '0 1.5rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '14px', color: '#EF4444', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                      {generating ? <Spinner size={16} /> : <SparklesIcon />}
                      {generating ? '...' : 'GENERAR'}
                    </button>
                  </div>
                </div>
                {(generatedText || text) && (
                  <textarea 
                    value={generatedText || text}
                    onChange={(e) => { setGeneratedText(''); setText(e.target.value); }}
                    style={{ width: '100%', minHeight: '150px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '16px', padding: '1.25rem', color: '#8C8C8C', outline: 'none', fontSize: '0.95rem' }}
                  />
                )}
              </div>
            )}
          </div>

          {/* Confirmación y Envío */}
          <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2.5rem', background: 'rgba(239, 68, 68, 0.03)', border: '1px solid rgba(239, 68, 68, 0.1)', borderRadius: '24px' }}>
            <div>
              <span style={{ fontSize: '1.25rem', fontWeight: 900, color: 'white', display: 'block' }}>{selectedIds.size}</span>
              <span style={{ fontSize: '0.7rem', color: '#666', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Contactos Seleccionados</span>
            </div>
            <button 
              onClick={handleSend}
              disabled={sending || selectedIds.size === 0}
              style={{ 
                padding: '1.25rem 3rem', background: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)', border: 'none', borderRadius: '16px', color: 'white', fontWeight: 900, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.15em', cursor: 'pointer', transition: 'all 0.3s ease',
                boxShadow: '0 10px 30px rgba(239, 68, 68, 0.4)', opacity: (sending || selectedIds.size === 0) ? 0.5 : 1,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
              }}
            >
              {sending ? <Spinner size={16} /> : null}
              {sending ? 'Lanzando...' : 'Lanzar Masivos'}
            </button>
          </div>
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

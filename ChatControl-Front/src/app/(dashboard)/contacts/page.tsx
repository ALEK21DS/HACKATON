'use client';

import { useEffect, useRef, useState } from 'react';
import { Spinner } from '@/shared/ui/spinner';
import { useRouter } from 'next/navigation';
import {
  isLoggedIn,
  getContactsList,
  createContact,
  updateContact,
  getMe,
  type ContactItem,
} from '@/lib/api';
import { formatPhoneDisplay } from '@/lib/format';

const PAGE_SIZE = 50;

// --- Icons ---
function PersonIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg style={{ width: '1.2rem', height: '1.2rem', ...style }} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
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

function PlusIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg style={{ width: '1rem', height: '1rem', ...style }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14m-7-7v14" />
    </svg>
  );
}

export default function ContactsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [tag, setTag] = useState('');
  const [isSandboxAuthorized, setIsSandboxAuthorized] = useState(false);
  const [isSandbox, setIsSandbox] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [searchQuery]);

  async function loadFirstPage(q: string) {
    setLoading(true);
    try {
      const page = await getContactsList({ q, limit: PAGE_SIZE });
      setContacts(page.contacts);
      setNextCursor(page.nextCursor);
      setTotal(page.total);
    } catch (err) {} finally { setLoading(false); }
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await getContactsList({ q: debouncedQuery, limit: PAGE_SIZE, cursor: nextCursor });
      setContacts(prev => [...prev, ...page.contacts]);
      setNextCursor(page.nextCursor);
      setTotal(page.total);
    } catch (err) {} finally { setLoadingMore(false); }
  }

  useEffect(() => {
    if (!mounted) return;
    if (!isLoggedIn()) { router.replace('/login'); return; }
    getMe().then(me => {
      if (me.isSandbox !== undefined) setIsSandbox(me.isSandbox);
    }).catch(() => {});
  }, [mounted, router]);

  useEffect(() => {
    if (!mounted || !isLoggedIn()) return;
    loadFirstPage(debouncedQuery);
  }, [mounted, debouncedQuery]);

  function handleListScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 150) {
      loadMore();
    }
  }

  const selectedContact = contacts.find((c) => c.id === selectedId);

  useEffect(() => {
    if (selectedContact) {
      setName(selectedContact.name ?? '');
      setPhone(selectedContact.phone);
      setEmail(selectedContact.email ?? '');
      setTag(selectedContact.tag ?? '');
      setIsSandboxAuthorized(selectedContact.isSandboxAuthorized);
    } else {
      setName('');
      setPhone('');
      setEmail('');
      setTag('');
      setIsSandboxAuthorized(false);
    }
  }, [selectedId, selectedContact]);

  const handleNew = () => {
    setSelectedId(null);
    setName('');
    setPhone('');
    setEmail('');
    setTag('');
    setIsSandboxAuthorized(false);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const phoneNorm = phone.replace(/\D/g, '');
    if (!phoneNorm) { setError('El número es obligatorio'); return; }
    setSaving(true);
    setError('');
    try {
      if (selectedId) {
        await updateContact(selectedId, { name: name.trim() || undefined, email: email.trim() || undefined, tag: tag.trim() || undefined, isSandboxAuthorized });
      } else {
        const { contact } = await createContact({ phone: phoneNorm, name: name.trim() || undefined, email: email.trim() || undefined, tag: tag.trim() || undefined, isSandboxAuthorized });
        setSelectedId(contact.id);
      }
      await loadFirstPage(debouncedQuery);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  return (
    <div style={{ display: 'flex', width: '100%', height: '100vh', background: '#040404', color: '#F2F2F2', overflow: 'hidden' }}>

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      {/* ── Sidebar: Directorio ── */}
      <aside className={`aside-sidebar${sidebarOpen ? ' open' : ''}`}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em' }}>Contactos</h2>
            <div style={{ padding: '0.4rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', color: '#EF4444' }}>
              <PersonIcon />
            </div>
          </div>
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <SearchIcon style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#444' }} />
            <input
              type="text"
              placeholder="Buscar contacto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '0.75rem 1rem 0.75rem 2.8rem', color: 'white', outline: 'none', fontSize: '0.9rem' }}
            />
          </div>
          <button
            onClick={handleNew}
            style={{ width: '100%', padding: '0.75rem', background: 'linear-gradient(135deg, #EF4444 0%, #991B1B 100%)', border: 'none', borderRadius: '12px', color: 'white', fontSize: '0.8rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 8px 15px rgba(239, 68, 68, 0.2)' }}
          >
            <PlusIcon />
            Agregar Contacto
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }} className="custom-scrollbar" onScroll={handleListScroll}>
          {loading ? (
            <div style={{ padding: '4rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
              <div className="pulse-heartbeat">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="#EF4444">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#222', textTransform: 'uppercase', letterSpacing: '0.2em' }}>Sincronizando</span>
            </div>
          ) : contacts.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '1rem',
                borderRadius: '16px',
                border: 'none',
                background: selectedId === c.id ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                textAlign: 'left',
                marginBottom: '0.25rem'
              }}
            >
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: selectedId === c.id ? '#EF4444' : '#444' }}>
                <PersonIcon />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: selectedId === c.id ? 'white' : '#F2F2F2', display: 'block' }}>{c.name || formatPhoneDisplay(c.phone)}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#666' }}>{formatPhoneDisplay(c.phone)}</span>
                  {isSandbox && c.isSandboxAuthorized && (
                    <div style={{ padding: '0.1rem 0.4rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '4px', fontSize: '0.6rem', color: '#EF4444', fontWeight: 800, textTransform: 'uppercase' }}>Sandbox</div>
                  )}
                </div>
              </div>
            </button>
          ))}
          {!loading && loadingMore && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem 0' }}>
              <Spinner size={18} />
            </div>
          )}
          {!loading && !nextCursor && contacts.length > 0 && (
            <p style={{ textAlign: 'center', fontSize: '0.65rem', color: '#333', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '1rem 0 0.5rem' }}>
              {total} contacto{total !== 1 ? 's' : ''} en total
            </p>
          )}
        </div>
      </aside>

      {/* ── Main: Gestión de Perfil ── */}
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
              <h1 style={{ fontSize: '2rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
                {selectedId ? 'Perfil de Contacto' : 'Nueva Identidad'}
              </h1>
            </div>
            <p style={{ color: '#666', fontSize: '0.95rem' }}>
              {selectedId ? 'Gestiona los detalles y autorizaciones de este contacto.' : 'Registra un nuevo contacto para iniciar comunicaciones.'}
            </p>
          </header>

          <form onSubmit={handleSubmit} style={{ background: '#080808', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Nombre Completo</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre del contacto (opcional)"
                style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1rem', color: 'white', outline: 'none', fontSize: '1rem' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Correo Electrónico (Opcional)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1rem', color: 'white', outline: 'none', fontSize: '1rem' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Etiqueta (Opcional)</label>
              <input
                type="text"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="Ej: Cliente VIP"
                style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1rem', color: 'white', outline: 'none', fontSize: '1rem' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Número WhatsApp</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej: 593981234567"
                disabled={!!selectedId}
                style={{ width: '100%', background: !!selectedId ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1rem', color: !!selectedId ? '#444' : 'white', outline: 'none', fontSize: '1rem', cursor: !!selectedId ? 'not-allowed' : 'text' }}
              />
              {selectedId && <span style={{ fontSize: '0.7rem', color: '#444', fontWeight: 700 }}>El número de identidad no se puede modificar.</span>}
            </div>

            {isSandbox && (
              <div style={{ background: 'rgba(239, 68, 68, 0.02)', border: '1px solid rgba(239, 68, 68, 0.1)', borderRadius: '20px', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#EF4444', display: 'block', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Autorización Sandbox</span>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#666', lineHeight: '1.4' }}>Permitir envío de mensajes en modo pruebas de Meta Developers.</p>
                </div>
                <div
                  onClick={() => setIsSandboxAuthorized(!isSandboxAuthorized)}
                  style={{
                    width: '54px', height: '28px', borderRadius: '14px', background: isSandboxAuthorized ? '#EF4444' : '#1A1A1A', position: 'relative', cursor: 'pointer', transition: 'all 0.3s ease',
                    boxShadow: isSandboxAuthorized ? '0 0 15px rgba(239, 68, 68, 0.3)' : 'none'
                  }}
                >
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'white', position: 'absolute', top: '4px', left: isSandboxAuthorized ? '30px' : '4px', transition: 'all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)' }}></div>
                </div>
              </div>
            )}

            {error && <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', borderRadius: '12px', fontSize: '0.85rem', textAlign: 'center', fontWeight: 700 }}>{error}</div>}

            <button
              type="submit"
              disabled={saving || !phone.trim()}
              style={{ width: '100%', padding: '1.25rem', background: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)', border: 'none', borderRadius: '14px', color: 'white', fontWeight: 900, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.15em', cursor: 'pointer', transition: 'all 0.3s ease', boxShadow: '0 10px 30px rgba(239, 68, 68, 0.3)', marginTop: '1rem', opacity: (saving || !phone.trim()) ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              {saving ? <><Spinner /> Guardando...</> : selectedId ? 'Actualizar Identidad' : 'Registrar Contacto'}
            </button>
          </form>
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

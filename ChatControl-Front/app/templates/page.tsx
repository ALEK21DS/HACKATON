'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  isLoggedIn,
  logout,
  getTemplatesFromMeta,
  type TemplateItem,
} from '@/lib/api';
import styles from '../chat/chat.module.css';
import broadcastStyles from '../broadcast/broadcast.module.css';

function PersonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );
}

function ChatBubbleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
    </svg>
  );
}

function BroadcastIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M4 4h12v2H4V4zm0 5h12v2H4V9zm0 5h8v2H4v-2zm-2 5h12v2H2v-2z" />
    </svg>
  );
}

function TemplateIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.04.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
    </svg>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
    </svg>
  );
}

const NAV_COLLAPSED_KEY = 'chatcontrol_nav_collapsed';

export default function TemplatesPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const [refreshingMeta, setRefreshingMeta] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;
    const stored = localStorage.getItem(NAV_COLLAPSED_KEY);
    setNavCollapsed(stored === 'true');
  }, [mounted]);

  function toggleNavCollapsed() {
    setNavCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') localStorage.setItem(NAV_COLLAPSED_KEY, String(next));
      return next;
    });
  }

  useEffect(() => {
    if (!userMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  useEffect(() => {
    if (!mounted) return;
    if (!isLoggedIn()) {
      router.replace('/login');
      return;
    }
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
      } else {
        setTemplates([]);
      }
    } catch (err) {
      setError(err instanceof Error ? (err as Error).message : 'Error al cargar plantillas desde Meta');
      setTemplates([]);
      if (String(err).includes('401')) {
        logout();
        router.replace('/login');
      }
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
      setError(err instanceof Error ? (err as Error).message : 'No se pudieron cargar plantillas desde Meta');
    } finally {
      setRefreshingMeta(false);
    }
  }

  const selectedTemplate = templates.find((t) => t.id === selectedId);

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  if (!mounted) {
    return (
      <div className={styles.layout}>
        <div className={styles.loadingPage}>Cargando…</div>
      </div>
    );
  }
  if (!isLoggedIn()) {
    return (
      <div className={styles.layout}>
        <div className={styles.loadingPage}>Redirigiendo…</div>
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      <nav className={`${styles.navBar} ${navCollapsed ? styles.navBarCollapsed : ''}`} aria-label="Menú principal">
        <button type="button" onClick={toggleNavCollapsed} className={styles.navToggle} title={navCollapsed ? 'Mostrar nombres' : 'Ocultar nombres'} aria-label={navCollapsed ? 'Expandir menú' : 'Colapsar menú'}>
          <MenuIcon />
        </button>
        <div className={styles.navItems}>
          <Link href="/chat" className={styles.navItem} title="Mensajes">
            <ChatBubbleIcon />
            <span className={styles.navLabel}>Mensajes</span>
          </Link>
          <Link href="/broadcast" className={styles.navItem} title="Mensajes Masivos">
            <BroadcastIcon />
            <span className={styles.navLabel}>Masivos</span>
          </Link>
          <Link href="/contacts" className={styles.navItem} title="Contactos">
            <PersonIcon />
            <span className={styles.navLabel}>Contactos</span>
          </Link>
          <div className={styles.navItemActive} title="Plantillas">
            <TemplateIcon />
            <span className={styles.navLabel}>Plantillas</span>
          </div>
        </div>
        <div className={styles.navFooter}>
          <div className={styles.navUserWrap} ref={userMenuRef}>
            <button type="button" onClick={() => setUserMenuOpen((o) => !o)} className={styles.navLogout} title="Usuario" aria-label="Menú de usuario" aria-expanded={userMenuOpen}>
              <PersonIcon />
            </button>
            {userMenuOpen && (
              <div className={styles.navUserDropdown} role="menu">
                <Link href="/settings" className={styles.navUserOption} role="menuitem" onClick={() => setUserMenuOpen(false)}>
                  <SettingsIcon />
                  Config
                </Link>
                <button type="button" className={`${styles.navUserOption} ${styles.navUserOptionLogout}`} role="menuitem" onClick={() => { setUserMenuOpen(false); handleLogout(); }}>
                  <LogoutIcon />
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.sidebarBrand}>
            <Image src="/assets/images/logo-mensaje.png" alt="ChatControl" width={32} height={32} className={styles.sidebarLogo} priority />
            <h2>Plantillas</h2>
          </div>
        </div>
        <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--border)' }}>
          <p className={styles.muted} style={{ fontSize: '0.8rem', margin: 0 }}>
            Plantillas desde la API de Meta (solo lectura).
          </p>
          <button type="button" onClick={refreshFromMeta} disabled={refreshingMeta} className={styles.btnSecondary} style={{ fontSize: '0.85rem', marginTop: '0.35rem' }}>
            {refreshingMeta ? 'Cargando…' : 'Refrescar'}
          </button>
        </div>
        {loading ? (
          <p className={styles.muted}>Cargando…</p>
        ) : error && !templates.length ? (
          <p className={styles.error}>{error}</p>
        ) : templates.length === 0 ? (
          <p className={styles.muted}>No hay plantillas. Crea una para usarla en Mensajes masivos &gt; Plantilla aprobada.</p>
        ) : (
          <ul className={styles.convList}>
            {templates.map((t) => (
              <li key={t.id} className={styles.convItem}>
                <button
                  type="button"
                  className={`${styles.convBtn} ${selectedId === t.id ? styles.convActive : ''}`}
                  onClick={() => setSelectedId(t.id)}
                >
                  <span className={styles.convAvatar} aria-hidden style={{ width: 36, height: 36, minWidth: 36, minHeight: 36 }}>
                    <TemplateIcon />
                  </span>
                  <span className={styles.convContent}>
                    <span className={styles.convPhone}>{t.name}</span>
                    <span className={styles.convPreview}>{t.body.slice(0, 50)}{t.body.length > 50 ? '…' : ''}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <main className={styles.main}>
        <div className={broadcastStyles.broadcastMain}>
          {error && <p className={styles.errorBar}>{error}</p>}
          {templates.length === 0 && !loading ? (
            <div className={styles.empty} style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '1rem' }}>
              No hay plantillas desde la API de Meta. Comprueba WHATSAPP_BUSINESS_ACCOUNT_ID y WHATSAPP_ACCESS_TOKEN en el backend.
            </div>
          ) : !selectedId ? (
            <div className={styles.empty} style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '1rem' }}>
              Seleccione una plantilla para ver el detalle.
            </div>
          ) : selectedTemplate ? (
            <>
              <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Vista previa (Meta)</h3>
              <p className={styles.muted} style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
                Estas plantillas se gestionan en Meta Business Manager. Solo lectura.
              </p>
              <div className={broadcastStyles.contentSection}>
                <label>Nombre</label>
                <p style={{ margin: '0.25rem 0 0', padding: '0.5rem', background: 'var(--surface-hover)', borderRadius: 6 }}>{selectedTemplate.name}</p>
              </div>
              {selectedTemplate.language && (
                <div className={broadcastStyles.contentSection} style={{ marginTop: '0.75rem' }}>
                  <label>Idioma</label>
                  <p style={{ margin: '0.25rem 0 0', padding: '0.5rem', background: 'var(--surface-hover)', borderRadius: 6 }}>{selectedTemplate.language}</p>
                </div>
              )}
              <div className={broadcastStyles.contentSection} style={{ marginTop: '0.75rem' }}>
                <label>Cuerpo</label>
                <pre style={{ margin: '0.25rem 0 0', padding: '0.75rem', background: 'var(--surface-hover)', borderRadius: 6, whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>{selectedTemplate.body || '—'}</pre>
              </div>
              {selectedTemplate.variables.length > 0 && (
                <p className={styles.muted} style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  Variables (orden): {selectedTemplate.variables.join(', ')}
                </p>
              )}
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}

'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  isLoggedIn,
  logout,
  getMe,
  getContactsList,
  createContact,
  updateContact,
  type ContactItem,
  type UserRole,
} from '@/lib/api';
import { formatPhoneDisplay } from '@/lib/format';
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

export default function ContactsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSandboxAuthorized, setIsSandboxAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [myRole, setMyRole] = useState<UserRole | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

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
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    }
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [userMenuOpen]);

  useEffect(() => {
    if (!mounted) return;
    if (!isLoggedIn()) {
      router.replace('/login');
      return;
    }
    (async () => {
      setLoading(true);
      setError('');
      try {
        getMe()
          .then((m) => setMyRole(m.role))
          .catch(() => {});
        const list = await getContactsList();
        setContacts(list);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar contactos');
        if (String(err).includes('401')) {
          logout();
          router.replace('/login');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [mounted, router]);

  const selectedContact = contacts.find((c) => c.id === selectedId);

  useEffect(() => {
    if (selectedContact) {
      setName(selectedContact.name ?? '');
      setPhone(selectedContact.phone);
      setIsSandboxAuthorized(selectedContact.isSandboxAuthorized);
    } else {
      setName('');
      setPhone('');
      setIsSandboxAuthorized(false);
    }
  }, [selectedId, selectedContact?.id, selectedContact?.name, selectedContact?.phone, selectedContact?.isSandboxAuthorized]);

  const handleNew = () => {
    setSelectedId(null);
    setName('');
    setPhone('');
    setIsSandboxAuthorized(false);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const phoneNorm = phone.replace(/\D/g, '');
    if (!phoneNorm) {
      setError('El número no puede estar vacío');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (selectedId) {
        await updateContact(selectedId, { name: name.trim() || undefined, isSandboxAuthorized });
        const list = await getContactsList();
        setContacts(list);
      } else {
        const { contact } = await createContact({
          phone: phoneNorm,
          name: name.trim() || undefined,
          isSandboxAuthorized,
        });
        const list = await getContactsList();
        setContacts(list);
        setSelectedId(contact.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

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
          <div className={styles.navItemActive} title="Contactos">
            <PersonIcon />
            <span className={styles.navLabel}>Contactos</span>
          </div>
          <Link href="/templates" className={styles.navItem} title="Plantillas">
            <TemplateIcon />
            <span className={styles.navLabel}>Plantillas</span>
          </Link>
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
                {myRole === 'ORG_ADMIN' && (
                  <>
                    <Link href="/org/integrations" className={styles.navUserOption} role="menuitem" onClick={() => setUserMenuOpen(false)}>
                      Integraciones API
                    </Link>
                    <Link href="/org/users" className={styles.navUserOption} role="menuitem" onClick={() => setUserMenuOpen(false)}>
                      Usuarios
                    </Link>
                    <Link href="/org/audit" className={styles.navUserOption} role="menuitem" onClick={() => setUserMenuOpen(false)}>
                      Auditoría envíos
                    </Link>
                  </>
                )}
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
            <h2>Contactos</h2>
          </div>
        </div>
        <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--border)' }}>
          <button type="button" onClick={handleNew} className={styles.btnSecondary} style={{ fontSize: '0.85rem' }}>
            Agregar contacto
          </button>
        </div>
        {loading ? (
          <p className={styles.muted}>Cargando…</p>
        ) : error && !contacts.length ? (
          <p className={styles.error}>{error}</p>
        ) : (
          <ul className={styles.convList}>
            {contacts.map((c) => (
              <li key={c.id} className={styles.convItem}>
                <button
                  type="button"
                  className={`${styles.convBtn} ${selectedId === c.id ? styles.convActive : ''}`}
                  onClick={() => setSelectedId(c.id)}
                >
                  <span className={styles.convAvatar} aria-hidden style={{ width: 36, height: 36, minWidth: 36, minHeight: 36 }}>
                    <PersonIcon />
                  </span>
                  <span className={styles.convContent}>
                    <span className={styles.convPhone}>{c.name || formatPhoneDisplay(c.phone)}</span>
                    {c.name && <span className={styles.convPhoneSub}>{formatPhoneDisplay(c.phone)}</span>}
                    <span className={broadcastStyles.contactStatus} style={{ color: c.isSandboxAuthorized ? 'var(--success)' : 'var(--warning)' }}>
                      {c.isSandboxAuthorized ? 'Autorizado (sandbox)' : 'No autorizado'}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <main className={styles.main}>
        <div className={broadcastStyles.broadcastMain}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>{selectedId ? 'Editar contacto' : 'Agregar contacto'}</h3>
          {error && <p className={styles.errorBar}>{error}</p>}
          <form onSubmit={handleSubmit}>
            <div className={broadcastStyles.contentSection}>
              <label htmlFor="contact-name">Nombre</label>
              <input
                id="contact-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre del contacto (opcional)"
                className={`${styles.input} ${broadcastStyles.broadcastInputWide}`}
                style={{ marginBottom: '0.75rem' }}
              />
            </div>
            <div className={broadcastStyles.contentSection}>
              <label htmlFor="contact-phone">Número WhatsApp (formato internacional)</label>
              <input
                id="contact-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej: 593981234567"
                className={`${styles.input} ${broadcastStyles.broadcastInputWide}`}
                disabled={!!selectedId}
                style={{ marginBottom: '0.75rem' }}
              />
              {selectedId && <p className={styles.muted} style={{ fontSize: '0.8rem' }}>El número no se puede cambiar al editar.</p>}
            </div>
            <div className={broadcastStyles.contentSection} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
              <input
                id="contact-sandbox"
                type="checkbox"
                checked={isSandboxAuthorized}
                onChange={(e) => setIsSandboxAuthorized(e.target.checked)}
                className={broadcastStyles.checkbox}
                style={{ marginTop: '0.25rem' }}
              />
              <label htmlFor="contact-sandbox" style={{ flex: 1, cursor: 'pointer' }}>
                <strong>Número autorizado en Meta (solo pruebas)</strong>
                <p className={styles.muted} style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  Este número debe estar previamente autorizado en Meta Developers para poder enviar mensajes en modo pruebas.
                </p>
              </label>
            </div>
            <button type="submit" disabled={saving || !phone.trim()} className={styles.btnPrimary} style={{ marginTop: '1rem' }}>
              {saving ? 'Guardando…' : selectedId ? 'Guardar cambios' : 'Agregar contacto'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

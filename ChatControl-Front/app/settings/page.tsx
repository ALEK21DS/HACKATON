'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  isLoggedIn,
  logout,
  getSettings,
  updateSettings,
  type SettingsData,
  type WhatsappTier,
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

const TIER_LABELS: Record<WhatsappTier, string> = {
  new: 'Nuevo / no verificado (250/día)',
  level1: 'Nivel 1 (1.000/día)',
  level2: 'Nivel 2 (10.000/día)',
  level3: 'Nivel 3 (100.000/día)',
  excellent: 'Excelente (ilimitado)',
};

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-1.0-pro',
];

export default function SettingsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [whatsappTier, setWhatsappTier] = useState<WhatsappTier>('new');
  const [geminiModel, setGeminiModel] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
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
        const data = await getSettings();
        setSettings(data);
        setWhatsappTier(data.whatsappTier);
        setGeminiModel(data.geminiModel || 'gemini-2.5-flash');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar configuración');
        if (String(err).includes('401')) {
          logout();
          router.replace('/login');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [mounted, router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updated = await updateSettings({
        whatsappTier,
        geminiModel: geminiModel.trim() || 'gemini-2.5-flash',
      });
      setSettings(updated);
      setSuccess('Configuración guardada correctamente.');
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
          <Link href="/contacts" className={styles.navItem} title="Contactos">
            <PersonIcon />
            <span className={styles.navLabel}>Contactos</span>
          </Link>
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
            <h2>Configuración</h2>
          </div>
        </div>
        <p className={styles.muted} style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>
          Configura el tier de WhatsApp y el modelo de Gemini para respuestas automáticas.
        </p>
      </aside>

      <main className={styles.main}>
        <div className={broadcastStyles.broadcastMain}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Configuración para administradores</h3>
          {error && <p className={styles.errorBar}>{error}</p>}
          {success && <p className={styles.badgeOk} style={{ marginBottom: '1rem', padding: '0.5rem 0.75rem' }}>{success}</p>}
          {loading ? (
            <p className={styles.muted}>Cargando…</p>
          ) : (
            <form onSubmit={handleSave}>
              <div className={broadcastStyles.contentSection} style={{ marginBottom: '1.25rem' }}>
                <label htmlFor="whatsapp-tier" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                  Tier de WhatsApp (límite de conversaciones diarias)
                </label>
                <select
                  id="whatsapp-tier"
                  value={whatsappTier}
                  onChange={(e) => setWhatsappTier(e.target.value as WhatsappTier)}
                  className={styles.input}
                  style={{ width: '100%', maxWidth: 400 }}
                >
                  {(Object.keys(TIER_LABELS) as WhatsappTier[]).map((t) => (
                    <option key={t} value={t}>
                      {TIER_LABELS[t]}
                    </option>
                  ))}
                </select>
                {settings && (
                  <p className={styles.muted} style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                    Límite actual: {settings.dailyLimit == null ? 'Ilimitado' : `${settings.dailyLimit.toLocaleString()} conversaciones/día`}
                  </p>
                )}
              </div>

              <div className={broadcastStyles.contentSection} style={{ marginBottom: '1.25rem' }}>
                <label htmlFor="gemini-model" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                  Modelo de Gemini (respuestas automáticas)
                </label>
                <select
                  id="gemini-model"
                  value={GEMINI_MODELS.includes(geminiModel) ? geminiModel : '_custom'}
                  onChange={(e) => {
                    if (e.target.value !== '_custom') setGeminiModel(e.target.value);
                  }}
                  className={styles.input}
                  style={{ width: '100%', maxWidth: 400 }}
                >
                  {GEMINI_MODELS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                  <option value="_custom">
                    {geminiModel && !GEMINI_MODELS.includes(geminiModel) ? `${geminiModel} (personalizado)` : 'Otro modelo…'}
                  </option>
                </select>
                {!GEMINI_MODELS.includes(geminiModel) && (
                  <input
                    type="text"
                    placeholder="Ej: gemini-3.0"
                    value={geminiModel}
                    onChange={(e) => setGeminiModel(e.target.value)}
                    className={styles.input}
                    style={{ width: '100%', maxWidth: 400, marginTop: '0.5rem' }}
                  />
                )}
                {settings && (
                  <p className={styles.muted} style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                    Modelo configurado: <strong>{settings.geminiModel}</strong>
                    {settings.geminiModelInUse !== settings.geminiModel && (
                      <span style={{ color: 'var(--warning)' }}>
                        {' '}— En uso: <strong>{settings.geminiModelInUse}</strong> (fallback por error)
                      </span>
                    )}
                  </p>
                )}
              </div>

              <button type="submit" disabled={saving} className={styles.btnPrimary} style={{ marginTop: '0.5rem' }}>
                {saving ? 'Guardando…' : 'Guardar configuración'}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

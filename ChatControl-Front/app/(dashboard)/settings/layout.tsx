'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getMe, logout, type UserRole, type MeResponse } from '@/lib/api';
import styles from '../chat/chat.module.css';

function PersonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
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

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
    </svg>
  );
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getMe().then(setMe).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  const isActive = (path: string) => pathname === path;

  return (
    <div style={{ display: 'flex', flex: 1, minWidth: 0, overflow: 'hidden' }}>
      <aside className={styles.sidebar}>
        {loading ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem' }}>
            <div className="pulse-heartbeat">
              <svg width="60" height="60" viewBox="0 0 24 24" fill="#EF4444">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#222', textTransform: 'uppercase', letterSpacing: '0.3em' }}>Sincronizando Perfil</span>
          </div>
        ) : (
          <>
            <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center', borderBottom: '1px solid rgba(64,64,64,0.2)' }}>
              <div style={{ 
                width: 80, 
                height: 80, 
                borderRadius: '50%', 
                background: 'rgba(239, 68, 68, 0.1)', 
                color: '#EF4444', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                margin: '0 auto 1.25rem'
              }}>
                <PersonIcon className="w-10 h-10" />
              </div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#F2F2F2', margin: '0 0 0.25rem' }}>
                {me?.role === 'AGENT' 
                  ? (me?.displayName || 'Agente') 
                  : (me?.organizationName || 'Organización')
                }
              </h2>
              <p style={{ fontSize: '0.75rem', color: '#8C8C8C', margin: 0 }}>
                {me?.email || ''}
              </p>
            </div>

        <nav style={{ flex: 1, padding: '1rem' }}>
          <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <li>
              <Link 
                href="/settings" 
                className={isActive('/settings') ? styles.navItemActive : styles.navItem}
              >
                <SettingsIcon />
                <span className={styles.navLabel}>General</span>
              </Link>
            </li>
            {me?.role === 'ORG_ADMIN' && (
              <>
                <li>
                  <Link 
                    href="/settings/integrations" 
                    className={isActive('/settings/integrations') ? styles.navItemActive : styles.navItem}
                  >
                    <SettingsIcon />
                    <span className={styles.navLabel}>Integración API</span>
                  </Link>
                </li>
                <li>
                  <Link 
                    href="/settings/users" 
                    className={isActive('/settings/users') ? styles.navItemActive : styles.navItem}
                  >
                    <PersonIcon />
                    <span className={styles.navLabel}>Usuarios</span>
                  </Link>
                </li>
                <li>
                  <Link 
                    href="/settings/assignment" 
                    className={isActive('/settings/assignment') ? styles.navItemActive : styles.navItem}
                  >
                    <svg width="1.1rem" height="1.1rem" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '0.2rem' }}>
                      <path d="M16 17V19H2V17H16ZM22 12V14H2V12H22ZM16 7V9H2V7H16Z" />
                    </svg>
                    <span className={styles.navLabel}>Asignación de Chats</span>
                  </Link>
                </li>
              </>
            )}
          </ul>
        </nav>

            <div style={{ padding: '1rem', borderTop: '1px solid rgba(64,64,64,0.2)' }}>
              <button 
                onClick={handleLogout}
                className={styles.navItem}
                style={{ width: '100%', color: '#EF4444' }}
              >
                <LogoutIcon />
                <span className={styles.navLabel}>Cerrar Sesión</span>
              </button>
            </div>
          </>
        )}
      </aside>

      <main className={styles.main} style={{ flex: 1, display: 'flex', minWidth: 0 }}>
        {children}
      </main>

      <style jsx global>{`
        .pulse-heartbeat {
          animation: heartbeat 1.5s ease-in-out infinite;
          filter: drop-shadow(0 0 8px rgba(239, 68, 68, 0.4));
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

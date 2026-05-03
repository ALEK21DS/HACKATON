'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { 
  logout,
  getMe, 
  type UserRole 
} from '@/lib/api';
import styles from '@/app/(dashboard)/chat/chat.module.css';

// --- Icons ---
function ChatBubbleIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
    </svg>
  );
}

function BroadcastIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 4h12v2H4V4zm0 5h12v2H4V9zm0 5h8v2H4v-2zm-2 5h12v2H2v-2z" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );
}

function TemplateIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
    </svg>
  );
}

const NAV_COLLAPSED_KEY = 'chatcontrol_nav_collapsed';

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentModule = searchParams.get('module');

  const [navCollapsed, setNavCollapsed] = useState(false);
  const [myDisplayName, setMyDisplayName] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<UserRole | null>(null);
  const [myOrgName, setMyOrgName] = useState<string | null>(null);
  const [myEmail, setMyEmail] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(NAV_COLLAPSED_KEY);
    setNavCollapsed(stored === 'true');

    getMe()
      .then((m) => {
        setMyRole(m.role);
        setMyDisplayName(m.displayName);
        setMyOrgName(m.organizationName);
        setMyEmail(m.email);
      })
      .catch(() => {});
  }, []);

  function toggleNavCollapsed() {
    setNavCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(NAV_COLLAPSED_KEY, String(next));
      return next;
    });
  }

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  const isActive = (path: string) => pathname.startsWith(path);

  // Contenido de la Card del Usuario (para reutilizar en ambos casos de renderizado)
  const userCardContent = (
    <>
      <div className={styles.navUserAvatar}>
        <PersonIcon />
      </div>
      {!navCollapsed && (
        <div className={styles.navUserInfo}>
          <span className={styles.navUserOrg}>
            {myRole === 'SUPER_ADMIN' 
              ? 'Administrador Central' 
              : (myRole === 'AGENT' ? (myDisplayName || 'Agente') : (myOrgName || 'Cargando...'))
            }
          </span>
          <span className={styles.navUserEmail}>{myEmail || ''}</span>
        </div>
      )}
    </>
  );

  return (
    <nav className={`${styles.navBar} ${navCollapsed ? styles.navBarCollapsed : ''}`} aria-label="Menú principal">
      {/* ── Header ── */}
      <button
        type="button"
        onClick={toggleNavCollapsed}
        className={styles.navHeader}
        title={navCollapsed ? 'Expandir menú' : 'Colapsar menú'}
      >
        <Image
          src="/assets/images/NOIRLINE2.png"
          alt="NEXTLINE"
          width={36}
          height={36}
          className={styles.navLogoImg}
          priority
        />
        {!navCollapsed && (
          <div className={styles.navBrand}>
            <h1>NEXTLINE</h1>
            <p>Panel de chat</p>
          </div>
        )}
      </button>

      {/* ── Nav items ── */}
      <div className={styles.navItems}>
        {myRole === 'SUPER_ADMIN' ? (
          <>
            <Link 
              href="/platform?module=empresas" 
              className={pathname === '/platform' && currentModule !== 'auditoria' ? styles.navItemActive : styles.navItem} 
              title="Empresas"
            >
              <BroadcastIcon />
              <span className={styles.navLabel}>Empresas</span>
            </Link>
            <Link 
              href="/platform?module=auditoria" 
              className={currentModule === 'auditoria' ? styles.navItemActive : styles.navItem} 
              title="Auditoría"
            >
              <TemplateIcon />
              <span className={styles.navLabel}>Auditoría</span>
            </Link>
          </>
        ) : (
          <>
            <Link href="/chat" className={isActive('/chat') ? styles.navItemActive : styles.navItem} title="Mensajes">
              <ChatBubbleIcon />
              <span className={styles.navLabel}>Mensajes</span>
            </Link>
            <Link href="/broadcast" className={isActive('/broadcast') ? styles.navItemActive : styles.navItem} title="Mensajes Masivos">
              <BroadcastIcon />
              <span className={styles.navLabel}>Masivos</span>
            </Link>
            <Link href="/contacts" className={isActive('/contacts') ? styles.navItemActive : styles.navItem} title="Contactos">
              <PersonIcon />
              <span className={styles.navLabel}>Contactos</span>
            </Link>
            <Link href="/templates" className={isActive('/templates') ? styles.navItemActive : styles.navItem} title="Plantillas">
              <TemplateIcon />
              <span className={styles.navLabel}>Plantillas</span>
            </Link>
          </>
        )}
      </div>

      {/* ── Footer ── */}
      <div className={styles.navFooter}>
        <div className={styles.navUserWrap}>
          {myRole === 'SUPER_ADMIN' ? (
            /* Super Admin: Logout al presionar la card, manteniendo diseño original */
            <div
              onClick={handleLogout}
              className={styles.navUserCard}
              title="Cerrar Sesión"
              style={{ cursor: 'pointer' }}
            >
              {userCardContent}
            </div>
          ) : (
            /* Otros roles: Abre configuraciones */
            <Link
              href="/settings"
              className={`${styles.navUserCard} ${isActive('/settings') ? styles.navUserCardActive : ''}`}
              title="Mi Perfil / Configuración"
            >
              {userCardContent}
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

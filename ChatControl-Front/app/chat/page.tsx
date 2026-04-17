'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { io, Socket } from 'socket.io-client';
import {
  isLoggedIn,
  getMe,
  getConversations,
  getMessages,
  getConversation,
  markConversationAsRead,
  sendMessage,
  generateReply,
  logout,
  type Conversation,
  type Message,
  type NewMessagePayload,
  type UserRole,
} from '@/lib/api';
import styles from './chat.module.css';
import { formatPhoneDisplay } from '@/lib/format';

const WS_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/** Icono de persona para contacto/usuario */
function PersonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );
}

/** Icono de burbuja de chat para el menú "Mensajes" (estilo WhatsApp) */
function ChatBubbleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
    </svg>
  );
}

/** Icono para Mensajes Masivos (múltiples burbujas) */
function BroadcastIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M4 4h12v2H4V4zm0 5h12v2H4V9zm0 5h8v2H4v-2zm-2 5h12v2H2v-2z" />
    </svg>
  );
}

/** Icono de plantilla/documento */
function TemplateIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
    </svg>
  );
}

/** Formatea timestamp (ms) a hora tipo "10:05 AM" */
function formatMessageTime(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true });
}

/** Formatea timestamp a etiqueta de día: "1/17/2026" o "Hoy", "Ayer" */
function formatDateLabel(timestamp: number): string {
  const d = new Date(timestamp);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const msgDay = new Date(d);
  msgDay.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - msgDay.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'numeric', year: 'numeric' });
}

/** Icono de engranaje para Configuración */
function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.04.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
    </svg>
  );
}

/** Icono de 3 líneas (menú): colapsar/expandir barra */
function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
    </svg>
  );
}

/** Icono de cerrar sesión (salir) */
function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
    </svg>
  );
}

const NAV_COLLAPSED_KEY = 'chatcontrol_nav_collapsed';

export default function ChatPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [canSend, setCanSend] = useState(false);
  const [windowSecondsRemaining, setWindowSecondsRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replyInput, setReplyInput] = useState('');
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedText, setGeneratedText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [myRole, setMyRole] = useState<UserRole | null>(null);
  const [peerPresence, setPeerPresence] = useState<Record<string, string>>({});
  const [typingHint, setTypingHint] = useState('');
  const socketRef = useRef<Socket | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const myUserIdRef = useRef<string | null>(null);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  selectedIdRef.current = selectedId;

  const LIMIT_MSG = 'No puedes agregar más conversaciones, has superado el límite diario de tu tier.';
  const FALLBACK_TOAST = 'Error con el modelo de Gemini, se está utilizando el modelo gratuito gemini-2.5-flash';

  // Filtrar conversaciones por número o nombre (si existe)
  const filteredConversations = searchQuery.trim()
    ? conversations.filter((c) => {
        const q = searchQuery.trim().toLowerCase();
        const matchPhone = c.phone.toLowerCase().includes(q);
        const matchName = c.name?.toLowerCase().includes(q);
        return matchPhone || matchName;
      })
    : conversations;

  // Evitar hidratación: no usar localStorage hasta después del primer render en cliente
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
    getMe()
      .then((m) => {
        myUserIdRef.current = m.id;
        setMyRole(m.role);
      })
      .catch(() => {});
    loadConversations();
  }, [mounted, router]);

  useEffect(() => {
    const s = socketRef.current;
    if (!s || !selectedId) {
      setPeerPresence({});
      setTypingHint('');
      return;
    }
    s.emit('join_conversation', { conversationId: selectedId });
    return () => {
      s.emit('leave_conversation', { conversationId: selectedId });
      setPeerPresence({});
      setTypingHint('');
    };
  }, [selectedId]);

  // WebSocket: conectar al abrir la vista del chat y escuchar new_message (sin polling)
  useEffect(() => {
    if (!mounted || !isLoggedIn()) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('chatcontrol_token') : null;
    const socket = io(WS_BASE, {
      transports: ['websocket', 'polling'],
      auth: { token: token || '' },
    });
    socketRef.current = socket;

    socket.on('new_message', (payload: NewMessagePayload) => {
      getConversations().then((list) => setConversations(list)).catch(() => {});
      const currentSelectedId = selectedIdRef.current;
      setMessages((prev) => {
        if (payload.conversationId !== currentSelectedId) return prev;
        if (prev.some((m) => m.id === payload.message.id)) return prev;
        return [...prev, payload.message];
      });
      if (payload.conversationId === currentSelectedId) {
        getConversation(payload.conversationId).then((convRes) => {
          setCanSend(convRes.canSend ?? false);
          setWindowSecondsRemaining(convRes.windowSecondsRemaining ?? 0);
        }).catch(() => {});
      }
    });

    socket.on(
      'presence',
      (p: { conversationId: string; userId: string; displayName: string; state: 'in_chat' | 'left' }) => {
        if (p.userId === myUserIdRef.current) return;
        if (p.conversationId !== selectedIdRef.current) return;
        setPeerPresence((prev) => {
          const next = { ...prev };
          if (p.state === 'in_chat') next[p.userId] = p.displayName;
          else delete next[p.userId];
          return next;
        });
      },
    );

    socket.on(
      'typing',
      (p: { conversationId: string; userId: string; displayName: string; typing: boolean }) => {
        if (p.userId === myUserIdRef.current) return;
        if (p.conversationId !== selectedIdRef.current) return;
        if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
        if (!p.typing) {
          setTypingHint('');
          return;
        }
        setTypingHint(`${p.displayName} está escribiendo…`);
        typingStopTimerRef.current = setTimeout(() => setTypingHint(''), 2800);
      },
    );

    return () => {
      if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
      if (typingIdleTimerRef.current) clearTimeout(typingIdleTimerRef.current);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [mounted]);

  // ESC: cerrar el chat abierto y volver al estado "seleccione un chat"
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (selectedIdRef.current) setSelectedId(null);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  async function loadConversations() {
    setLoading(true);
    setError('');
    try {
      const list = await getConversations();
      setConversations(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar conversaciones');
      if (String(err).includes('401')) {
        logout();
        router.replace('/login');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      setCanSend(false);
      setWindowSecondsRemaining(0);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [convRes, msgList] = await Promise.all([
          getConversation(selectedId),
          getMessages(selectedId),
        ]);
        if (cancelled) return;
        setMessages(msgList);
        setCanSend(convRes.canSend ?? false);
        setWindowSecondsRemaining(convRes.windowSecondsRemaining ?? 0);
        await markConversationAsRead(selectedId);
        if (cancelled) return;
        const list = await getConversations();
        if (!cancelled) setConversations(list);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  // Scroll al final del chat al abrir la conversación o al cambiar los mensajes
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [selectedId, messages]);

  const selectedConv = conversations.find((c) => c.id === selectedId);
  const isSandboxBlocked = selectedConv && selectedConv.isSandboxAuthorized === false;

  async function handleSend(text: string) {
    if (!selectedId || !text.trim() || sending || !canSend) return;
    const cid = selectedId;
    socketRef.current?.emit('typing_stop', { conversationId: cid });
    setSending(true);
    setError('');
    setToast('');
    try {
      await sendMessage(selectedId, text.trim());
      const convRes = await getConversation(selectedId);
      const msgList = await getMessages(selectedId);
      setMessages(msgList);
      setCanSend(convRes.canSend ?? false);
      setWindowSecondsRemaining(convRes.windowSecondsRemaining ?? 0);
      setReplyInput('');
      setGeneratedText('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al enviar';
      setError(msg);
      if (msg.includes('límite diario')) setToast(LIMIT_MSG);
    } finally {
      setSending(false);
    }
  }

  async function handleGenerateReply() {
    if (!selectedId || generating) return;
    setGenerating(true);
    setError('');
    setGeneratedText('');
    setToast('');
    try {
      const res = await generateReply(selectedId);
      setGeneratedText(res.text ?? '');
      setReplyInput(res.text ?? '');
      if (res.usedFallbackModel) setToast(FALLBACK_TOAST);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar respuesta');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSendAiAuto() {
    if (!selectedId || sending || !canSend) return;
    setSending(true);
    setError('');
    setToast('');
    try {
      const { text, usedFallbackModel } = await generateReply(selectedId);
      if (usedFallbackModel) setToast(FALLBACK_TOAST);
      if (!text?.trim()) {
        setError('La IA no generó texto');
        return;
      }
      await sendMessage(selectedId, text.trim());
      const msgList = await getMessages(selectedId);
      const convRes = await getConversation(selectedId);
      setMessages(msgList);
      setCanSend(convRes.canSend ?? false);
      setWindowSecondsRemaining(convRes.windowSecondsRemaining ?? 0);
      setReplyInput('');
      setGeneratedText('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error';
      setError(msg);
      if (msg.includes('límite diario')) setToast(LIMIT_MSG);
    } finally {
      setSending(false);
    }
  }

  function handleLogout() {
    logout();
    router.replace('/login');
  }

  const presenceLine =
    Object.keys(peerPresence).length > 0
      ? `${Object.values(peerPresence).join(', ')} ${Object.keys(peerPresence).length === 1 ? 'también está' : 'también están'} en esta conversación`
      : '';

  function bumpTyping() {
    const s = socketRef.current;
    const id = selectedIdRef.current;
    if (!s || !id) return;
    s.emit('typing_start', { conversationId: id });
    if (typingIdleTimerRef.current) clearTimeout(typingIdleTimerRef.current);
    typingIdleTimerRef.current = setTimeout(() => {
      const cid = selectedIdRef.current;
      if (cid) socketRef.current?.emit('typing_stop', { conversationId: cid });
    }, 1200);
  }

  // Mismo HTML en servidor y primer render en cliente para evitar error de hidratación
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
      {/* Menú lateral: icono + texto en fila; botón 3 líneas colapsa (solo iconos) */}
      <nav className={`${styles.navBar} ${navCollapsed ? styles.navBarCollapsed : ''}`} aria-label="Menú principal">
        <button type="button" onClick={toggleNavCollapsed} className={styles.navToggle} title={navCollapsed ? 'Mostrar nombres' : 'Ocultar nombres'} aria-label={navCollapsed ? 'Expandir menú' : 'Colapsar menú'}>
          <MenuIcon />
        </button>
        <div className={styles.navItems}>
          <div className={styles.navItemActive} title="Mensajes">
            <ChatBubbleIcon />
            <span className={styles.navLabel}>Mensajes</span>
          </div>
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
            <button
              type="button"
              onClick={() => setUserMenuOpen((o) => !o)}
              className={styles.navLogout}
              title="Usuario"
              aria-label="Menú de usuario"
              aria-expanded={userMenuOpen}
            >
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

      {/* Panel de conversaciones: siempre visible nombre/número, scroll con barra integrada */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.sidebarBrand}>
            <Image
              src="/assets/images/logo-mensaje.png"
              alt="ChatControl"
              width={32}
              height={32}
              className={styles.sidebarLogo}
              priority
            />
            <h2>Mensajes</h2>
          </div>
        </div>
        <div className={styles.searchWrap}>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por número o nombre..."
            className={styles.searchInput}
            aria-label="Buscar conversaciones por número o nombre"
          />
        </div>
        {loading ? (
          <p className={styles.muted}>Cargando…</p>
        ) : error && !conversations.length ? (
          <p className={styles.error}>{error}</p>
        ) : searchQuery.trim() && filteredConversations.length === 0 ? (
          <p className={styles.muted}>Ningún resultado para &quot;{searchQuery.trim()}&quot;</p>
        ) : (
          <ul className={styles.convList}>
            {filteredConversations.map((c, i) => {
              const unread = (c.unreadCount ?? 0) > 0;
              return (
                <li key={c.id} className={styles.convItem} style={{ animationDelay: `${i * 0.04}s` }}>
                  <button
                    type="button"
                    className={`${selectedId === c.id ? styles.convActive : styles.convBtn} ${unread ? styles.convUnread : ''}`}
                    onClick={() => setSelectedId(c.id)}
                  >
                    <span className={styles.convAvatar} aria-hidden>
                      <PersonIcon />
                    </span>
                    <span className={styles.convContent}>
                      <span className={styles.convPhone}>{c.name || formatPhoneDisplay(c.phone)}</span>
                      {c.name && <span className={styles.convPhoneSub}>{formatPhoneDisplay(c.phone)}</span>}
                      <span className={styles.convPreview}>{c.lastMessagePreview || '—'}</span>
                    </span>
                    {unread && (
                      <span className={styles.unreadBadge} aria-label={`${c.unreadCount} mensajes no leídos`}>
                        {Math.min(c.unreadCount ?? 0, 99)}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>
      <main className={styles.main}>
        {selectedId ? (
          <>
            <header className={styles.header}>
              <span className={styles.headerAvatar} aria-hidden>
                <PersonIcon />
              </span>
              <div className={styles.headerInfo}>
                <span className={styles.headerPhone}>{selectedConv?.name || formatPhoneDisplay(selectedConv?.phone ?? selectedId)}</span>
                {selectedConv?.name && selectedConv?.phone && (
                  <span className={styles.convPhoneSub} style={{ display: 'block', marginTop: '0.15rem' }}>{formatPhoneDisplay(selectedConv.phone)}</span>
                )}
                <div className={styles.windowBadge}>
                  {canSend ? (
                    <span className={styles.badgeOk}>
                      Dentro de ventana 24h
                      {windowSecondsRemaining > 0 && (
                        <small> (~{Math.floor(windowSecondsRemaining / 3600)}h restantes)</small>
                      )}
                    </span>
                  ) : (
                    <span className={styles.badgeBlocked}>
                      Fuera de ventana 24h — no se pueden enviar mensajes libres
                    </span>
                  )}
                </div>
              </div>
            </header>
            {(presenceLine || typingHint) && (
              <p
                style={{
                  margin: '0 1rem 0.5rem',
                  padding: '0.45rem 0.65rem',
                  fontSize: '0.85rem',
                  color: '#444',
                  background: 'rgba(0,0,0,0.04)',
                  borderRadius: 8,
                }}
              >
                {presenceLine}
                {presenceLine && typingHint ? ' · ' : ''}
                <em style={{ fontStyle: 'normal', color: '#1565c0' }}>{typingHint}</em>
              </p>
            )}
            {toast && (
              <p className={styles.badgeOk} style={{ margin: '0 1rem 0.5rem', padding: '0.5rem 0.75rem', borderRadius: 8 }}>
                {toast}
              </p>
            )}
            {error && <p className={styles.errorBar}>{error}</p>}
            {isSandboxBlocked && (
              <p className={styles.errorBar}>
                Este número no está autorizado en Meta (sandbox). Agrégalo en Contactos y márcalo como autorizado para poder enviar mensajes.
              </p>
            )}
            <div ref={messagesContainerRef} className={styles.messages}>
              {(() => {
                type Item = { type: 'date'; label: string } | { type: 'msg'; message: Message };
                const items: Item[] = [];
                let lastDate = '';
                messages.forEach((m, i) => {
                  const dateLabel = formatDateLabel(m.timestamp);
                  if (dateLabel !== lastDate) {
                    lastDate = dateLabel;
                    items.push({ type: 'date', label: dateLabel });
                  }
                  items.push({ type: 'msg', message: m });
                });
                return items.map((item, i) =>
                  item.type === 'date' ? (
                    <div key={`date-${item.label}-${i}`} className={styles.msgDateSeparator}>
                      {item.label}
                    </div>
                  ) : (
                    <div
                      key={item.message.id}
                      className={item.message.fromUser ? styles.msgUser : styles.msgAgent}
                      style={{ animationDelay: `${i * 0.03}s` }}
                    >
                      <div className={styles.msgBubbleContent}>
                        <span className={styles.msgText}>{item.message.text}</span>
                        <span className={styles.msgTime}>{formatMessageTime(item.message.timestamp)}</span>
                      </div>
                      {item.message.fromAi && <span className={styles.msgAiTag}>IA</span>}
                    </div>
                  ),
                );
              })()}
            </div>
            <div className={styles.actions}>
              <div className={styles.actionRow}>
                <button
                  type="button"
                  onClick={handleSendAiAuto}
                  disabled={sending || !canSend || isSandboxBlocked}
                  className={styles.btnSecondary}
                  title="Generar respuesta con IA y enviar sin validación"
                >
                  Responder con IA automática
                </button>
                <button
                  type="button"
                  onClick={handleGenerateReply}
                  disabled={generating}
                  className={styles.btnSecondary}
                  title="Generar respuesta con IA y mostrarla para editar o enviar"
                >
                  Generar respuesta con IA
                </button>
                <span className={styles.hint}>Responder manualmente: escribe abajo y envía</span>
              </div>
              <div className={styles.replyRow}>
                <textarea
                  value={replyInput}
                  onChange={(e) => {
                    setReplyInput(e.target.value);
                    bumpTyping();
                  }}
                  placeholder={generatedText ? 'Escribe o edita la respuesta...' : 'Escribe un mensaje manual...'}
                  className={styles.textarea}
                  rows={3}
                  disabled={!canSend || isSandboxBlocked}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(replyInput);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleSend(replyInput)}
                  disabled={sending || !replyInput.trim() || !canSend || isSandboxBlocked}
                  className={styles.btnPrimary}
                >
                  Enviar
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className={styles.empty}>
            {conversations.length === 0
              ? 'No hay conversaciones. Los mensajes entrantes por WhatsApp aparecerán aquí.'
              : 'Seleccione un chat para enviar un mensaje'}
          </div>
        )}
      </main>
    </div>
  );
}

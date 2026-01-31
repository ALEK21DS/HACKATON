'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { io, Socket } from 'socket.io-client';
import {
  isLoggedIn,
  getConversations,
  getMessages,
  getConversation,
  sendMessage,
  generateReply,
  logout,
  type Conversation,
  type Message,
  type NewMessagePayload,
} from '@/lib/api';
import styles from './chat.module.css';

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

export default function ChatPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
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
  const socketRef = useRef<Socket | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

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
    if (!mounted) return;
    if (!isLoggedIn()) {
      router.replace('/login');
      return;
    }
    loadConversations();
  }, [mounted, router]);

  // WebSocket: conectar al abrir la vista del chat y escuchar new_message (sin polling)
  useEffect(() => {
    if (!mounted || !isLoggedIn()) return;
    const socket = io(WS_BASE, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('new_message', (payload: NewMessagePayload) => {
      // Actualizar lista de conversaciones (preview y orden)
      getConversations().then((list) => setConversations(list)).catch(() => {});
      const currentSelectedId = selectedIdRef.current;
      // Si el mensaje es de la conversación abierta, añadirlo al estado sin recargar
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

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [mounted]);

  async function loadConversations() {
    setLoading(true);
    setError('');
    try {
      const list = await getConversations();
      setConversations(list);
      if (list.length && !selectedId) setSelectedId(list[0].id);
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
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const selectedConv = conversations.find((c) => c.id === selectedId);

  async function handleSend(text: string) {
    if (!selectedId || !text.trim() || sending || !canSend) return;
    setSending(true);
    setError('');
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
      setError(err instanceof Error ? err.message : 'Error al enviar');
    } finally {
      setSending(false);
    }
  }

  async function handleGenerateReply() {
    if (!selectedId || generating) return;
    setGenerating(true);
    setError('');
    setGeneratedText('');
    try {
      const res = await generateReply(selectedId);
      setGeneratedText(res.text ?? '');
      setReplyInput(res.text ?? '');
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
    try {
      const { text } = await generateReply(selectedId);
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
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSending(false);
    }
  }

  function handleLogout() {
    logout();
    router.replace('/login');
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
      {/* Menú lateral izquierdo tipo WhatsApp: primera opción = Mensajes */}
      <nav className={styles.navBar} aria-label="Menú principal">
        <div className={styles.navItems}>
          <div className={styles.navItemActive} title="Mensajes">
            <ChatBubbleIcon />
            <span className={styles.navLabel}>Mensajes</span>
          </div>
          <Link href="/broadcast" className={styles.navItem} title="Mensajes Masivos">
            <BroadcastIcon />
            <span className={styles.navLabel}>Masivos</span>
          </Link>
        </div>
        <div className={styles.navFooter}>
          <button
            type="button"
            onClick={handleLogout}
            className={styles.navLogout}
            title="Salir"
            aria-label="Cerrar sesión"
          >
            <PersonIcon />
          </button>
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
            {filteredConversations.map((c, i) => (
              <li key={c.id} className={styles.convItem} style={{ animationDelay: `${i * 0.04}s` }}>
                <button
                  type="button"
                  className={selectedId === c.id ? styles.convActive : styles.convBtn}
                  onClick={() => setSelectedId(c.id)}
                >
                  <span className={styles.convAvatar} aria-hidden>
                    <PersonIcon />
                  </span>
                  <span className={styles.convContent}>
                    <span className={styles.convPhone}>{c.name || c.phone}</span>
                    {c.name && <span className={styles.convPhoneSub}>{c.phone}</span>}
                    <span className={styles.convPreview}>{c.lastMessagePreview || '—'}</span>
                  </span>
                </button>
              </li>
            ))}
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
                <span className={styles.headerPhone}>{selectedConv?.phone ?? selectedId}</span>
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
            {error && <p className={styles.errorBar}>{error}</p>}
            <div className={styles.messages}>
              {messages.map((m, i) => (
                <div
                  key={m.id}
                  className={m.fromUser ? styles.msgUser : styles.msgAgent}
                  style={{ animationDelay: `${i * 0.03}s` }}
                >
                  <span className={styles.msgText}>{m.text}</span>
                  {m.fromAi && <span className={styles.msgAiTag}>IA</span>}
                </div>
              ))}
            </div>
            <div className={styles.actions}>
              <div className={styles.actionRow}>
                <button
                  type="button"
                  onClick={handleSendAiAuto}
                  disabled={sending || !canSend}
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
              {(generatedText || replyInput) && (
                <div className={styles.replyRow}>
                  <textarea
                    value={replyInput}
                    onChange={(e) => setReplyInput(e.target.value)}
                    placeholder="Escribe o edita la respuesta..."
                    className={styles.textarea}
                    rows={3}
                    disabled={!canSend}
                  />
                  <button
                    type="button"
                    onClick={() => handleSend(replyInput)}
                    disabled={sending || !replyInput.trim() || !canSend}
                    className={styles.btnPrimary}
                  >
                    Enviar
                  </button>
                </div>
              )}
              {!generatedText && !replyInput && (
                <div className={styles.replyRow}>
                  <input
                    value={replyInput}
                    onChange={(e) => setReplyInput(e.target.value)}
                    placeholder="Escribe un mensaje manual..."
                    className={styles.input}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend(replyInput);
                      }
                    }}
                    disabled={!canSend}
                  />
                  <button
                    type="button"
                    onClick={() => handleSend(replyInput)}
                    disabled={sending || !replyInput.trim() || !canSend}
                    className={styles.btnPrimary}
                  >
                    Enviar
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className={styles.empty}>
            {conversations.length === 0
              ? 'No hay conversaciones. Los mensajes entrantes por WhatsApp aparecerán aquí.'
              : 'Selecciona una conversación'}
          </div>
        )}
      </main>
    </div>
  );
}

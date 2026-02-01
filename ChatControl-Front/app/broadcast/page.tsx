'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { io, Socket } from 'socket.io-client';
import {
  isLoggedIn,
  logout,
  getBroadcastContacts,
  getBroadcastTemplates,
  generateBroadcastMessage,
  sendBroadcast,
  type BroadcastContact,
  type BroadcastTemplate,
  type BroadcastMessageType,
} from '@/lib/api';
import styles from '../chat/chat.module.css';
import broadcastStyles from './broadcast.module.css';
import { formatPhoneDisplay } from '@/lib/format';

const WS_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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

export default function BroadcastPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [contacts, setContacts] = useState<BroadcastContact[]>([]);
  const [templates, setTemplates] = useState<BroadcastTemplate[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [messageType, setMessageType] = useState<BroadcastMessageType>('manual');
  const [text, setText] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [templateVars, setTemplateVars] = useState<Record<string, string>>({});
  const [instruction, setInstruction] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [progressTotal, setProgressTotal] = useState(0);
  const [progressSent, setProgressSent] = useState(0);
  const [progressFailed, setProgressFailed] = useState(0);
  const [progressErrors, setProgressErrors] = useState<Array<{ conversationId: string; error: string }>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const LIMIT_MSG = 'No puedes agregar más conversaciones, has superado el límite diario de tu tier.';
  const FALLBACK_TOAST = 'Error con el modelo de Gemini, se está utilizando el modelo gratuito gemini-2.5-flash';

  const filteredContacts = searchQuery.trim()
    ? contacts.filter((c) => {
        const q = searchQuery.trim().toLowerCase();
        const matchPhone = c.phone.toLowerCase().includes(q);
        const matchName = c.name?.toLowerCase().includes(q);
        return matchPhone || matchName;
      })
    : contacts;

  /** Algún contacto seleccionado está fuera del límite de 24h → bloquear Mensaje con IA */
  const selectedContactList = contacts.filter((c) => selectedIds.has(c.id));
  const hasSelectedOutsideLimit = selectedContactList.some((c) => !c.canSend);
  /** Algún contacto no está autorizado en Meta (sandbox) → bloquear envío */
  const hasSelectedNotSandboxAuthorized = selectedContactList.some((c) => !c.isSandboxAuthorized);

  /** Formato: "Quedan X horas" o "Quedan menos de 1 hora" / "Fuera del límite" */
  function formatWindowStatus(c: BroadcastContact): string {
    if (!c.canSend) return 'Fuera del límite';
    const sec = c.windowSecondsRemaining;
    if (sec <= 0) return 'Fuera del límite';
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    if (hours >= 1) return `Quedan ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    if (minutes >= 1) return `Quedan ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
    return 'Quedan menos de 1 min';
  }

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

  /** Si hay contactos fuera del límite seleccionados, forzar tipo "Plantilla aprobada" y bloquear manual/IA */
  useEffect(() => {
    if (hasSelectedOutsideLimit && (messageType === 'manual' || messageType === 'ia')) {
      setMessageType('template');
    }
  }, [hasSelectedOutsideLimit, messageType]);

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
        const [contactsList, templatesList] = await Promise.all([
          getBroadcastContacts(),
          getBroadcastTemplates(),
        ]);
        setContacts(contactsList);
        setTemplates(templatesList);
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

  useEffect(() => {
    if (!mounted || !isLoggedIn()) return;
    const socket = io(WS_BASE, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('broadcast_started', (payload: { total: number }) => {
      setProgressTotal(payload.total);
      setProgressSent(0);
      setProgressFailed(0);
      setProgressErrors([]);
    });
    socket.on('broadcast_message_sent', () => {
      setProgressSent((n) => n + 1);
    });
    socket.on('broadcast_message_failed', (payload: { conversationId: string; errorMessage: string }) => {
      setProgressFailed((n) => n + 1);
      setProgressErrors((prev) => [...prev, { conversationId: payload.conversationId, error: payload.errorMessage }]);
    });
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [mounted]);

  const toggleContact = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === contacts.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(contacts.map((c) => c.id)));
  };

  const handleGenerateMessage = async () => {
    if (!instruction.trim() || generating) return;
    setGenerating(true);
    setError('');
    setGeneratedText('');
    setToast('');
    try {
      const res = await generateBroadcastMessage(instruction.trim());
      setGeneratedText(res.text ?? '');
      if (res.usedFallbackModel) setToast(FALLBACK_TOAST);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar mensaje');
    } finally {
      setGenerating(false);
    }
  };

  const getMessageToSend = (): string => {
    if (messageType === 'manual') return text.trim();
    if (messageType === 'ia') return generatedText.trim() || text.trim();
    if (messageType === 'template' && templateId) {
      const t = templates.find((x) => x.id === templateId);
      if (!t) return '';
      let body = t.body;
      t.variables.forEach((key) => {
        const value = templateVars[key] ?? `{{${key}}}`;
        body = body.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), value);
      });
      return body;
    }
    return '';
  };

  const canSend =
    selectedIds.size > 0 &&
    (messageType === 'template' ? !!templateId && !!getMessageToSend() : !!getMessageToSend()) &&
    (messageType !== 'ia' || !hasSelectedOutsideLimit) &&
    !hasSelectedNotSandboxAuthorized;

  const handleSend = async () => {
    if (!canSend || sending) return;
    const messageToSend = getMessageToSend();
    if (!messageToSend) return;
    setSending(true);
    setError('');
    setToast('');
    setProgressTotal(0);
    setProgressSent(0);
    setProgressFailed(0);
    setProgressErrors([]);
    try {
      const result = await sendBroadcast({
        conversationIds: Array.from(selectedIds),
        type: messageType,
        text: messageType !== 'template' ? messageToSend : undefined,
        templateId: messageType === 'template' ? templateId : undefined,
        templateVariables: messageType === 'template' && Object.keys(templateVars).length ? templateVars : undefined,
      });
      setProgressTotal(result.sent + result.failed);
      setProgressSent(result.sent);
      setProgressFailed(result.failed);
      setProgressErrors(result.errors ?? []);
      const hasLimitError = (result.errors ?? []).some((e) => e.error?.includes('límite diario'));
      if (hasLimitError) setToast(LIMIT_MSG);
      // Limpiar inputs y usuarios seleccionados tras enviar
      setSelectedIds(new Set());
      setInstruction('');
      setText('');
      setGeneratedText('');
      setTemplateId('');
      setTemplateVars({});
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al enviar mensajes masivos';
      setError(msg);
      if (msg.includes('límite diario')) setToast(LIMIT_MSG);
    } finally {
      setSending(false);
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

  const selectedTemplate = templates.find((t) => t.id === templateId);

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
          <div className={styles.navItemActive} title="Mensajes Masivos">
            <BroadcastIcon />
            <span className={styles.navLabel}>Masivos</span>
          </div>
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
            <h2>Mensajes Masivos</h2>
          </div>
        </div>
        {loading ? (
          <p className={styles.muted}>Cargando…</p>
        ) : error && !contacts.length ? (
          <p className={styles.error}>{error}</p>
        ) : (
          <>
            <div className={styles.searchWrap}>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por número o nombre..."
                className={styles.searchInput}
                aria-label="Buscar contactos"
              />
            </div>
            <div className={broadcastStyles.contentSection} style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--border)' }}>
              <button type="button" onClick={toggleAll} className={styles.btnSecondary} style={{ fontSize: '0.85rem' }}>
                {selectedIds.size === filteredContacts.length ? 'Desmarcar todos' : 'Seleccionar todos'}
              </button>
            </div>
            {searchQuery.trim() && filteredContacts.length === 0 ? (
              <p className={styles.muted}>Ningún resultado para &quot;{searchQuery.trim()}&quot;</p>
            ) : (
            <ul className={styles.convList}>
              {filteredContacts.map((c) => (
                <li key={c.id} className={styles.convItem}>
                  <button
                    type="button"
                    className={`${broadcastStyles.checkboxRow} ${selectedIds.has(c.id) ? broadcastStyles.checkboxRowSelected : ''}`}
                    onClick={() => toggleContact(c.id)}
                  >
                    <input
                      type="checkbox"
                      className={broadcastStyles.checkbox}
                      checked={selectedIds.has(c.id)}
                      onChange={() => toggleContact(c.id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Seleccionar ${c.name || formatPhoneDisplay(c.phone)}`}
                    />
                    <span className={styles.convAvatar} aria-hidden style={{ width: 36, height: 36, minWidth: 36, minHeight: 36 }}>
                      <PersonIcon />
                    </span>
                    <span className={styles.convContent}>
                      <span className={styles.convPhone}>{c.name || formatPhoneDisplay(c.phone)}</span>
                      {c.name && <span className={styles.convPhoneSub}>{formatPhoneDisplay(c.phone)}</span>}
                      <span className={`${broadcastStyles.contactStatus} ${c.canSend ? broadcastStyles.contactStatusOk : broadcastStyles.contactStatusBlocked}`}>
                        {formatWindowStatus(c)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            )}
          </>
        )}
      </aside>

      <main className={styles.main}>
        <div className={broadcastStyles.broadcastMain}>
          {toast && (
            <p className={styles.badgeOk} style={{ marginBottom: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: 8 }}>
              {toast}
            </p>
          )}
          {error && <p className={styles.errorBar}>{error}</p>}
          {hasSelectedNotSandboxAuthorized && (
            <p className={styles.errorBar}>
              Hay contactos no autorizados en Meta (sandbox). Agrégalos en Contactos y márcalos como autorizados para poder enviar mensajes.
            </p>
          )}

          <div className={broadcastStyles.typeSection}>
            <h3>Tipo de mensaje</h3>
            <div className={broadcastStyles.typeButtons}>
              <button
                type="button"
                className={`${broadcastStyles.typeBtn} ${messageType === 'manual' ? broadcastStyles.typeBtnActive : ''}`}
                onClick={() => setMessageType('manual')}
                disabled={hasSelectedOutsideLimit}
                title={hasSelectedOutsideLimit ? 'Solo puedes usar Plantilla aprobada cuando hay contactos fuera del límite de 24h' : undefined}
              >
                Mensaje manual
              </button>
              <button
                type="button"
                className={`${broadcastStyles.typeBtn} ${messageType === 'template' ? broadcastStyles.typeBtnActive : ''}`}
                onClick={() => setMessageType('template')}
              >
                Plantilla aprobada
              </button>
              <button
                type="button"
                className={`${broadcastStyles.typeBtn} ${messageType === 'ia' ? broadcastStyles.typeBtnActive : ''}`}
                onClick={() => setMessageType('ia')}
                disabled={hasSelectedOutsideLimit}
                title={hasSelectedOutsideLimit ? 'Quita los contactos fuera del límite para usar Mensaje con IA' : 'Solo para contactos dentro de la ventana de 24h'}
              >
                Mensaje con IA (solo dentro de 24h)
              </button>
            </div>
            {hasSelectedOutsideLimit && (
              <p className={styles.muted} style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                Hay contactos fuera del límite de 24h. Desmárcalos para poder usar &quot;Mensaje con IA&quot; o usa &quot;Plantilla aprobada&quot;.
              </p>
            )}
          </div>

          {messageType === 'manual' && (
            <div className={broadcastStyles.contentSection}>
              <label htmlFor="broadcast-text">Texto del mensaje</label>
              <textarea
                id="broadcast-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Escribe el mensaje a enviar..."
                className={`${styles.textarea} ${broadcastStyles.broadcastTextarea}`}
                rows={4}
              />
            </div>
          )}

          {messageType === 'template' && (
            <div className={broadcastStyles.contentSection}>
              <label htmlFor="broadcast-template">Plantilla</label>
              <select
                id="broadcast-template"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className={broadcastStyles.templateSelect}
              >
                <option value="">Selecciona una plantilla</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {selectedTemplate && selectedTemplate.variables.length > 0 && (
                <div className={broadcastStyles.templateVars}>
                  {selectedTemplate.variables.map((key) => (
                    <input
                      key={key}
                      type="text"
                      placeholder={key}
                      value={templateVars[key] ?? ''}
                      onChange={(e) => setTemplateVars((v) => ({ ...v, [key]: e.target.value }))}
                      className={broadcastStyles.broadcastInputWide}
                    />
                  ))}
                </div>
              )}
              {selectedTemplate && (
                <p className={styles.muted} style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                  Vista previa: {selectedTemplate.body.replace(/\{\{\s*\w+\s*\}\}/g, (m) => templateVars[m.replace(/\{\{|\}\}/g, '').trim()] ?? m)}
                </p>
              )}
            </div>
          )}

          {messageType === 'ia' && (
            <div className={broadcastStyles.contentSection}>
              <label htmlFor="broadcast-instruction">Instrucción para la IA</label>
              <input
                id="broadcast-instruction"
                type="text"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Ej: Escribe un mensaje promocional corto y amigable"
                className={`${styles.input} ${broadcastStyles.broadcastInputWide}`}
                style={{ marginBottom: '0.5rem' }}
              />
              <button type="button" onClick={handleGenerateMessage} disabled={generating || !instruction.trim()} className={styles.btnSecondary}>
                {generating ? 'Generando…' : 'Generar mensaje'}
              </button>
              {generatedText && (
                <>
                  <label style={{ display: 'block', marginTop: '1rem' }}>Mensaje generado (revisa antes de enviar)</label>
                  <textarea
                    value={text || generatedText}
                    onChange={(e) => setText(e.target.value)}
                    className={`${styles.textarea} ${broadcastStyles.broadcastTextarea}`}
                    rows={4}
                    style={{ marginTop: '0.25rem' }}
                  />
                </>
              )}
            </div>
          )}

          {(sending || progressTotal > 0) && (
            <div className={broadcastStyles.progressBar}>
              <strong>Progreso</strong>
              Enviados: {progressSent} | Fallidos: {progressFailed}
              {progressErrors.length > 0 && (
                <div className={broadcastStyles.progressErrors}>
                  {progressErrors.slice(0, 5).map((e, i) => (
                    <div key={i}>{e.error}</div>
                  ))}
                  {progressErrors.length > 5 && <div>… y {progressErrors.length - 5} más</div>}
                </div>
              )}
            </div>
          )}

          <div className={broadcastStyles.sendConfirm}>
            <p>
              {selectedIds.size} contacto(s) seleccionado(s). El mensaje no se envía automáticamente; debes confirmar.
            </p>
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend || sending}
              className={styles.btnPrimary}
            >
              {sending ? 'Enviando…' : 'Enviar mensajes masivos'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

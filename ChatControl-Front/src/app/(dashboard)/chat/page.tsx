'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
  sendMediaFile,
  getGallery,
  updateContact,
  generateReply,
  assignConversation,
  sendMedia,
  getOrgUsers,
  type Conversation,
  type Message,
  type NewMessagePayload,
  type MessageStatusPayload,
} from '@/lib/api';
import { formatPhoneDisplay } from '@/lib/format';
import { Spinner } from '@/shared/ui/spinner';
import styles from './chat.module.css';

const WS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/api$/, '');

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

function SparklesIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg style={{ width: '1rem', height: '1rem', ...style }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
}

function SendIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg style={{ width: '1.1rem', height: '1.1rem', ...style }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function PaperclipIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg style={{ width: '1.1rem', height: '1.1rem', ...style }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

export default function ChatPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [replyInput, setReplyInput] = useState('');
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [typingHint, setTypingHint] = useState('');
  const [canSend, setCanSend] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // New details, lightbox and attachment states
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editSandbox, setEditSandbox] = useState(false);
  const [updatingContact, setUpdatingContact] = useState(false);
  const [gallery, setGallery] = useState<Message[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const [orgUsers, setOrgUsers] = useState<Array<{ id: string; email: string; displayName: string | null; role: string }>>([]);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  const socketRef = useRef<Socket | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const myUserIdRef = useRef<string | null>(null);
  const myUserRoleRef = useRef<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendingRef = useRef(false);

  selectedIdRef.current = selectedId;

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!isLoggedIn()) { router.replace('/login'); return; }
    getMe().then(m => {
      myUserIdRef.current = m.id;
      myUserRoleRef.current = m.role;
      if (m.role === 'ORG_ADMIN') {
        getOrgUsers().then(u => setOrgUsers(u)).catch(() => {});
      }
    }).catch(() => {});
    loadConversations();
  }, [mounted, router]);

  useEffect(() => {
    if (!mounted || !isLoggedIn()) return;
    const token = localStorage.getItem('chatcontrol_token');
    const socket = io(WS_BASE, { auth: { token: token || '' } });
    socketRef.current = socket;

    socket.on('new_message', (payload: NewMessagePayload) => {
      loadConversations(false);
      if (payload.conversationId === selectedIdRef.current) {
        setMessages(prev => {
          if (prev.some(m => m.id === payload.message.id)) return prev;
          return [...prev, { ...payload.message, status: payload.message.status || 'RECEIVED' }];
        });
        markConversationAsRead(payload.conversationId);
      }
    });

    socket.on('message_edited', (p: { conversationId: string; messageId: string; newText: string }) => {
      if (p.conversationId === selectedIdRef.current) {
        setMessages(prev => prev.map(m =>
          m.id === p.messageId ? { ...m, text: p.newText, isEdited: true } : m
        ));
      }
      loadConversations(false);
    });

    socket.on('message_status', (p: MessageStatusPayload) => {
      if (p.conversationId === selectedIdRef.current) {
        setMessages(prev => prev.map(m =>
          m.id === p.messageId ? { ...m, status: p.status } : m
        ));
      }
      loadConversations(false);
    });

    socket.on('conversation_assigned', (p: { conversationId: string; assignedToUserId: string }) => {
      loadConversations(false);
    });

    socket.on('conversation_assigned_to_me', (p: { conversationId: string }) => {
      loadConversations(false);
      if (selectedIdRef.current === p.conversationId) {
        markConversationAsRead(p.conversationId);
      }
    });

    socket.on('typing', (p: any) => {
      if (p.userId === myUserIdRef.current || p.conversationId !== selectedIdRef.current) return;
      if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
      if (!p.typing) { setTypingHint(''); return; }
      setTypingHint(`${p.displayName || 'Cliente'} está escribiendo...`);
      typingStopTimerRef.current = setTimeout(() => setTypingHint(''), 3000);
    });

    return () => { socket.disconnect(); };
  }, [mounted]);

  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      setLoadingMessages(true);
      try {
        const [convRes, msgRes] = await Promise.all([
          getConversation(selectedId),
          getMessages(selectedId),
        ]);
        setMessages(msgRes.messages);
        setNextCursor(msgRes.nextCursor);
        setCanSend(convRes.canSend ?? false);
        markConversationAsRead(selectedId);
      } catch (err) {} finally {
        setLoadingMessages(false);
      }
    })();
  }, [selectedId]);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el || loadingMore) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, selectedId, loadingMore]);

  async function loadConversations(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      const list = await getConversations();
      setConversations(list);
    } catch (err) {} finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    if (!selectedId || !replyInput.trim() || sending || !canSend || sendingRef.current) return;
    const text = replyInput.trim();
    setReplyInput('');
    setSending(true);
    sendingRef.current = true;
    const tempId = `temp_${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      conversationId: selectedId,
      fromUser: false,
      text,
      timestamp: Date.now(),
      status: 'SENDING',
    };
    setMessages(prev => [...prev, optimistic]);
    try {
      const res = await sendMessage(selectedId, text);
      if (res && res.message) {
        setMessages(prev => prev.map(m => m.id === tempId ? res.message : m));
      }
    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setReplyInput(text);
    } finally {
      setSending(false);
      sendingRef.current = false;
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSize = 16 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('Archivo muy grande. Máximo 16MB.');
      e.target.value = '';
      return;
    }
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'video/mp4', 'video/webm',
      'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4',
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.pdf') && !file.name.endsWith('.docx') && !file.name.endsWith('.doc')) {
      alert('Formato no permitido. Usa: JPG, PNG, WEBP, GIF, MP4, PDF o DOCX.');
      e.target.value = '';
      return;
    }
    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setFilePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  }

  async function handleSendFile() {
    if (!selectedId || !selectedFile || uploading || !canSend) return;
    setUploading(true);
    
    let type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' = 'DOCUMENT';
    if (selectedFile.type.startsWith('image/')) {
      type = 'IMAGE';
    } else if (selectedFile.type.startsWith('video/')) {
      type = 'VIDEO';
    } else if (selectedFile.type.startsWith('audio/')) {
      type = 'AUDIO';
    }

    try {
      await sendMediaFile(selectedId, selectedFile, type);
      const msgRes = await getMessages(selectedId);
      setMessages(msgRes.messages);
      setSelectedFile(null);
      setFilePreview(null);
    } catch (err: any) {
      alert(err.message || 'Error al enviar archivo');
    } finally {
      setUploading(false);
    }
  }

  function clearFileSelection() {
    setSelectedFile(null);
    setFilePreview(null);
  }

  async function handleAssign(userId: string | null) {
    if (!selectedId) return;
    try {
      await assignConversation(selectedId, userId);
      setShowAssignDropdown(false);
      loadConversations(false);
    } catch (err) {}
  }

  const userRole = myUserRoleRef.current;

  function renderStatus(status?: string) {
    if (!status || status === 'SENDING') return null;
    if (status === 'SENT') return <span style={{ fontSize: '0.6rem', color: '#888' }}>✓</span>;
    if (status === 'DELIVERED') return <span style={{ fontSize: '0.6rem', color: '#888' }}>✓✓</span>;
    if (status === 'READ') return <span style={{ fontSize: '0.6rem', color: '#60A5FA' }}>✓✓</span>;
    if (status === 'FAILED') return <span style={{ fontSize: '0.6rem', color: '#EF4444' }}>✗</span>;
    return null;
  }

  async function handleGenerateReply() {
    if (!selectedId || generating) return;
    setGenerating(true);
    try {
      const res = await generateReply(selectedId);
      setReplyInput(res.text || '');
    } catch (err) {} finally {
      setGenerating(false);
    }
  }

  const filteredConversations = conversations.filter(c => 
    c.phone.includes(searchQuery) || (c.name?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const selectedConv = conversations.find(c => c.id === selectedId);

  useEffect(() => {
    if (selectedConv) {
      setEditName(selectedConv.name || '');
      setEditEmail(selectedConv.email || '');
      setEditSandbox(selectedConv.isSandboxAuthorized || false);
    }
    if (selectedId && detailsOpen) {
      setLoadingGallery(true);
      getGallery(selectedId)
        .then(res => setGallery(res))
        .catch(() => {})
        .finally(() => setLoadingGallery(false));
    }
  }, [selectedId, detailsOpen, selectedConv]);

  async function handleUpdateContact(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedConv?.contactId || updatingContact) return;
    setUpdatingContact(true);
    try {
      await updateContact(selectedConv.contactId, {
        name: editName.trim() || undefined,
        email: editEmail.trim() || undefined,
        isSandboxAuthorized: editSandbox,
      });
      await loadConversations(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar contacto');
    } finally {
      setUpdatingContact(false);
    }
  }



  if (!mounted) return null;

  return (
    <div style={{ display: 'flex', width: '100%', height: '100vh', background: '#040404', color: '#F2F2F2', overflow: 'hidden' }}>
      
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      {/* ── Sidebar: Lista de Chats ── */}
      <aside className={`${styles.sidebar}${sidebarOpen ? ` ${styles.sidebarVisible}` : ''}`}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em' }}>Mensajes</h2>
            <div style={{ padding: '0.4rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', color: '#EF4444' }}>
              <SearchIcon />
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            <SearchIcon style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#444' }} />
            <input 
              type="text" 
              placeholder="Buscar conversación..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '0.75rem 1rem 0.75rem 2.8rem', color: 'white', outline: 'none', fontSize: '0.9rem' }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }} className="custom-scrollbar">
          {loading ? (
            <div style={{ padding: '4rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
              <div className="pulse-heartbeat">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="#EF4444">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#222', textTransform: 'uppercase', letterSpacing: '0.2em' }}>Sincronizando</span>
            </div>
          ) : filteredConversations.map(c => (
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
                marginBottom: '0.25rem',
                position: 'relative'
              }}
              onMouseEnter={(e) => { if(selectedId !== c.id) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
              onMouseLeave={(e) => { if(selectedId !== c.id) e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: selectedId === c.id ? '#EF4444' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: selectedId === c.id ? 'white' : '#666', transition: 'all 0.3s' }}>
                <PersonIcon />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: selectedId === c.id ? 'white' : '#F2F2F2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.name || formatPhoneDisplay(c.phone)}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#444' }}>{c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                </div>
                <p style={{ fontSize: '0.8rem', color: (c.unreadCount ?? 0) > 0 ? '#EF4444' : '#666', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: (c.unreadCount ?? 0) > 0 ? 700 : 400 }}>
                  {c.lastMessagePreview || 'Inicia una conversación'}
                </p>
              </div>
              {(c.unreadCount ?? 0) > 0 && (
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444', position: 'absolute', right: '1.25rem', top: '50%', transform: 'translateY(-50%)', boxShadow: '0 0 10px #EF4444' }}></div>
              )}
            </button>
          ))}
        </div>
      </aside>

      {/* ── Main: Área de Conversación ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#040404', position: 'relative' }}>
        {selectedId ? (
          <>
            {/* Header del Chat */}
            <header style={{ height: '80px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', padding: '0 2rem', justifyContent: 'space-between', background: 'rgba(4,4,4,0.8)', backdropFilter: 'blur(10px)', zIndex: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button 
                  onClick={() => setSidebarOpen(true)} 
                  className="mobile-sidebar-toggle"
                  aria-label="Abrir lista de conversaciones"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                </button>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PersonIcon />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>{selectedConv?.name || formatPhoneDisplay(selectedConv?.phone || '')}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: canSend ? '#4ADE80' : '#EF4444' }}></div>
                    <span style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
                      {canSend ? 'Ventana de 24h activa' : 'Fuera de ventana'}
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', position: 'relative' }}>
                {userRole === 'ORG_ADMIN' && (
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => setShowAssignDropdown(!showAssignDropdown)}
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', color: '#8C8C8C', padding: '0.6rem 1.2rem', borderRadius: '10px', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase' }}
                    >
                      {selectedConv?.assignedToUserId ? 'Reasignar' : 'Asignar'}
                    </button>
                    {showAssignDropdown && (
                      <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '0.5rem', background: '#0D0D0D', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', minWidth: '250px', maxHeight: '300px', overflowY: 'auto', zIndex: 100, boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}>
                        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.65rem', fontWeight: 800, color: '#444', textTransform: 'uppercase' }}>Asignar a:</div>
                        <button onClick={() => handleAssign(null)} style={{ width: '100%', padding: '0.75rem 1rem', background: 'none', border: 'none', color: '#666', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left', display: 'block' }}>
                          Sin asignar
                        </button>
                        {orgUsers.map(u => (
                          <button key={u.id} onClick={() => handleAssign(u.id)} style={{ width: '100%', padding: '0.75rem 1rem', background: selectedConv?.assignedToUserId === u.id ? 'rgba(239,68,68,0.08)' : 'none', border: 'none', color: '#F2F2F2', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left', display: 'block' }}>
                            <span style={{ fontWeight: 700 }}>{u.displayName || u.email}</span>
                            {selectedConv?.assignedToUserId === u.id && <span style={{ color: '#EF4444', marginLeft: '0.5rem', fontSize: '0.65rem' }}>✓</span>}
                          </button>
                        ))}
                        {orgUsers.length === 0 && <div style={{ padding: '1rem', color: '#444', fontSize: '0.75rem', textAlign: 'center' }}>No hay usuarios disponibles</div>}
                      </div>
                    )}
                  </div>
                )}
                <button 
                  onClick={() => setDetailsOpen(!detailsOpen)}
                  style={{ 
                    background: detailsOpen ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.03)', 
                    border: detailsOpen ? '1px solid #EF4444' : '1px solid rgba(255,255,255,0.05)', 
                    color: detailsOpen ? '#EF4444' : '#8C8C8C', 
                    padding: '0.6rem 1.2rem', 
                    borderRadius: '10px', 
                    fontSize: '0.75rem', 
                    fontWeight: 700, 
                    cursor: 'pointer', 
                    transition: 'all 0.2s' 
                  }}
                >
                  VER DETALLES
                </button>
              </div>
            </header>

            {/* Mensajes */}
            <div 
              ref={messagesContainerRef}
              style={{ flex: 1, overflowY: 'auto', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative' }} 
              className="custom-scrollbar"
            >
              {loadingMessages ? (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#040404', zIndex: 5 }}>
                   <div className="pulse-heartbeat">
                    <svg width="60" height="60" viewBox="0 0 24 24" fill="#EF4444">
                      <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <p style={{ marginTop: '1.5rem', fontSize: '0.7rem', fontWeight: 900, color: '#222', textTransform: 'uppercase', letterSpacing: '0.4em' }}>Sincronizando Conversación</p>
                </div>
              ) : (
                <>
                  <div style={{ alignSelf: 'center', background: 'rgba(255,255,255,0.03)', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.7rem', color: '#444', fontWeight: 700, textTransform: 'uppercase' }}>Hoy</div>
                  
                  {messages.map((m) => {
                    const isAgent = !m.fromUser;
                    const hasMedia = !!m.mediaUrl;
                    const isImage = m.type === 'IMAGE';
                    const isVideo = m.type === 'VIDEO';
                    const isAudio = m.type === 'AUDIO';
                    const isDocument = m.type === 'DOCUMENT';
                    const isSticker = isImage && m.mimeType?.toLowerCase() === 'image/webp';

                    return (
                      <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isAgent ? 'flex-end' : 'flex-start', maxWidth: '75%', alignSelf: isAgent ? 'flex-end' : 'flex-start' }}>
                        <div style={{ 
                          padding: (isImage || isVideo) && !m.text ? '0' : '1rem 1.25rem', 
                          borderRadius: isAgent ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                          background: isSticker
                            ? 'transparent'
                            : (isImage || isVideo) && !m.text
                              ? 'transparent'
                              : isAgent 
                                ? 'linear-gradient(135deg, #EF4444 0%, #991B1B 100%)' 
                                : '#1A1A1A',
                          color: 'white',
                          fontSize: '0.95rem',
                          lineHeight: '1.5',
                          boxShadow: isSticker || ((isImage || isVideo) && !m.text) ? 'none' : isAgent ? '0 10px 25px rgba(239, 68, 68, 0.15)' : 'none',
                          border: isSticker || ((isImage || isVideo) && !m.text) ? 'none' : isAgent ? 'none' : '1px solid rgba(255,255,255,0.05)',
                          overflow: 'hidden'
                        }}>
                          {hasMedia && (
                            <div style={{ marginBottom: m.text ? '0.75rem' : '0' }}>
                              {isImage && (
                                <img 
                                  src={m.mediaUrl!} 
                                  alt={m.fileName || "Imagen"} 
                                  onClick={() => setLightboxUrl(m.mediaUrl!)}
                                  style={{ 
                                    maxWidth: isSticker ? '120px' : '100%', 
                                    maxHeight: isSticker ? '120px' : '300px', 
                                    borderRadius: isSticker ? '0' : '16px', 
                                    display: 'block',
                                    objectFit: 'contain',
                                    cursor: 'zoom-in'
                                  }} 
                                />
                              )}
                              {isVideo && (
                                <video 
                                  src={m.mediaUrl!} 
                                  controls 
                                  style={{ 
                                    maxWidth: '100%', 
                                    maxHeight: '300px', 
                                    borderRadius: '16px', 
                                    display: 'block' 
                                  }} 
                                />
                              )}
                              {isAudio && (
                                <audio 
                                  src={m.mediaUrl!} 
                                  controls 
                                  style={{ 
                                    maxWidth: '100%', 
                                    display: 'block' 
                                  }} 
                                />
                              )}
                              {isDocument && (
                                <a 
                                  href={m.mediaUrl!} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '0.75rem', 
                                    color: isAgent ? '#FFF' : '#EF4444', 
                                    textDecoration: 'none', 
                                    background: 'rgba(255,255,255,0.06)',
                                    padding: '0.75rem 1rem',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(255,255,255,0.1)'
                                  }}
                                >
                                  <svg style={{ width: '1.5rem', height: '1.5rem', flexShrink: 0 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                                  </svg>
                                  <span style={{ fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {m.fileName || "Descargar documento"}
                                  </span>
                                </a>
                              )}
                            </div>
                          )}
                          {m.text && <div style={{ wordBreak: 'break-word' }}>{m.text}</div>}
                          {(m as any).isEdited && <div style={{ fontSize: '0.6rem', color: '#888', fontStyle: 'italic', marginTop: '0.2rem' }}>✏️ Editado</div>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.3rem' }}>
                          {isAgent && m.status === 'SENDING' && (
                            <span className={styles.rotateSpinner} style={{ display: 'inline-flex', marginRight: '0.15rem' }}>
                              <svg style={{ width: '0.65rem', height: '0.65rem', color: '#888' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                                <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" />
                                <path style={{ opacity: 0.85 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                            </span>
                          )}
                          <span style={{ fontSize: '0.65rem', color: '#444', fontWeight: 700 }}>
                            {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {isAgent && renderStatus(m.status)}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
              {typingHint && (
                <div style={{ alignSelf: 'flex-start', color: '#EF4444', fontSize: '0.75rem', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div className="typing-dot"></div>
                  {typingHint}
                </div>
              )}
            </div>

            {/* Footer de Entrada */}
            <footer style={{ padding: '1.5rem 2rem', background: '#040404' }}>
              {selectedFile && (
                <div style={{ marginBottom: '0.75rem', padding: '0.75rem', background: '#0D0D0D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {filePreview ? (
                    <img src={filePreview} alt="Preview" style={{ width: '60px', height: '60px', borderRadius: '10px', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '60px', height: '60px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444' }}>
                      <svg style={{ width: '1.8rem', height: '1.8rem' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                      </svg>
                    </div>
                  )}
                  <span style={{ flex: 1, fontSize: '0.8rem', color: '#8C8C8C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedFile.name}</span>
                  <button onClick={clearFileSelection} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '8px', color: '#8C8C8C', padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.7rem' }}>Cancelar</button>
                  <button onClick={handleSendFile} disabled={uploading} style={{ background: '#EF4444', border: 'none', borderRadius: '10px', color: 'white', padding: '0.5rem 1.2rem', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {uploading ? <Spinner size={12} /> : null}
                    {uploading ? 'Subiendo...' : 'Enviar'}
                  </button>
                </div>
              )}
              <div style={{ background: '#0D0D0D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '0.5rem', display: 'flex', alignItems: 'flex-end', gap: '0.5rem', boxShadow: '0 -10px 40px rgba(0,0,0,0.5)' }}>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  style={{ padding: '0.75rem', color: '#666', background: 'none', border: 'none', cursor: 'pointer' }} 
                  title="Adjuntar"
                  disabled={!canSend}
                >
                  <PaperclipIcon />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileSelect} 
                  style={{ display: 'none' }} 
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,audio/mpeg,audio/ogg,audio/wav,application/pdf"
                />
                <textarea 
                  value={replyInput}
                  onChange={(e) => setReplyInput(e.target.value)}
                  onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder={canSend ? "Escribe un mensaje..." : "Ventana de 24h cerrada..."}
                  disabled={!canSend}
                  style={{ flex: 1, background: 'none', border: 'none', padding: '0.75rem 0', color: 'white', outline: 'none', fontSize: '0.95rem', resize: 'none', maxHeight: '150px' }}
                />
                <div style={{ display: 'flex', gap: '0.4rem', padding: '0.25rem' }}>
                  <button 
                    onClick={handleGenerateReply}
                    disabled={generating || !canSend}
                    style={{ padding: '0.75rem', borderRadius: '14px', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', border: 'none', cursor: 'pointer', transition: 'all 0.2s', gap: '0.5rem' }}
                    title="Asistente IA"
                  >
                    {generating ? <Spinner /> : <SparklesIcon />}
                  </button>
                  <button 
                    onClick={handleSend}
                    disabled={sending || !canSend || !replyInput.trim()}
                    style={{ 
                      width: '46px', 
                      height: '46px', 
                      borderRadius: '14px', 
                      background: canSend && replyInput.trim() ? '#EF4444' : '#1A1A1A', 
                      color: 'white', 
                      border: 'none', 
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s',
                      boxShadow: canSend && replyInput.trim() ? '0 8px 20px rgba(239, 68, 68, 0.3)' : 'none',
                      gap: '0.5rem'
                    }}
                  >
                    {sending ? <Spinner /> : <SendIcon />}
                  </button>
                </div>
              </div>
            </footer>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
            <Image src="/assets/images/NOIRLINE2.png" alt="Nextline" width={120} height={120} style={{ filter: 'grayscale(1)', marginBottom: '2rem' }} />
            <p style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em' }}>Selecciona una conversación</p>
          </div>
        )}
      </main>

      {/* ── Sidebar: Detalles de Contacto ── */}
      {detailsOpen && selectedConv && (
        <aside style={{
          width: '340px',
          minWidth: '300px',
          background: '#0d0d0d',
          borderLeft: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          zIndex: 15,
          padding: '1.5rem',
          animation: 'slideInRight 0.3s ease-out',
        }} className="custom-scrollbar">
          {/* Cabecera */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0, color: '#EF4444' }}>
              Detalles
            </h3>
            <button 
              onClick={() => setDetailsOpen(false)}
              style={{ background: 'none', border: 'none', color: '#8C8C8C', cursor: 'pointer', fontSize: '1.2rem', padding: '0.2rem' }}
            >
              ✕
            </button>
          </div>

          {/* Información del Perfil */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '2rem', gap: '0.75rem' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem' }}>
              <PersonIcon style={{ width: '2.5rem', height: '2.5rem' }} />
            </div>
            <div>
              <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem', fontWeight: 800 }}>
                {selectedConv.name || 'Sin Nombre'}
              </h4>
              <span style={{ fontSize: '0.85rem', color: '#666', fontWeight: 600, display: 'block', marginBottom: '0.1rem' }}>
                {formatPhoneDisplay(selectedConv.phone)}
              </span>
              {selectedConv.email && (
                <span style={{ fontSize: '0.75rem', color: '#8C8C8C', fontWeight: 500, display: 'block' }}>
                  {selectedConv.email}
                </span>
              )}
            </div>
          </div>

          {/* Formulario de Edición */}
          <form onSubmit={handleUpdateContact} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '2rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Nombre
              </label>
              <input 
                type="text" 
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nombre del contacto"
                style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.75rem', color: 'white', outline: 'none', fontSize: '0.9rem' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Email
              </label>
              <input 
                type="email" 
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="Email del contacto"
                style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.75rem', color: 'white', outline: 'none', fontSize: '0.9rem' }}
              />
            </div>

            <div style={{ background: 'rgba(239, 68, 68, 0.02)', border: '1px solid rgba(239, 68, 68, 0.1)', borderRadius: '14px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#EF4444', display: 'block', marginBottom: '0.2rem' }}>
                  Sandbox
                </span>
                <p style={{ margin: 0, fontSize: '0.65rem', color: '#666', lineHeight: '1.3' }}>
                  Permitir mensajería en pruebas.
                </p>
              </div>
              <div 
                onClick={() => setEditSandbox(!editSandbox)}
                style={{ 
                  width: '42px', height: '22px', borderRadius: '11px', background: editSandbox ? '#EF4444' : '#1A1A1A', position: 'relative', cursor: 'pointer', transition: 'all 0.3s ease'
                }}
              >
                <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: 'white', position: 'absolute', top: '4px', left: editSandbox ? '24px' : '4px', transition: 'all 0.3s' }}></div>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={updatingContact}
              style={{ width: '100%', padding: '0.75rem', background: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)', border: 'none', borderRadius: '10px', color: 'white', fontWeight: 900, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 5px 15px rgba(239, 68, 68, 0.2)', opacity: updatingContact ? 0.6 : 1 }}
            >
              {updatingContact ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </form>

          {/* Galería de archivos multimedia compartidos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
            <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Archivos y Multimedia
            </label>
            {loadingGallery ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 0' }}>
                <Spinner />
              </div>
            ) : gallery.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: '#666', fontStyle: 'italic', margin: 0 }}>
                No hay archivos compartidos.
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                {gallery.map(g => {
                  if (g.type === 'IMAGE' && g.mediaUrl) {
                    return (
                      <div 
                        key={g.id} 
                        onClick={() => setLightboxUrl(g.mediaUrl!)}
                        style={{ aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.05)', cursor: 'zoom-in' }}
                      >
                        <img src={g.mediaUrl} alt="galería" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    );
                  } else if (g.type === 'VIDEO' && g.mediaUrl) {
                    return (
                      <div key={g.id} style={{ aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                        <video src={g.mediaUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
                        </div>
                      </div>
                    );
                  } else if (g.mediaUrl) {
                    return (
                      <a 
                        key={g.id} 
                        href={g.mediaUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        title={g.fileName || 'Archivo'}
                        style={{ aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', color: '#EF4444', textDecoration: 'none', padding: '0.25rem' }}
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        <span style={{ fontSize: '0.65rem', width: '100%', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#8C8C8C' }}>
                          {g.fileName || 'Doc'}
                        </span>
                      </a>
                    );
                  }
                  return null;
                })}
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Lightbox / Fullscreen Image Preview */}
      {lightboxUrl && (
        <div 
          onClick={() => setLightboxUrl(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(4, 4, 4, 0.95)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            cursor: 'zoom-out',
            backdropFilter: 'blur(10px)',
          }}
        >
          <img 
            src={lightboxUrl} 
            alt="Vista Previa" 
            style={{ 
              maxWidth: '90%', 
              maxHeight: '90%', 
              objectFit: 'contain',
              borderRadius: '8px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
              animation: 'fadeIn 0.2s ease-out'
            }} 
          />
        </div>
      )}

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

        @keyframes typing {
          0% { opacity: .2; }
          20% { opacity: 1; }
          100% { opacity: .2; }
        }
        .typing-dot {
          width: 4px; height: 4px; border-radius: 50%; background: #EF4444;
          animation: typing 1.4s infinite both;
        }

        .mobile-sidebar-toggle {
          display: none;
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.05);
          color: #8C8C8C;
          cursor: pointer;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .mobile-sidebar-toggle:hover {
          background: rgba(255,255,255,0.08);
          color: #F2F2F2;
        }
        @media (max-width: 768px) {
          .mobile-sidebar-toggle { display: flex; }
        }

        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

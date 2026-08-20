'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Socket, io } from 'socket.io-client';
import { isLoggedIn, sendBroadcast, type BroadcastMessageType } from '@/lib/api';
import { Spinner } from '@/shared/ui/spinner';

const WS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/api$/, '');

interface BroadcastProgress {
  total: number;
  sentCount: number;
  failedCount: number;
}

interface FailureItem {
  conversationId: string;
  phone: string;
  name: string | null;
  detail: string;
}

interface CategoryBucket {
  label: string;
  count: number;
  items: FailureItem[];
}

interface SendBroadcastParams {
  conversationIds: string[];
  type: BroadcastMessageType;
  text?: string;
  templateId?: string;
  templateVariables?: Record<string, string>;
  templateAutoNameVariables?: string[];
  templateHeaderValue?: string;
  templateButtonVariables?: Record<string, string>;
}

interface BroadcastProgressContextValue {
  sending: boolean;
  broadcastProgress: BroadcastProgress | null;
  sendError: string;
  sendResultMessage: string;
  clearBroadcastResult: () => void;
  startBroadcastSend: (
    params: SendBroadcastParams,
  ) => Promise<{ sent: number; failed: number; errors: Array<{ conversationId: string; error: string }> }>;
}

const BroadcastProgressContext = createContext<BroadcastProgressContextValue | null>(null);

export function useBroadcastProgress(): BroadcastProgressContextValue {
  const ctx = useContext(BroadcastProgressContext);
  if (!ctx) throw new Error('useBroadcastProgress debe usarse dentro de BroadcastProgressProvider');
  return ctx;
}

/**
 * Vive en el layout del dashboard (no en la página de Masivos) para que la card de
 * progreso y el toast de resultado sobrevivan a la navegación entre pantallas mientras
 * dura un envío masivo.
 */
export function BroadcastProgressProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendResultMessage, setSendResultMessage] = useState('');
  const [broadcastProgress, setBroadcastProgress] = useState<BroadcastProgress | null>(null);
  const [failuresByCategory, setFailuresByCategory] = useState<Map<string, CategoryBucket>>(new Map());
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted || !isLoggedIn()) return;
    const token = localStorage.getItem('chatcontrol_token');
    const socket = io(WS_BASE, { auth: { token: token || '' } });
    socketRef.current = socket;

    socket.on('broadcast_started', (p: { total: number }) => {
      setBroadcastProgress({ total: p.total, sentCount: 0, failedCount: 0 });
    });
    socket.on('broadcast_message_sent', () => {
      setBroadcastProgress(prev => prev ? { ...prev, sentCount: prev.sentCount + 1 } : prev);
    });
    socket.on('broadcast_message_failed', () => {
      setBroadcastProgress(prev => prev ? { ...prev, failedCount: prev.failedCount + 1 } : prev);
    });
    socket.on('message_delivery_failed', (p: {
      conversationId: string; contactPhone: string; contactName: string | null;
      category: string; label: string; detail: string;
    }) => {
      setFailuresByCategory(prev => {
        const next = new Map(prev);
        const existing = next.get(p.category);
        const item: FailureItem = { conversationId: p.conversationId, phone: p.contactPhone, name: p.contactName, detail: p.detail };
        if (existing) {
          next.set(p.category, { ...existing, count: existing.count + 1, items: [...existing.items, item] });
        } else {
          next.set(p.category, { label: p.label, count: 1, items: [item] });
        }
        return next;
      });
    });

    return () => { socket.disconnect(); };
  }, [mounted]);

  const dismissCategory = useCallback((category: string) => {
    setFailuresByCategory(prev => {
      const next = new Map(prev);
      next.delete(category);
      return next;
    });
  }, []);

  const clearBroadcastResult = useCallback(() => {
    setSendError('');
    setSendResultMessage('');
  }, []);

  const startBroadcastSend = useCallback(async (params: SendBroadcastParams) => {
    setSending(true);
    setSendError('');
    setSendResultMessage('');
    try {
      const result = await sendBroadcast(params);
      if (result.sent === 0 && result.failed > 0) {
        setSendError(`No se envió ningún mensaje (${result.failed} fallidos). ${result.errors[0]?.error ?? ''}`);
      } else if (result.failed > 0) {
        setSendError(`${result.sent} enviados, ${result.failed} fallidos. ${result.errors[0]?.error ?? ''}`);
      } else {
        setSendResultMessage(`${result.sent} mensaje${result.sent === 1 ? '' : 's'} enviado${result.sent === 1 ? '' : 's'} correctamente.`);
      }
      return result;
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Error al enviar el masivo.');
      throw err;
    } finally {
      setSending(false);
      setTimeout(() => setBroadcastProgress(null), 4000);
    }
  }, []);

  // Apilado vertical manual: card de progreso -> toast de resultado -> un toast por categoría de fallo.
  const categoryEntries = Array.from(failuresByCategory.entries());
  let stackOffset = 1.5;
  if (broadcastProgress) stackOffset += 8;
  const resultToastVisible = !!(sendError || sendResultMessage);
  const resultToastTop = stackOffset;
  if (resultToastVisible) stackOffset += 5.5;
  const categoryTops = categoryEntries.map(([key]) => {
    const top = stackOffset;
    stackOffset += 5.5;
    return [key, top] as const;
  });
  const openBucket = openCategory ? failuresByCategory.get(openCategory) ?? null : null;

  return (
    <BroadcastProgressContext.Provider
      value={{ sending, broadcastProgress, sendError, sendResultMessage, clearBroadcastResult, startBroadcastSend }}
    >
      {children}

      {broadcastProgress && (
        <div style={{
          position: 'fixed',
          top: '1.5rem',
          right: '1.5rem',
          zIndex: 9999,
          background: '#0d0d0d',
          border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: '16px',
          padding: '1rem 1.25rem',
          minWidth: '220px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          animation: 'fadeIn 0.2s ease-out',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Enviando Masivo
            </span>
            {sending && <Spinner size={14} />}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 900, color: 'white' }}>
              {String(broadcastProgress.sentCount + broadcastProgress.failedCount).padStart(2, '0')}
            </span>
            <span style={{ fontSize: '0.9rem', color: '#666', fontWeight: 700 }}>/ {broadcastProgress.total}</span>
          </div>
          <div style={{ width: '100%', height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{
              width: `${broadcastProgress.total > 0 ? ((broadcastProgress.sentCount + broadcastProgress.failedCount) / broadcastProgress.total) * 100 : 0}%`,
              height: '100%',
              background: broadcastProgress.failedCount > 0 ? 'linear-gradient(90deg, #EF4444, #F59E0B)' : '#EF4444',
              transition: 'width 0.2s ease',
            }} />
          </div>
          {broadcastProgress.failedCount > 0 && (
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.68rem', color: '#F59E0B', fontWeight: 700 }}>
              {broadcastProgress.failedCount} fallido{broadcastProgress.failedCount === 1 ? '' : 's'}
            </p>
          )}
        </div>
      )}

      {resultToastVisible && (
        <div style={{
          position: 'fixed',
          top: `${resultToastTop}rem`,
          right: '1.5rem',
          zIndex: 9999,
          maxWidth: '320px',
          background: sendError ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
          border: `1px solid ${sendError ? 'rgba(239,68,68,0.35)' : 'rgba(34,197,94,0.35)'}`,
          borderRadius: '14px',
          padding: '0.9rem 1.1rem',
          color: sendError ? '#EF4444' : '#4ADE80',
          fontSize: '0.8rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.6rem',
          animation: 'fadeIn 0.2s ease-out',
        }}>
          <span style={{ flex: 1 }}>{sendError || sendResultMessage}</span>
          <button
            onClick={clearBroadcastResult}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '0.9rem', opacity: 0.7, flexShrink: 0 }}
          >
            ✕
          </button>
        </div>
      )}

      {categoryTops.map(([category, top]) => {
        const bucket = failuresByCategory.get(category);
        if (!bucket) return null;
        return (
          <div key={category} style={{
            position: 'fixed',
            top: `${top}rem`,
            right: '1.5rem',
            zIndex: 9999,
            maxWidth: '320px',
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.35)',
            borderRadius: '14px',
            padding: '0.9rem 1.1rem',
            color: '#EF4444',
            fontSize: '0.8rem',
            fontWeight: 600,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            animation: 'fadeIn 0.2s ease-out',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
              <span style={{ flex: 1 }}>
                {bucket.count} contacto{bucket.count === 1 ? '' : 's'} — {bucket.label}
              </span>
              <button
                onClick={() => dismissCategory(category)}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '0.9rem', opacity: 0.7, flexShrink: 0 }}
              >
                ✕
              </button>
            </div>
            <button
              onClick={() => setOpenCategory(category)}
              style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: '#F59E0B', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', padding: 0 }}
            >
              Ver detalles
            </button>
          </div>
        );
      })}

      {openBucket && (
        <div
          onClick={() => setOpenCategory(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#0d0d0d',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: '16px',
              padding: '1.5rem',
              width: '100%',
              maxWidth: '420px',
              maxHeight: '70vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
              animation: 'fadeIn 0.2s ease-out',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#F2F2F2' }}>{openBucket.label}</span>
              <button
                onClick={() => setOpenCategory(null)}
                style={{ background: 'none', border: 'none', color: '#8C8C8C', cursor: 'pointer', fontSize: '1rem' }}
              >
                ✕
              </button>
            </div>
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {openBucket.items.map((item, i) => (
                <div key={`${item.conversationId}-${i}`} style={{
                  padding: '0.6rem 0.75rem',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#F2F2F2' }}>{item.name || 'Sin nombre'}</div>
                  <div style={{ fontSize: '0.75rem', color: '#8C8C8C' }}>{item.phone}</div>
                  <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '0.2rem' }}>{item.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </BroadcastProgressContext.Provider>
  );
}

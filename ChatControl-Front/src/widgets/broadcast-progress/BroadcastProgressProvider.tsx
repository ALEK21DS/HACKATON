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

    return () => { socket.disconnect(); };
  }, [mounted]);

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

      {(sendError || sendResultMessage) && (
        <div style={{
          position: 'fixed',
          top: broadcastProgress ? '9.5rem' : '1.5rem',
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
    </BroadcastProgressContext.Provider>
  );
}

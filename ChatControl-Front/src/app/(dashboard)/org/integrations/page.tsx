'use client';

import { useEffect, useState } from 'react';
import { Spinner } from '@/shared/ui/spinner';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  isLoggedIn,
  getMe,
  getIntegrationStatus,
  updateIntegrations,
  type IntegrationStatus,
} from '@/lib/api';

function MetaIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 5.01 3.657 9.167 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.167 22 17.01 22 12c0-5.523-4.477-10-10-10z"/>
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.908 3.152-1.928 4.176-1.288 1.288-3.136 2.536-6.648 2.536-5.392 0-9.808-4.368-9.808-9.76s4.416-9.76 9.808-9.76c3.144 0 5.688 1.224 7.656 3.12l2.328-2.328C19.344 1.344 16.08 0 12.48 0 5.864 0 .456 5.408.456 12s5.408 12 12.024 12c3.576 0 6.264-1.176 8.36-3.328 2.16-2.16 2.84-5.216 2.84-7.656 0-.76-.072-1.464-.192-2.104H12.48z"/>
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5m7-7-7 7 7 7" />
    </svg>
  );
}

export default function IntegrationsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [waToken, setWaToken] = useState('');
  const [waPhoneId, setWaPhoneId] = useState('');
  const [waWaba, setWaWaba] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingIntegrations, setSavingIntegrations] = useState(false);

  const [showWaToken, setShowWaToken] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login');
      return;
    }
    (async () => {
      try {
        const profile = await getMe();
        if (profile.role !== 'ORG_ADMIN') {
          router.replace('/chat');
          return;
        }
        const s = await getIntegrationStatus();
        setStatus(s);
        if (s.whatsappPhoneNumberId) {
          setWaPhoneId(s.whatsappPhoneNumberId);
        }
      } catch {
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function handleSaveIntegrations(e: React.FormEvent) {
    e.preventDefault();
    setSavingIntegrations(true);
    setErr('');
    setMsg('');
    try {
      const next = await updateIntegrations({
        whatsappAccessToken: waToken || undefined,
        whatsappPhoneNumberId: waPhoneId || undefined,
        whatsappBusinessAccountId: waWaba || undefined,
        geminiApiKey: geminiKey || undefined,
      });
      setStatus(next);
      setWaToken('');
      setGeminiKey('');
      setMsg('Integraciones guardadas correctamente.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSavingIntegrations(false);
    }
  }

  if (loading) {
    return (
      <div className="page-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="pulse-heartbeat" style={{ marginBottom: '1.5rem' }}>
          <svg width="60" height="60" viewBox="0 0 24 24" fill="#EF4444">
            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#222', textTransform: 'uppercase', letterSpacing: '0.4em' }}>Sincronizando Integraciones</span>
        <style jsx>{`
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

  return (
    <div className="page-container">
      {/* Navigation header */}
      <Link
        href="/chat"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          color: '#8C8C8C',
          fontSize: '0.8rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          textDecoration: 'none',
          marginBottom: '1.5rem',
          transition: 'color 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#F2F2F2')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#8C8C8C')}
      >
        <BackIcon /> Volver al chat
      </Link>

      <header style={{ marginBottom: '2.5rem' }}>
        <h1 style={{
          fontSize: '1.75rem',
          fontWeight: 900,
          color: '#F2F2F2',
          marginBottom: '0.5rem',
          textTransform: 'uppercase',
          letterSpacing: '0.02em',
        }}>
          Integraciones y Detección de Leads
        </h1>
        <p style={{ color: '#8C8C8C', fontSize: '0.9rem' }}>
          Configura las conexiones API y la detección automática de nuevos prospectos.
        </p>
      </header>

      {err && (
        <div style={{
          padding: '1rem',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: 12,
          color: '#EF4444',
          fontSize: '0.85rem',
          marginBottom: '1.5rem',
        }}>
          {err}
        </div>
      )}
      {msg && (
        <div style={{
          padding: '1rem',
          background: 'rgba(74, 222, 128, 0.1)',
          border: '1px solid rgba(74, 222, 128, 0.2)',
          borderRadius: 12,
          color: '#4ADE80',
          fontSize: '0.85rem',
          marginBottom: '1.5rem',
        }}>
          {msg}
        </div>
      )}

      {/* ── Status Cards ── */}
      {status && (
        <div className="status-cards" style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '2.5rem',
          padding: '1.25rem',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(64,64,64,0.3)',
          borderRadius: 16,
        }}>
          <div style={{ flex: 1 }}>
            <span style={{
              fontSize: '0.7rem',
              color: '#8C8C8C',
              fontWeight: 700,
              textTransform: 'uppercase',
              display: 'block',
              marginBottom: '0.5rem',
            }}>
              WhatsApp (Meta)
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: (status.hasWhatsappToken && status.hasWhatsappBusinessAccountId) ? '#4ADE80' : '#EF4444',
                boxShadow: `0 0 10px ${(status.hasWhatsappToken && status.hasWhatsappBusinessAccountId) ? 'rgba(74, 222, 128, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
              }} />
              <span style={{ fontSize: '0.9rem', color: '#F2F2F2', fontWeight: 600 }}>
                {(status.hasWhatsappToken && status.hasWhatsappBusinessAccountId) ? 'ACTIVO' : 'INCOMPLETO'}
              </span>
              {status.whatsappPhoneNumberId && (
                <span style={{ fontSize: '0.75rem', color: '#8C8C8C' }}>
                  (ID: {status.whatsappPhoneNumberId})
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#8C8C8C', marginTop: '0.25rem' }}>
              • Token: {status.hasWhatsappToken ? 'Configurado ✅' : 'Pendiente ❌'}<br />
              • WABA ID: {status.hasWhatsappBusinessAccountId ? 'Configurado ✅' : 'Pendiente (Requerido para plantillas) ❌'}
            </div>
          </div>
          <div style={{ width: '1px', background: 'rgba(64,64,64,0.3)' }} />
          <div style={{ flex: 1 }}>
            <span style={{
              fontSize: '0.7rem',
              color: '#8C8C8C',
              fontWeight: 700,
              textTransform: 'uppercase',
              display: 'block',
              marginBottom: '0.5rem',
            }}>
              Inteligencia Artificial (Google)
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: status.hasGeminiKey ? '#4ADE80' : '#EF4444',
                boxShadow: `0 0 10px ${status.hasGeminiKey ? 'rgba(74, 222, 128, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
              }} />
              <span style={{ fontSize: '0.9rem', color: '#F2F2F2', fontWeight: 600 }}>
                {status.hasGeminiKey ? 'ACTIVO' : 'PENDIENTE'}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#8C8C8C' }}>
                {status.hasGeminiKey ? '(Modelo Sincronizado)' : '(Sin configurar)'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Integrations Form ── */}
      <form onSubmit={handleSaveIntegrations} style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginBottom: '3rem' }}>
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(64,64,64,0.3)',
          borderRadius: 16,
          padding: '1.5rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ padding: '0.5rem', background: 'rgba(6, 104, 250, 0.1)', borderRadius: 10, color: '#0668FA' }}>
              <MetaIcon className="w-5 h-5" />
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#F2F2F2', margin: 0 }}>
              Meta for Developers (WhatsApp)
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.8rem', color: '#8C8C8C', fontWeight: 600, textTransform: 'uppercase' }}>
                WhatsApp Access Token
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showWaToken ? 'text' : 'password'}
                  value={waToken}
                  onChange={(e) => setWaToken(e.target.value)}
                  placeholder="••••••••••••••••••••••••••••••••"
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(64,64,64,0.3)',
                    borderRadius: 10,
                    padding: '0.85rem 3rem 0.85rem 1rem',
                    color: '#F2F2F2',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowWaToken(!showWaToken)}
                  style={{
                    position: 'absolute',
                    right: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#8C8C8C',
                    cursor: 'pointer',
                  }}
                >
                  {showWaToken ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                </button>
              </div>
              <span style={{ fontSize: '0.7rem', color: '#666' }}>
                Usa un token de acceso permanente de tu App en Meta.
              </span>
            </div>

            <div className="grid-2">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.8rem', color: '#8C8C8C', fontWeight: 600, textTransform: 'uppercase' }}>
                  Phone Number ID
                </label>
                <input
                  type="text"
                  value={waPhoneId}
                  onChange={(e) => setWaPhoneId(e.target.value)}
                  placeholder="Ej: 1029384756..."
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(64,64,64,0.3)',
                    borderRadius: 10,
                    padding: '0.85rem 1rem',
                    color: '#F2F2F2',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.8rem', color: '#8C8C8C', fontWeight: 600, textTransform: 'uppercase' }}>
                  WABA ID (Requerido para plantillas)
                </label>
                <input
                  type="text"
                  value={waWaba}
                  onChange={(e) => setWaWaba(e.target.value)}
                  placeholder="Ej: 5647382910..."
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(64,64,64,0.3)',
                    borderRadius: 10,
                    padding: '0.85rem 1rem',
                    color: '#F2F2F2',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(64,64,64,0.3)',
          borderRadius: 16,
          padding: '1.5rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ padding: '0.5rem', background: 'rgba(234, 67, 53, 0.1)', borderRadius: 10, color: '#EA4335' }}>
              <GoogleIcon className="w-5 h-5" />
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#F2F2F2', margin: 0 }}>
              Google AI Studio (Gemini)
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.8rem', color: '#8C8C8C', fontWeight: 600, textTransform: 'uppercase' }}>
              Gemini API Key
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showGeminiKey ? 'text' : 'password'}
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="••••••••••••••••••••••••••••••••"
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(64,64,64,0.3)',
                  borderRadius: 10,
                  padding: '0.85rem 3rem 0.85rem 1rem',
                  color: '#F2F2F2',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={() => setShowGeminiKey(!showGeminiKey)}
                style={{
                  position: 'absolute',
                  right: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#8C8C8C',
                  cursor: 'pointer',
                }}
              >
                {showGeminiKey ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
              </button>
            </div>
            <span style={{ fontSize: '0.7rem', color: '#666' }}>
              Consigue tu API Key en Google AI Studio para activar las respuestas inteligentes.
            </span>
          </div>
        </div>

        <button
          type="submit"
          disabled={savingIntegrations}
          style={{
            padding: '1rem',
            background: savingIntegrations ? '#1A1A1A' : 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)',
            border: 'none',
            borderRadius: 12,
            color: savingIntegrations ? '#444' : 'white',
            fontSize: '0.9rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            cursor: savingIntegrations ? 'not-allowed' : 'pointer',
            boxShadow: savingIntegrations ? 'none' : '0 4px 15px rgba(239, 68, 68, 0.3)',
            transition: 'all 0.2s ease',
            alignSelf: 'flex-start',
            minWidth: '220px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          }}
        >
          {savingIntegrations ? <><Spinner /> Guardando...</> : 'Guardar Integraciones'}
        </button>
      </form>

      <style jsx>{`
        .page-container {
          padding: 2rem 3rem;
          width: 100%;
          margin: 0;
        }
        @media (max-width: 1024px) {
          .page-container { padding: 1.5rem 2rem; }
        }
        @media (max-width: 768px) {
          .page-container { padding: 1.25rem; }
        }
        @media (max-width: 480px) {
          .page-container { padding: 1rem; }
        }
      `}</style>
    </div>
  );
}

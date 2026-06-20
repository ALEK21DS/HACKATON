'use client';

import { useEffect, useState } from 'react';
import { Spinner } from '@/shared/ui/spinner';
import { useRouter } from 'next/navigation';
import {
  isLoggedIn,
  getSettings,
  updateSettings,
  syncWhatsappLimit,
  getMe,
  type SettingsData,
  type WhatsappTier,
} from '@/lib/api';
import styles from '../chat/chat.module.css';
import broadcastStyles from '../broadcast/broadcast.module.css';

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

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [whatsappTier, setWhatsappTier] = useState<WhatsappTier>('new');
  const [geminiModel, setGeminiModel] = useState('');
  const [myRole, setMyRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSyncLimit = async () => {
    setSyncing(true);
    setError('');
    setSuccess('');
    try {
      const res = await syncWhatsappLimit();
      setWhatsappTier(res.whatsappTier);
      setSettings(prev => prev ? {
        ...prev,
        whatsappTier: res.whatsappTier,
        dailyLimit: res.dailyLimit
      } : null);
      setSuccess(`Límites sincronizados correctamente desde Meta. Nivel: ${TIER_LABELS[res.whatsappTier]}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al sincronizar con Meta');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

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
        const profile = await getMe();
        setMyRole(profile.role);
        const data = await getSettings();
        setSettings(data);
        setWhatsappTier(data.whatsappTier);
        setGeminiModel(data.geminiModel || 'gemini-2.5-flash');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar configuración');
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

  if (!mounted || !isLoggedIn()) return null;

  return (
    <div className="page-container">
      <header style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#F2F2F2', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
          Configuración General
        </h1>
        <p style={{ color: '#8C8C8C', fontSize: '0.9rem' }}>
          Administra las capacidades de envío y el cerebro de inteligencia artificial de tu plataforma.
        </p>
      </header>
      
      {error && <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 12, color: '#EF4444', marginBottom: '1.5rem', fontSize: '0.85rem' }}>{error}</div>}
      {success && <div style={{ padding: '1rem', background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.2)', borderRadius: 12, color: '#4ADE80', marginBottom: '1.5rem', fontSize: '0.85rem' }}>{success}</div>}
      
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8rem 0', gap: '1.5rem' }}>
          <div className="pulse-heartbeat">
            <svg width="60" height="60" viewBox="0 0 24 24" fill="#EF4444">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#222', textTransform: 'uppercase', letterSpacing: '0.4em' }}>Sincronizando con el servidor</span>
        </div>
      ) : (
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* WhatsApp Tier Card */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(64,64,64,0.3)', borderRadius: 16, padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ padding: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 10, color: '#EF4444' }}>
                <GlobeIcon className="w-5 h-5" />
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#F2F2F2', margin: 0 }}>Límites de WhatsApp</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <label htmlFor="whatsapp-tier" style={{ fontSize: '0.8rem', color: '#8C8C8C', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Tier de Conversaciones
                </label>
                <button
                  type="button"
                  disabled={syncing || myRole === 'AGENT'}
                  onClick={handleSyncLimit}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#EF4444',
                    padding: '0.3rem 0.75rem',
                    borderRadius: '8px',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    cursor: (syncing || myRole === 'AGENT') ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    transition: 'all 0.2s ease',
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em',
                  }}
                  onMouseOver={(e) => {
                    if (myRole !== 'AGENT') {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                      e.currentTarget.style.borderColor = '#EF4444';
                    }
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                  }}
                >
                  {syncing ? <Spinner size={14} /> : (
                    <svg style={{ width: '0.7rem', height: '0.7rem' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                    </svg>
                  )}
                  {syncing ? 'Sincronizando...' : 'Sincronizar con Meta'}
                </button>
              </div>
              <select
                id="whatsapp-tier"
                value={whatsappTier}
                disabled={myRole === 'AGENT'}
                onChange={(e) => setWhatsappTier(e.target.value as WhatsappTier)}
                style={{ 
                  width: '100%', 
                  background: 'rgba(255,255,255,0.05)', 
                  border: '1px solid rgba(64,64,64,0.3)', 
                  borderRadius: 10, 
                  padding: '0.85rem 1rem', 
                  color: '#F2F2F2',
                  fontSize: '0.95rem',
                  outline: 'none',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23EF4444' stroke-width='3'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 1rem center',
                  backgroundSize: '1.25rem',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s ease'
                }}
              >
                {(Object.keys(TIER_LABELS) as WhatsappTier[]).map((t) => (
                  <option key={t} value={t} style={{ background: '#0d0d0d', padding: '1rem' }}>
                    {TIER_LABELS[t]}
                  </option>
                ))}
              </select>
              {settings && (
                <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.05)', borderRadius: 8, display: 'inline-block' }}>
                  <span style={{ fontSize: '0.8rem', color: '#EF4444', fontWeight: 700 }}>
                    Capacidad actual: {settings.dailyLimit == null ? 'ILIMITADO' : `${settings.dailyLimit.toLocaleString()} mensajes / día`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* AI Brain Card */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(64,64,64,0.3)', borderRadius: 16, padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ padding: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 10, color: '#EF4444' }}>
                <SparklesIcon className="w-5 h-5" />
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#F2F2F2', margin: 0 }}>Cerebro IA (Gemini)</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label htmlFor="gemini-model" style={{ fontSize: '0.8rem', color: '#8C8C8C', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Modelo de Lenguaje
                </label>
                <select
                  id="gemini-model"
                  value={GEMINI_MODELS.includes(geminiModel) ? geminiModel : '_custom'}
                  onChange={(e) => {
                    if (e.target.value !== '_custom') setGeminiModel(e.target.value);
                  }}
                  style={{ 
                    width: '100%', 
                    background: 'rgba(255,255,255,0.05)', 
                    border: '1px solid rgba(64,64,64,0.3)', 
                    borderRadius: 10, 
                    padding: '0.85rem 1rem', 
                    color: '#F2F2F2',
                    fontSize: '0.95rem',
                    outline: 'none',
                    appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23EF4444' stroke-width='3'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 1rem center',
                    backgroundSize: '1.25rem',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s ease'
                  }}
                >
                  {GEMINI_MODELS.map((m) => (
                    <option key={m} value={m} style={{ background: '#0d0d0d', padding: '1rem' }}>
                      {m}
                    </option>
                  ))}
                  <option value="_custom" style={{ background: '#0d0d0d' }}>Personalizado...</option>
                </select>
              </div>

              {!GEMINI_MODELS.includes(geminiModel) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                   <label style={{ fontSize: '0.7rem', color: '#8C8C8C' }}>Nombre del modelo personalizado</label>
                   <input
                    type="text"
                    placeholder="Ej: gemini-3.0-ultra"
                    value={geminiModel}
                    onChange={(e) => setGeminiModel(e.target.value)}
                    style={{ 
                      width: '100%', 
                      background: 'rgba(255,255,255,0.05)', 
                      border: '1px solid rgba(64,64,64,0.3)', 
                      borderRadius: 8, 
                      padding: '0.75rem', 
                      color: '#F2F2F2',
                      fontSize: '0.9rem',
                      outline: 'none'
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          <button 
            type="submit" 
            disabled={saving || myRole === 'AGENT'} 
            style={{ 
              marginTop: '1rem',
              padding: '1rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              background: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)',
              border: 'none',
              borderRadius: 12,
              color: 'white',
              fontSize: '0.9rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              cursor: (saving || myRole === 'AGENT') ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)',
              opacity: myRole === 'AGENT' ? 0.6 : 1,
              transition: 'all 0.2s ease'
            }}
          >
            {saving ? <><Spinner /> Guardando Cambios...</> : myRole === 'AGENT' ? 'Vista de Solo Lectura' : 'Guardar Configuración'}
          </button>
        </form>
      )}
    </div>
  );
}

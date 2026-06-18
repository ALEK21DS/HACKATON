'use client';

import { useEffect, useState } from 'react';
import { Spinner } from '@/shared/ui/spinner';
import { useRouter } from 'next/navigation';
import {
  isLoggedIn,
  getMe,
  getCampaigns,
  createCampaign,
  activateCampaign,
  deleteCampaign,
  type Campaign,
} from '@/lib/api';

export default function CampaignsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [myRole, setMyRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadCampaigns = async () => {
    try {
      const data = await getCampaigns();
      setCampaigns(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar campañas');
    }
  };

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
        await loadCampaigns();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar datos');
      } finally {
        setLoading(false);
      }
    })();
  }, [mounted, router]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      await createCampaign({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setName('');
      setDescription('');
      setSuccess('Campaña creada y activada correctamente.');
      await loadCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear campaña');
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivate = async (id: string) => {
    setError('');
    setSuccess('');
    try {
      await activateCampaign(id);
      setSuccess('Campaña activada correctamente.');
      await loadCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al activar campaña');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta campaña?')) return;
    setError('');
    setSuccess('');
    try {
      await deleteCampaign(id);
      setSuccess('Campaña eliminada correctamente.');
      await loadCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar campaña');
    }
  };

  if (!mounted || !isLoggedIn()) return null;

  return (
    <div className="page-container" style={{ width: '100%', padding: '2rem 3rem' }}>
      <header style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#F2F2F2', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
          Campañas
        </h1>
        <p style={{ color: '#8C8C8C', fontSize: '0.9rem' }}>
          Administra las campañas activas e historial de campañas para tu organización.
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
          <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#222', textTransform: 'uppercase', letterSpacing: '0.4em' }}>Sincronizando Campañas</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          
          {/* Formulario de Creación (Solo ORG_ADMIN) */}
          {myRole === 'ORG_ADMIN' && (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(64,64,64,0.3)', borderRadius: 16, padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#F2F2F2', marginBottom: '1.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Crear Nueva Campaña
              </h3>
              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label htmlFor="campaign-name" style={{ fontSize: '0.8rem', color: '#8C8C8C', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Nombre de la Campaña
                  </label>
                  <input
                    id="campaign-name"
                    type="text"
                    required
                    placeholder="Ej: Campaña de Ventas Junio 2026"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(64,64,64,0.3)',
                      borderRadius: 10,
                      padding: '0.85rem 1rem',
                      color: '#F2F2F2',
                      fontSize: '0.95rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label htmlFor="campaign-desc" style={{ fontSize: '0.8rem', color: '#8C8C8C', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Descripción (Opcional)
                  </label>
                  <textarea
                    id="campaign-desc"
                    placeholder="Descripción o propósito de esta campaña..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(64,64,64,0.3)',
                      borderRadius: 10,
                      padding: '0.85rem 1rem',
                      color: '#F2F2F2',
                      fontSize: '0.95rem',
                      outline: 'none',
                      resize: 'none',
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    alignSelf: 'flex-start',
                    padding: '0.85rem 2rem',
                    background: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)',
                    border: 'none',
                    borderRadius: 12,
                    color: 'white',
                    fontSize: '0.85rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {submitting ? <><Spinner size={14} /> Creando...</> : 'Crear y Activar'}
                </button>
              </form>
            </div>
          )}

          {/* Historial de Campañas */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(64,64,64,0.3)', borderRadius: 16, padding: '1.5rem', overflow: 'hidden' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#F2F2F2', marginBottom: '1.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Historial de Campañas
            </h3>

            {campaigns.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#666' }}>
                No hay campañas creadas para esta organización.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <th style={{ padding: '1rem', color: '#8C8C8C', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nombre</th>
                      <th style={{ padding: '1rem', color: '#8C8C8C', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Descripción</th>
                      <th style={{ padding: '1rem', color: '#8C8C8C', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estado</th>
                      <th style={{ padding: '1rem', color: '#8C8C8C', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fecha de Creación</th>
                      {myRole === 'ORG_ADMIN' && <th style={{ padding: '1rem', color: '#8C8C8C', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Acciones</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((c) => (
                      <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.01)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '1rem', fontSize: '0.9rem', fontWeight: 700, color: c.isActive ? '#FFF' : '#F2F2F2', opacity: c.isActive ? 1 : 0.75 }}>
                          {c.name}
                        </td>
                        <td style={{ padding: '1rem', fontSize: '0.85rem', color: '#8C8C8C', opacity: c.isActive ? 1 : 0.75 }}>
                          {c.description || '-'}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          {c.isActive ? (
                            <span style={{ padding: '0.3rem 0.75rem', background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.2)', borderRadius: '20px', color: '#4ADE80', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Activo
                            </span>
                          ) : (
                            <span style={{ padding: '0.3rem 0.75rem', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '20px', color: '#8C8C8C', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Inactivo
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '1rem', fontSize: '0.85rem', color: '#666' }}>
                          {new Date(c.createdAt).toLocaleDateString()} {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        {myRole === 'ORG_ADMIN' && (
                          <td style={{ padding: '1rem', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '0.75rem' }}>
                              {!c.isActive && (
                                <button
                                  onClick={() => handleActivate(c.id)}
                                  style={{
                                    padding: '0.4rem 1rem',
                                    background: 'rgba(74, 222, 128, 0.1)',
                                    border: '1px solid #4ADE80',
                                    borderRadius: '8px',
                                    color: '#4ADE80',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = '#4ADE80'; e.currentTarget.style.color = '#000'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(74, 222, 128, 0.1)'; e.currentTarget.style.color = '#4ADE80'; }}
                                >
                                  Activar
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(c.id)}
                                style={{
                                  padding: '0.4rem 1rem',
                                  background: 'rgba(239, 68, 68, 0.05)',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  borderRadius: '8px',
                                  color: '#EF4444',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = '#EF4444'; e.currentTarget.style.color = '#FFF'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)'; e.currentTarget.style.color = '#EF4444'; }}
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

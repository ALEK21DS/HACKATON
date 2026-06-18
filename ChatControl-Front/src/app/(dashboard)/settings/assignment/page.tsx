'use client';

import { useEffect, useState } from 'react';
import { Spinner } from '@/shared/ui/spinner';
import { useRouter } from 'next/navigation';
import {
  isLoggedIn,
  getMe,
  getOrgUsers,
  getLeadDetectionConfig,
  updateLeadDetectionConfig,
} from '@/lib/api';

type AgentInTurn = {
  id: string;
  email: string;
  displayName: string | null;
  isNext: boolean;
};

// --- Icons ---
function PersonIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg style={{ width: '1.1rem', height: '1.1rem', ...style }} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg width="1.2rem" height="1.2rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg width="1.2rem" height="1.2rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="1.1rem" height="1.1rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="1.1rem" height="1.1rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="1.1rem" height="1.1rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export default function AssignmentPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [allOrgUsers, setAllOrgUsers] = useState<any[]>([]);
  const [assignedAgents, setAssignedAgents] = useState<AgentInTurn[]>([]);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!isLoggedIn()) { router.replace('/login'); return; }
    (async () => {
      setLoading(true);
      try {
        const me = await getMe();
        if (me.role !== 'ORG_ADMIN') { router.replace('/settings'); return; }
        const users = await getOrgUsers();
        setAllOrgUsers(users);

        // Cargar configuración de asignación del backend
        const leadConfig = await getLeadDetectionConfig();
        setIsEnabled(leadConfig.enabled);

        if (leadConfig.autoMessage) {
          try {
            const parsed = JSON.parse(leadConfig.autoMessage);
            const agentIds: string[] = parsed.agentIds || [];
            const nextAgentId: string | null = parsed.nextAgentId || null;

            const mappedAgents: AgentInTurn[] = agentIds
              .map(id => {
                const u = users.find((user: any) => user.id === id);
                if (!u) return null;
                return {
                  id: u.id,
                  email: u.email,
                  displayName: u.displayName,
                  isNext: u.id === nextAgentId,
                };
              })
              .filter((a): a is AgentInTurn => a !== null);

            // Si hay agentes asignados pero ninguno marcado como isNext, marcar el primero
            if (mappedAgents.length > 0 && !mappedAgents.some(a => a.isNext)) {
              mappedAgents[0].isNext = true;
            }

            setAssignedAgents(mappedAgents);
          } catch (e) {
            console.error('Error parsing lead config autoMessage', e);
            setAssignedAgents([]);
          }
        } else {
          setAssignedAgents([]);
        }
      } catch (err) {
        console.error('Error fetching assignment config', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [mounted, router]);

  const addAgent = (user: any) => {
    if (assignedAgents.some(a => a.id === user.id)) return;
    const newAgent: AgentInTurn = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      isNext: assignedAgents.length === 0
    };
    setAssignedAgents([...assignedAgents, newAgent]);
    // No cerramos el modal para permitir agregar múltiples rápidamente si se desea
  };

  const removeAgent = (id: string) => {
    setAssignedAgents(prev => {
      const filtered = prev.filter(a => a.id !== id);
      if (prev.find(a => a.id === id)?.isNext && filtered.length > 0) {
        filtered[0].isNext = true;
      }
      return filtered;
    });
  };

  const moveAgent = (index: number, direction: 'up' | 'down') => {
    const newAgents = [...assignedAgents];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newAgents.length) return;
    [newAgents[index], newAgents[targetIndex]] = [newAgents[targetIndex], newAgents[index]];
    setAssignedAgents(newAgents);
  };

  const setNext = (id: string) => {
    setAssignedAgents(prev => prev.map(a => ({ ...a, isNext: a.id === id })));
  };

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setSuccessMessage('');
    setErrorMessage('');
    try {
      const agentIds = assignedAgents.map(a => a.id);
      const nextAgentId = assignedAgents.find(a => a.isNext)?.id || null;
      await updateLeadDetectionConfig({
        enabled: isEnabled,
        autoMessage: JSON.stringify({ agentIds, nextAgentId }),
      });
      setSuccessMessage('Configuración guardada con éxito.');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
      setErrorMessage('Error al guardar: ' + (err.message || 'Error de red'));
    } finally {
      setSaving(false);
    }
  };

  // Logic for Modal List
  const filteredUsers = allOrgUsers.filter(u => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = (u.displayName?.toLowerCase().includes(query) || u.email.toLowerCase().includes(query));
    return matchesSearch;
  });

  const totalPages = Math.ceil(filteredUsers.length / pageSize);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (!mounted || !isLoggedIn()) return null;

  return (
    <div className="page-container">
      <header style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#F2F2F2', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
          Distribución de Leads
        </h1>
        <p style={{ color: '#8C8C8C', fontSize: '0.9rem' }}>
          Configura la equidad de atención al cliente para tu equipo comercial.
        </p>
      </header>

      {successMessage && (
        <div style={{ padding: '1rem', background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.2)', borderRadius: 12, color: '#4ADE80', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 12, color: '#EF4444', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
          {errorMessage}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8rem 0', gap: '1.5rem' }}>
          <div className="pulse-heartbeat">
            <svg width="60" height="60" viewBox="0 0 24 24" fill="#EF4444">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#222', textTransform: 'uppercase', letterSpacing: '0.4em' }}>Sincronizando Sistema</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <div style={{ background: 'rgba(239, 68, 68, 0.03)', border: '1px solid rgba(239, 68, 68, 0.1)', borderRadius: '24px', padding: '2rem', display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#EF4444', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Habilitar Round Robin</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#666', lineHeight: '1.5' }}>
                Solo los usuarios seleccionados participarán en la rotación de nuevos prospectos.
              </p>
            </div>
            <div 
              onClick={() => setIsEnabled(!isEnabled)}
              style={{ 
                width: '64px', height: '32px', borderRadius: '16px', background: isEnabled ? '#EF4444' : '#1A1A1A', position: 'relative', cursor: 'pointer', transition: 'all 0.3s ease',
                boxShadow: isEnabled ? '0 0 20px rgba(239, 68, 68, 0.4)' : 'none'
              }}
            >
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'white', position: 'absolute', top: '4px', left: isEnabled ? '36px' : '4px', transition: 'all 0.3s ease' }}></div>
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 900, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Agentes en Rotación</h3>
              <button 
                onClick={() => setShowModal(true)}
                style={{ 
                  padding: '0.7rem 1.5rem', background: '#F2F2F2', border: 'none', borderRadius: '12px', color: '#040404', 
                  fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', 
                  display: 'flex', alignItems: 'center', gap: '0.5rem'
                }}
              >
                <PlusIcon /> Seleccionar Integrantes
              </button>
            </div>

            {assignedAgents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', background: 'rgba(255,255,255,0.01)', borderRadius: '20px', border: '1px dashed rgba(255,255,255,0.05)' }}>
                <p style={{ color: '#444', fontSize: '0.85rem', margin: 0 }}>No hay agentes asignados a la rotación.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {assignedAgents.map((agent, index) => (
                  <div 
                    key={agent.id}
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1rem 1.25rem', background: agent.isNext ? 'rgba(239, 68, 68, 0.05)' : 'rgba(255,255,255,0.01)', 
                      border: agent.isNext ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(255,255,255,0.05)', borderRadius: '16px'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <button onClick={() => moveAgent(index, 'up')} disabled={index === 0} style={{ background: 'none', border: 'none', color: index === 0 ? 'transparent' : '#444', cursor: 'pointer' }}><ArrowUpIcon /></button>
                      <button onClick={() => moveAgent(index, 'down')} disabled={index === assignedAgents.length - 1} style={{ background: 'none', border: 'none', color: index === assignedAgents.length - 1 ? 'transparent' : '#444', cursor: 'pointer' }}><ArrowDownIcon /></button>
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '1rem', fontWeight: 700, color: '#F2F2F2' }}>{agent.displayName || 'Agente'}</span>
                      <span style={{ fontSize: '0.75rem', color: '#666', marginLeft: '1rem' }}>{agent.email}</span>
                    </div>
                    {agent.isNext && <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#EF4444', textTransform: 'uppercase', padding: '4px 10px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px' }}>Próximo</span>}
                    <button onClick={() => setNext(agent.id)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#666', fontSize: '0.6rem', padding: '4px 8px', cursor: 'pointer' }}>Saltar turno</button>
                    <button onClick={() => removeAgent(agent.id)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}><TrashIcon /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button onClick={handleSave} disabled={saving || assignedAgents.length === 0} style={{ padding: '1.25rem', background: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)', border: 'none', borderRadius: '16px', color: 'white', fontWeight: 900, cursor: 'pointer', boxShadow: '0 10px 30px rgba(239, 68, 68, 0.3)', opacity: assignedAgents.length === 0 ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            {saving ? <><Spinner /> GUARDANDO...</> : 'GUARDAR CONFIGURACIÓN'}
          </button>
        </div>
      )}

      {/* SELECTION MODAL */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem' }}>
          <div style={{ background: '#080808', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '28px', width: '100%', maxWidth: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            
            <div style={{ padding: '2rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#F2F2F2', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Seleccionar Integrantes</h2>
                <p style={{ fontSize: '0.8rem', color: '#444', margin: '4px 0 0' }}>Agrega usuarios a la lista de rotación automática.</p>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', color: '#8C8C8C', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>×</button>
            </div>

            <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#444' }}><SearchIcon /></div>
                <input 
                  type="text" 
                  placeholder="Buscar por nombre o correo..." 
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  style={{ width: '100%', background: '#000', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '0.85rem 1rem 0.85rem 3rem', color: '#F2F2F2', fontSize: '0.9rem', outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
              {paginatedUsers.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#444' }}>No se encontraron usuarios.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {paginatedUsers.map((u) => {
                    const isAdded = assignedAgents.some(a => a.id === u.id);
                    return (
                      <div 
                        key={u.id}
                        style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1rem', borderRadius: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid transparent', transition: 'all 0.2s' }}
                      >
                        <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444' }}>
                          <PersonIcon />
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{ display: 'block', fontSize: '0.9rem', color: '#F2F2F2', fontWeight: 600 }}>{u.displayName || 'Sin Nombre'}</span>
                          <span style={{ fontSize: '0.75rem', color: '#666' }}>{u.email}</span>
                        </div>
                        {isAdded ? (
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#4ADE80', textTransform: 'uppercase', padding: '4px 10px', background: 'rgba(74, 222, 128, 0.1)', borderRadius: '8px' }}>✓ Añadido</span>
                        ) : (
                          <button 
                            onClick={() => addAgent(u)}
                            style={{ padding: '0.5rem 1rem', background: '#F2F2F2', border: 'none', borderRadius: '10px', color: '#000', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer' }}
                          >
                            + Añadir
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {totalPages > 1 && (
              <div style={{ padding: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem' }}>
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '8px', color: '#8C8C8C', fontSize: '0.7rem', fontWeight: 800, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                >
                  ANTERIOR
                </button>
                <span style={{ fontSize: '0.75rem', color: '#444', fontWeight: 800 }}>PÁGINA {currentPage} DE {totalPages}</span>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '8px', color: '#8C8C8C', fontSize: '0.7rem', fontWeight: 800, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                >
                  SIGUIENTE
                </button>
              </div>
            )}

            <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', textAlign: 'center' }}>
              <button 
                onClick={() => setShowModal(false)}
                style={{ width: '100%', padding: '0.85rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', color: '#F2F2F2', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
              >
                FINALIZAR SELECCIÓN
              </button>
            </div>

          </div>
        </div>
      )}

      <style jsx global>{`
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.1); }
      `}</style>

    </div>
  );
}

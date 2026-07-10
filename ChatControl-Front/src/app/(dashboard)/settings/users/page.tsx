'use client';

import { useEffect, useState } from 'react';
import { Spinner } from '@/shared/ui/spinner';
import { useRouter } from 'next/navigation';
import {
  isLoggedIn,
  getMe,
  getOrgUsers,
  createOrgUser,
  updateOrgUser,
  resetOrgUserPassword,
  deactivateOrgUser,
  reactivateOrgUser,
  type UserRole,
} from '../../../../lib/api';

type OrgUserRow = { id: string; email: string; displayName: string | null; role: UserRole; isActive: boolean; createdAt: string };

// --- Icons ---
function SearchIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg style={{ width: '1.1rem', height: '1.1rem', ...style }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function PlusIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg style={{ width: '1rem', height: '1rem', ...style }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14m-7-7v14" />
    </svg>
  );
}

function PersonIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg style={{ width: '1rem', height: '1rem', ...style }} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );
}

function FilterIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg style={{ width: '1rem', height: '1rem', ...style }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function EyeIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg style={{ width: '0.9rem', height: '0.9rem', ...style }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function XIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg style={{ width: '1.25rem', height: '1.25rem', ...style }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function ChevronLeftIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg style={{ width: '1rem', height: '1rem', ...style }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg style={{ width: '1rem', height: '1rem', ...style }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export default function OrgUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<OrgUserRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'AGENT' | 'ORG_ADMIN'>('ALL');
  const [loading, setLoading] = useState(true);
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<OrgUserRow | null>(null);

  // Form State (Create)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'AGENT' | 'ORG_ADMIN'>('AGENT');
  
  // Form State (Edit)
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('AGENT');
  const [newPass, setNewPass] = useState('');

  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [savingReset, setSavingReset] = useState(false);

  // Deactivate
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<OrgUserRow | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  async function refresh() {
    try {
      const data = await getOrgUsers();
      setUsers(data);
    } catch (e) {}
  }

  useEffect(() => {
    if (!isLoggedIn()) { router.replace('/login'); return; }
    (async () => {
      try {
        const profile = await getMe();
        if (profile.role !== 'ORG_ADMIN') { router.replace('/settings'); return; }
        await refresh();
      } catch { router.replace('/login'); } finally { setLoading(false); }
    })();
  }, [router]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, roleFilter]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setMsg('');
    setSavingCreate(true);

    if (password !== confirmPassword) {
      setErr('Las contraseñas no coinciden');
      setSavingCreate(false);
      return;
    }

    try {
      await createOrgUser({ email: email.trim(), password, displayName: displayName.trim() || undefined, role });
      setEmail(''); setPassword(''); setConfirmPassword(''); setDisplayName(''); setRole('AGENT');
      setMsg('Usuario creado correctamente.');
      await refresh();
      setTimeout(() => { setShowCreateModal(false); setMsg(''); }, 1500);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Error al crear'); }
    finally { setSavingCreate(false); }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;
    setErr(''); setMsg('');
    setSavingUpdate(true);
    try {
      await updateOrgUser(selectedUser.id, { displayName: editName.trim(), role: editRole });
      setMsg('Cambios guardados.');
      await refresh();
      setTimeout(() => { setMsg(''); }, 2000);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Error al actualizar'); }
    finally { setSavingUpdate(false); }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser || !newPass) return;
    setErr(''); setMsg('');
    setSavingReset(true);
    try {
      await resetOrgUserPassword(selectedUser.id, newPass);
      setNewPass('');
      setMsg('Contraseña actualizada con éxito.');
      setTimeout(() => { setMsg(''); }, 2000);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Error al cambiar contraseña'); }
    finally { setSavingReset(false); }
  }

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      const result = await deactivateOrgUser(deactivateTarget.id);
      setMsg(`Usuario ${result.deactivatedUser} desactivado. ${result.reassigned} conversaciones reasignadas.`);
      await refresh();
      setShowDeactivateConfirm(false);
      setDeactivateTarget(null);
      setTimeout(() => setMsg(''), 4000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al desactivar usuario');
      setShowDeactivateConfirm(false);
    } finally {
      setDeactivating(false);
    }
  };

  const handleReactivate = async (user: OrgUserRow) => {
    try {
      const result = await reactivateOrgUser(user.id);
      setMsg(`Usuario ${result.reactivatedUser} reactivado.`);
      await refresh();
      setTimeout(() => setMsg(''), 4000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al reactivar usuario');
    }
  };

  const handleNew = () => {
    setSelectedUser(null);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setDisplayName('');
    setRole('AGENT');
    setErr('');
    setMsg('');
  };

  const openDetails = (u: OrgUserRow) => {
    setSelectedUser(u);
    setEditName(u.displayName || '');
    setEditRole(u.role);
    setNewPass('');
    setMsg(''); setErr('');
    setShowDetailsModal(true);
  };

  const filteredUsers = users.filter(u => {
    const q = searchTerm.toLowerCase();
    return u.email.toLowerCase().includes(q) || (u.displayName?.toLowerCase().includes(q));
  });

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="page-container" style={{ position: 'relative' }}>
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#F2F2F2', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
          Gestión de Usuarios
        </h1>
        <p style={{ color: '#666', fontSize: '0.85rem' }}>Administra tu equipo y sus niveles de acceso.</p>
      </header>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
          <SearchIcon style={{ position: 'absolute', left: '0.85rem', color: '#444' }} />
          <input 
            type="text" 
            placeholder="Buscar por nombre o correo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: '0.65rem 0.75rem 0.65rem 2.4rem', color: '#F2F2F2', outline: 'none', fontSize: '0.85rem' }}
          />
        </div>
        
        <div style={{ position: 'relative', width: '180px', display: 'flex', alignItems: 'center' }}>
          <FilterIcon style={{ position: 'absolute', left: '0.75rem', color: '#444' }} />
          <select 
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            style={{ 
              width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: '0.65rem 0.75rem 0.65rem 2.2rem', color: '#F2F2F2', outline: 'none', appearance: 'none', fontSize: '0.8rem',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23EF4444' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1rem'
            }}
          >
            <option value="ALL" style={{ background: '#0d0d0d' }}>Todos los Roles</option>
            <option value="ORG_ADMIN" style={{ background: '#0d0d0d' }}>Administradores</option>
            <option value="AGENT" style={{ background: '#0d0d0d' }}>Agentes</option>
          </select>
        </div>

        <button 
          onClick={() => { handleNew(); setShowCreateModal(true); }}
          style={{ height: '38px', padding: '0 1.25rem', background: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)', border: 'none', borderRadius: 8, color: 'white', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}
        >
          <PlusIcon />
          Nuevo Usuario
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8rem 0', gap: '1.5rem' }}>
          <div className="pulse-heartbeat">
            <svg width="60" height="60" viewBox="0 0 24 24" fill="#EF4444">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#222', textTransform: 'uppercase', letterSpacing: '0.4em' }}>Sincronizando Equipo</span>
        </div>
      ) : (
        <>
          <div className="table-wrapper" style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }}>
                  <th style={{ padding: '1rem', fontSize: '0.7rem', fontWeight: 900, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Usuario</th>
                  <th style={{ padding: '1rem', fontSize: '0.7rem', fontWeight: 900, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Correo</th>
                  <th style={{ padding: '1rem', fontSize: '0.7rem', fontWeight: 900, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Rol</th>
                  <th style={{ padding: '1rem', fontSize: '0.7rem', fontWeight: 900, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.length > 0 ? paginatedUsers.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', transition: 'background 0.2s ease', opacity: u.isActive ? 1 : 0.5 }} className="table-row-hover">
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: 32, height: 32, borderRadius: '10px', background: u.role === 'ORG_ADMIN' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: u.role === 'ORG_ADMIN' ? '#EF4444' : '#444' }}>
                          <PersonIcon />
                        </div>
                        <span style={{ fontSize: '0.9rem', color: '#F2F2F2', fontWeight: 700 }}>{u.displayName || 'Sin Nombre'}</span>
                        {!u.isActive && (
                          <span style={{ fontSize: '0.6rem', fontWeight: 900, padding: '0.15rem 0.5rem', borderRadius: 4, background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', textTransform: 'uppercase' }}>Inactivo</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.85rem', color: '#666' }}>{u.email}</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 900, padding: '0.2rem 0.6rem', borderRadius: 6, background: u.role === 'ORG_ADMIN' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.05)', color: u.role === 'ORG_ADMIN' ? '#EF4444' : '#666', textTransform: 'uppercase' }}>
                        {u.role === 'ORG_ADMIN' ? 'Admin' : 'Agente'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button 
                        onClick={() => openDetails(u)}
                        style={{ padding: '0.4rem 0.8rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, color: '#8C8C8C', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}
                      >
                        DETALLES
                      </button>
                      {u.isActive ? (
                        <button 
                          onClick={() => { setDeactivateTarget(u); setShowDeactivateConfirm(true); }}
                          style={{ padding: '0.4rem 0.8rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 8, color: '#EF4444', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}
                        >
                          DESACTIVAR
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleReactivate(u)}
                          style={{ padding: '0.4rem 0.8rem', background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.2)', borderRadius: 8, color: '#4ADE80', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}
                        >
                          REACTIVAR
                        </button>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} style={{ padding: '4rem', textAlign: 'center', color: '#444', fontSize: '0.85rem' }}>No se encontraron miembros de equipo.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.7rem', color: '#444', fontWeight: 900, textTransform: 'uppercase' }}>Ver</span>
              <select 
                value={itemsPerPage} 
                onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 6, color: '#F2F2F2', fontSize: '0.75rem', padding: '0.3rem 1.6rem 0.3rem 0.6rem', outline: 'none', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23EF4444' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.4rem center', backgroundSize: '0.8rem' }}
              >
                <option value={10} style={{ background: '#0d0d0d' }}>10</option>
                <option value={20} style={{ background: '#0d0d0d' }}>20</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#666' }}>Página <strong style={{ color: 'white' }}>{currentPage}</strong> de <strong style={{ color: 'white' }}>{totalPages || 1}</strong></span>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} style={{ padding: '0.4rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 6, color: currentPage === 1 ? '#333' : 'white', cursor: 'pointer' }}><ChevronLeftIcon /></button>
                <button disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => p + 1)} style={{ padding: '0.4rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 6, color: (currentPage === totalPages || totalPages === 0) ? '#333' : 'white', cursor: 'pointer' }}><ChevronRightIcon /></button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* DEACTIVATE CONFIRMATION */}
      {showDeactivateConfirm && deactivateTarget && (
        <div onClick={() => { if (!deactivating) { setShowDeactivateConfirm(false); setDeactivateTarget(null); } }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '420px', background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', padding: '2.5rem', position: 'relative', boxShadow: '0 25px 70px rgba(0,0,0,0.8)' }}>
            <button onClick={() => { if (!deactivating) { setShowDeactivateConfirm(false); setDeactivateTarget(null); } }} style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', background: 'none', border: 'none', color: '#444', cursor: 'pointer' }}>
              <XIcon />
            </button>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#EF4444', marginBottom: '0.75rem' }}>Desactivar usuario</h3>
            <p style={{ color: '#8C8C8C', fontSize: '0.85rem', lineHeight: '1.6', marginBottom: '2rem' }}>
              Se desactivará <strong style={{ color: '#F2F2F2' }}>{deactivateTarget.displayName || deactivateTarget.email}</strong> y sus conversaciones asignadas se reasignarán automáticamente a otros agentes. Podrás reactivarlo más tarde.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => { setShowDeactivateConfirm(false); setDeactivateTarget(null); }}
                disabled={deactivating}
                style={{ flex: 1, padding: '1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, color: '#8C8C8C', fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDeactivate}
                disabled={deactivating}
                style={{ flex: 1, padding: '1rem', background: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)', border: 'none', borderRadius: 14, color: 'white', fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: deactivating ? 0.7 : 1 }}
              >
                {deactivating ? <><Spinner /> Desactivando...</> : 'Desactivar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div onClick={() => setShowCreateModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '440px', background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', padding: '2.5rem', position: 'relative', boxShadow: '0 25px 70px rgba(0,0,0,0.8)' }}>
            <button onClick={() => setShowCreateModal(false)} style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', background: 'none', border: 'none', color: '#444', cursor: 'pointer' }}>
              <XIcon />
            </button>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#F2F2F2', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>Nuevo Miembro</h3>
            <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '2rem' }}>Define los accesos para el nuevo usuario.</p>
            
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Nombre Completo</label>
                <input 
                  type="text" required maxLength={50} value={displayName} 
                  onChange={(e) => setDisplayName(e.target.value)} 
                  placeholder="Ej: Juan Pérez" 
                  style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: '0.85rem 1rem', color: 'white', outline: 'none' }} 
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Correo Electrónico</label>
                <input 
                  type="email" required maxLength={50} value={email} 
                  onChange={(e) => setEmail(e.target.value.replace(/\s/g, ''))} 
                  placeholder="usuario@empresa.com" 
                  style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: '0.85rem 1rem', color: 'white', outline: 'none' }} 
                  autoComplete="off"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Contraseña</label>
                  <input 
                    type="password" required minLength={6} maxLength={20} value={password} 
                    onChange={(e) => setPassword(e.target.value.replace(/\s/g, ''))} 
                    placeholder="••••••" 
                    style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: '0.85rem 1rem', color: 'white', outline: 'none' }} 
                    autoComplete="new-password"
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Confirmar</label>
                  <input 
                    type="password" required value={confirmPassword} 
                    onChange={(e) => setConfirmPassword(e.target.value.replace(/\s/g, ''))} 
                    placeholder="••••••" 
                    style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: '0.85rem 1rem', color: 'white', outline: 'none' }} 
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Nivel de Acceso</label>
                <select 
                  value={role} onChange={(e) => setRole(e.target.value as any)} 
                  style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: '0.85rem 1rem', color: 'white', outline: 'none', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23EF4444' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1rem' }}
                >
                  <option value="AGENT" style={{ background: '#0d0d0d' }}>Agente (Solo Chat)</option>
                  <option value="ORG_ADMIN" style={{ background: '#0d0d0d' }}>Administrador (Total)</option>
                </select>
              </div>

              {err && <div style={{ color: '#EF4444', fontSize: '0.8rem', textAlign: 'center', fontWeight: 700 }}>{err}</div>}
              {msg && <div style={{ color: '#4ADE80', fontSize: '0.8rem', textAlign: 'center', fontWeight: 700 }}>{msg}</div>}
              
              <button type="submit" disabled={savingCreate} style={{ marginTop: '1rem', padding: '1.25rem', background: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)', border: 'none', borderRadius: 16, color: 'white', fontWeight: 900, textTransform: 'uppercase', fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 10px 30px rgba(239, 68, 68, 0.4)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: savingCreate ? 0.7 : 1 }}>{savingCreate ? <><Spinner /> Guardando...</> : 'Crear Usuario'}</button>
            </form>
          </div>
        </div>
      )}

      {/* DETAILS MODAL */}
      {showDetailsModal && selectedUser && (
        <div onClick={() => setShowDetailsModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '500px', background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', padding: '2.5rem', position: 'relative', boxShadow: '0 25px 70px rgba(0,0,0,0.8)' }}>
            <button onClick={() => setShowDetailsModal(false)} style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', background: 'none', border: 'none', color: '#444', cursor: 'pointer' }}>
              <XIcon />
            </button>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2.5rem' }}>
              <div style={{ width: 56, height: 56, borderRadius: '16px', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444' }}>
                <PersonIcon style={{ width: '1.75rem', height: '1.75rem' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#F2F2F2', margin: 0, letterSpacing: '-0.02em' }}>{selectedUser.displayName || 'Usuario'}</h3>
                <span style={{ fontSize: '0.9rem', color: '#666' }}>{selectedUser.email}</span>
              </div>
            </div>

            <form onSubmit={handleUpdate} style={{ marginBottom: '2.5rem', paddingBottom: '2.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Nombre Completo</label>
                  <input type="text" maxLength={50} value={editName} onChange={(e) => setEditName(e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: '0.85rem', color: 'white', outline: 'none' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Nivel de Acceso</label>
                  <select 
                    value={editRole} onChange={(e) => setEditRole(e.target.value as any)} 
                    style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: '0.85rem 1rem', color: 'white', outline: 'none', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23EF4444' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1rem' }}
                  >
                    <option value="AGENT" style={{ background: '#0d0d0d' }}>Agente</option>
                    <option value="ORG_ADMIN" style={{ background: '#0d0d0d' }}>Administrador</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={savingUpdate} style={{ width: '100%', padding: '1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, color: 'white', fontSize: '0.85rem', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: savingUpdate ? 0.7 : 1 }}>{savingUpdate ? <><Spinner /> Guardando...</> : 'Actualizar Perfil'}</button>
            </form>

            <div style={{ background: 'rgba(239, 68, 68, 0.02)', border: '1px solid rgba(239, 68, 68, 0.1)', borderRadius: '20px', padding: '1.5rem' }}>
              <h4 style={{ fontSize: '0.75rem', color: '#EF4444', fontWeight: 900, textTransform: 'uppercase', marginBottom: '1.25rem', letterSpacing: '0.1em' }}>Seguridad de Cuenta</h4>
              <form onSubmit={handleResetPassword} style={{ display: 'flex', gap: '0.75rem' }}>
                <input 
                  type="password" minLength={6} maxLength={20} placeholder="Nueva contraseña..." 
                  value={newPass} onChange={(e) => setNewPass(e.target.value.replace(/\s/g, ''))} 
                  style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: '0.85rem', color: 'white', outline: 'none' }} 
                />
                <button type="submit" disabled={savingReset} style={{ padding: '0 1.5rem', background: '#EF4444', border: 'none', borderRadius: 12, color: 'white', fontWeight: 900, fontSize: '0.8rem', cursor: 'pointer', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: savingReset ? 0.7 : 1 }}>{savingReset ? <><Spinner /> Guardando...</> : 'Resetear'}</button>
              </form>
            </div>

            {msg && <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(74, 222, 128, 0.1)', color: '#4ADE80', borderRadius: 12, fontSize: '0.85rem', textAlign: 'center', fontWeight: 700 }}>{msg}</div>}
            {err && <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', borderRadius: 12, fontSize: '0.85rem', textAlign: 'center', fontWeight: 700 }}>{err}</div>}
          </div>
        </div>
      )}

      <style jsx global>{`
        .table-row-hover:hover { background: rgba(255,255,255,0.03) !important; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>
    </div>
  );
}

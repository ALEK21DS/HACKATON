'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  isLoggedIn,
  getMe,
  getPlatformOrganizations,
  createPlatformOrganization,
  bootstrapPlatformOrganizationFirstAdmin,
  setPlatformOrganizationStatus,
  renamePlatformOrganization,
  getPlatformAuditLogs,
  type MeResponse,
  type PlatformOrganization,
  type PlatformAuditLogRow,
} from '@/lib/api';
import { OrganizationDetailsPanel } from './components/organization-details-panel';
import { OrganizationFormModal } from './components/organization-form-modal';
import { PlatformAuditTable } from './components/platform-audit-table';
import type { FirstAdminDraft } from './components/first-admin-form';

// --- Icons ---
function SearchIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg style={{ width: '1.1rem', height: '1.1rem', ...style }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg style={{ width: '1rem', height: '1rem' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14m-7-7v14" />
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

function EyeIcon() {
  return (
    <svg style={{ width: '0.9rem', height: '0.9rem' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg style={{ width: '1rem', height: '1rem' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg style={{ width: '1rem', height: '1rem' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg style={{ width: '1.2rem', height: '1.2rem' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function OrganizationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const moduleParam = searchParams?.get('module');
  const activeModule = (moduleParam === 'auditoria') ? 'auditoria' : 'empresas';

  const [me, setMe] = useState<MeResponse | null>(null);
  const [orgs, setOrgs] = useState<PlatformOrganization[]>([]);
  const [selectedOrgIdForAudit, setSelectedOrgIdForAudit] = useState<string>('');
  const [audit, setAudit] = useState<PlatformAuditLogRow[]>([]);
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Form State (Create Org)
  const [name, setName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminDisplayName, setAdminDisplayName] = useState('');
  const [includeAdminOnCreate, setIncludeAdminOnCreate] = useState(true);

  // Modal States
  const [activeOrgId, setActiveOrgId] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  
  const [firstAdminDraft, setFirstAdminDraft] = useState<Record<string, FirstAdminDraft>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [fetchedModules, setFetchedModules] = useState<Set<string>>(new Set());

  const [orgSearch, setOrgSearch] = useState('');
  const [orgStatusFilter, setOrgStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login');
      return;
    }
    (async () => {
      try {
        const profile = await getMe();
        if (profile.role !== 'SUPER_ADMIN') {
          router.replace('/chat');
          return;
        }
        setMe(profile);
      } catch {
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  useEffect(() => {
    if (!me || loading) return;
    if (activeModule === 'empresas' && !fetchedModules.has('empresas')) {
      setLoadingOrgs(true);
      getPlatformOrganizations()
        .then((list) => {
          setOrgs(list);
          setFetchedModules((prev) => new Set(prev).add('empresas'));
        })
        .catch(() => setError('Error al cargar empresas.'))
        .finally(() => setLoadingOrgs(false));
    }
    if (activeModule === 'auditoria' && !fetchedModules.has('auditoria')) {
      setLoadingAudit(true);
      getPlatformAuditLogs({ take: 80, organizationId: selectedOrgIdForAudit || undefined })
        .then((logs) => {
          setAudit(logs);
          setFetchedModules((prev) => new Set(prev).add('auditoria'));
        })
        .catch(() => setError('Error al cargar auditoría.'))
        .finally(() => setLoadingAudit(false));
    }
  }, [activeModule, me, loading, fetchedModules, selectedOrgIdForAudit]);

  // Reset page on search/filter
  useEffect(() => {
    setCurrentPage(1);
  }, [orgSearch, orgStatusFilter]);

  async function refreshOrganizations() {
    const list = await getPlatformOrganizations();
    setOrgs(list);
  }

  function draftFor(orgId: string): FirstAdminDraft {
    return firstAdminDraft[orgId] ?? { email: '', password: '', displayName: '' };
  }

  function setDraft(orgId: string, patch: Partial<FirstAdminDraft>) {
    setFirstAdminDraft((prev) => {
      const cur = prev[orgId] ?? { email: '', password: '', displayName: '' };
      return { ...prev, [orgId]: { ...cur, ...patch } };
    });
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await createPlatformOrganization({
        name,
        ...(includeAdminOnCreate && adminEmail && adminPassword
          ? {
            adminEmail: adminEmail.trim(),
            adminPassword: adminPassword,
            ...(adminDisplayName.trim() ? { adminDisplayName: adminDisplayName.trim() } : {}),
          }
          : {}),
      });
      setName('');
      setAdminEmail('');
      setAdminPassword('');
      setAdminDisplayName('');
      setIsCreateModalOpen(false);
      await refreshOrganizations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  async function handleBootstrapFirstAdmin(orgId: string) {
    setError('');
    const d = draftFor(orgId);
    try {
      await bootstrapPlatformOrganizationFirstAdmin(orgId, {
        email: d.email.trim(),
        password: d.password,
        ...(d.displayName.trim() ? { displayName: d.displayName.trim() } : {}),
      });
      await refreshOrganizations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  async function toggleStatus(org: PlatformOrganization) {
    try {
      const next = org.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
      await setPlatformOrganizationStatus(org.id, next);
      await refreshOrganizations();
    } catch (err) {}
  }

  // El loading inicial solo bloquea si no tenemos el perfil 'me'
  if (loading && !me) return (
    <div className="flex-1 h-screen bg-[#040404] flex flex-col items-center justify-center">
      <div className="pulse-logo mb-4">
        <svg width="60" height="60" viewBox="0 0 24 24" fill="#EF4444">
          <path d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <style jsx>{`
        .pulse-logo {
          animation: pulse 1.5s ease-in-out infinite;
          filter: drop-shadow(0 0 8px rgba(239, 68, 68, 0.5));
        }
        @keyframes pulse {
          0% { transform: scale(0.95); opacity: 0.5; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.5; }
        }
      `}</style>
    </div>
  );

  const filteredOrgs = orgs.filter(o => {
    const matchesSearch = o.name.toLowerCase().includes(orgSearch.toLowerCase());
    const matchesStatus = orgStatusFilter === 'ALL' || o.status === orgStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // Paginación Local
  const totalPages = Math.ceil(filteredOrgs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedOrgs = filteredOrgs.slice(startIndex, startIndex + itemsPerPage);

  const activeOrg = orgs.find((o) => o.id === activeOrgId) ?? null;

  return (
    <div className="flex-1 h-screen overflow-y-auto relative z-10 p-6 sm:p-12 scroll-smooth bg-[#040404] text-[#F2F2F2]" suppressHydrationWarning>
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 opacity-[0.04]" style={{ backgroundImage: "linear-gradient(45deg, #EF4444 1px, transparent 1px), linear-gradient(135deg, #EF4444 1px, transparent 1px)", backgroundSize: "60px 60px" }}></div>

      <div className="max-w-[1100px] mx-auto pb-20 relative z-10">
        {error && (
          <div className="flex items-center bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg p-3 text-[#EF4444] text-[10px] uppercase tracking-widest font-bold mb-6">
            {error}
          </div>
        )}

        {activeModule === 'empresas' ? (
          <section>
            <div className="mb-6">
              <h2 className="text-2xl font-black text-white mb-1 uppercase tracking-tight">Ecosistema de Empresas</h2>
              <p className="text-[#8C8C8C] text-sm">Gestiona todas las organizaciones conectadas a la plataforma.</p>
            </div>

            {/* Toolbar Unificado y Alineado */}
            <div className="flex gap-3 mb-6 p-3 bg-white/5 border border-white/10 rounded-xl items-center">
              {/* Buscador */}
              <div className="relative flex-1 flex items-center">
                <SearchIcon style={{ position: 'absolute', left: '0.85rem', color: '#666' }} />
                <input 
                  type="text" 
                  placeholder="Buscar empresa por nombre..."
                  value={orgSearch}
                  onChange={(e) => setOrgSearch(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-10 pr-3 text-[#F2F2F2] outline-none text-sm placeholder:text-[#444] focus:border-[#EF4444]/50 transition-colors"
                />
              </div>
              
              {/* Filtro de Estado - Icono Integrado */}
              <div className="relative w-[190px] flex items-center">
                <FilterIcon style={{ position: 'absolute', left: '0.85rem', color: '#666', zIndex: 10 }} />
                <select 
                  value={orgStatusFilter}
                  onChange={(e) => setOrgStatusFilter(e.target.value as any)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-9 pr-3 text-[#F2F2F2] outline-none appearance-none text-sm cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23EF4444' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 0.75rem center',
                    backgroundSize: '1rem'
                  }}
                >
                  <option value="ALL" className="bg-[#0d0d0d]">Todos los Estados</option>
                  <option value="ACTIVE" className="bg-[#0d0d0d]">Activas</option>
                  <option value="SUSPENDED" className="bg-[#0d0d0d]">Suspendidas</option>
                </select>
              </div>

              {/* Botón Agregar */}
              <button 
                onClick={() => setIsCreateModalOpen(true)}
                className="h-[38px] px-5 bg-gradient-to-br from-[#EF4444] to-[#B91C1C] rounded-lg text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-2 hover:scale-[1.02] transition-transform shadow-lg shadow-red-900/20 flex-shrink-0"
              >
                <PlusIcon />
                Agregar Empresa
              </button>
            </div>

            {loadingOrgs ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white/[0.02] border border-white/10 rounded-2xl">
                <div className="pulse-logo-mini mb-4">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="#EF4444">
                    <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <p className="text-[10px] font-black text-[#444] uppercase tracking-[0.2em] animate-pulse">Sincronizando Datos</p>
                <style jsx>{`
                  .pulse-logo-mini {
                    animation: pulse 1.5s ease-in-out infinite;
                    filter: drop-shadow(0 0 5px rgba(239, 68, 68, 0.3));
                  }
                  @keyframes pulse {
                    0% { transform: scale(0.9); opacity: 0.4; }
                    50% { transform: scale(1.1); opacity: 1; }
                    100% { transform: scale(0.9); opacity: 0.4; }
                  }
                `}</style>
              </div>
            ) : (
              <>
                <div className="bg-white/[0.02] border border-white/10 rounded-2xl shadow-2xl" style={{ overflowX: 'auto' }}>
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/[0.01]">
                        <th className="p-4 text-[10px] font-black text-[#8C8C8C] uppercase tracking-[0.2em]">Empresa</th>
                        <th className="p-4 text-[10px] font-black text-[#8C8C8C] uppercase tracking-[0.2em]">Estado</th>
                        <th className="p-4 text-[10px] font-black text-[#8C8C8C] uppercase tracking-[0.2em] text-center">Usuarios</th>
                        <th className="p-4 text-[10px] font-black text-[#8C8C8C] uppercase tracking-[0.2em] text-center">Contactos</th>
                        <th className="p-4 text-[10px] font-black text-[#8C8C8C] uppercase tracking-[0.2em]">Creación</th>
                        <th className="p-4 text-[10px] font-black text-[#8C8C8C] uppercase tracking-[0.2em] text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedOrgs.length > 0 ? paginatedOrgs.map((org) => (
                        <tr 
                          key={org.id} 
                          className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="p-4">
                            <span className="text-sm font-bold text-white">{org.name}</span>
                          </td>
                          <td className="p-4">
                            <span className={`text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-wider ${org.status === 'ACTIVE' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                              {org.status === 'ACTIVE' ? 'Activa' : 'Suspendida'}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <span className="text-sm text-[#8C8C8C] font-mono">{org._count?.users || 0}</span>
                          </td>
                          <td className="p-4 text-center">
                            <span className="text-sm text-[#8C8C8C] font-mono">{org._count?.contacts || 0}</span>
                          </td>
                          <td className="p-4">
                            <span className="text-xs text-[#666]">{new Date(org.createdAt).toLocaleDateString()}</span>
                          </td>
                          <td className="p-4 text-right">
                            <button 
                              onClick={() => { setActiveOrgId(org.id); setIsDetailsModalOpen(true); }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/5 border border-red-500/20 text-[#EF4444] text-[10px] font-black uppercase tracking-wider hover:bg-[#EF4444] hover:text-white transition-all"
                            >
                              <EyeIcon />
                              Detalles
                            </button>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={6} className="p-12 text-center text-[#666] text-sm">No hay empresas que coincidan con la búsqueda.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls Estilizados */}
                <div className="flex justify-between items-center mt-6 px-2">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-[#444] uppercase tracking-widest">Ver</span>
                    <div className="relative flex items-center">
                      <select 
                        value={itemsPerPage} 
                        onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                        className="bg-white/5 border border-white/10 rounded-md text-[#F2F2F2] text-xs py-1 pl-2 pr-7 outline-none appearance-none focus:border-red-500/50"
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23EF4444' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 0.4rem center',
                          backgroundSize: '0.8rem'
                        }}
                      >
                        <option value={10} className="bg-[#0d0d0d]">10</option>
                        <option value={20} className="bg-[#0d0d0d]">20</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <span className="text-[10px] font-black text-[#8C8C8C] uppercase tracking-[0.15em]">
                      Página <strong className="text-white">{currentPage}</strong> de <strong className="text-white">{totalPages || 1}</strong>
                    </span>
                    <div className="flex gap-2">
                      <button 
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => p - 1)}
                        className={`p-2 rounded-lg border transition-all ${currentPage === 1 ? 'border-white/5 text-[#444] cursor-not-allowed' : 'border-white/10 text-white hover:border-[#EF4444]'}`}
                      >
                        <ChevronLeftIcon />
                      </button>
                      <button 
                        disabled={currentPage === totalPages || totalPages === 0}
                        onClick={() => setCurrentPage(p => p + 1)}
                        className={`p-2 rounded-lg border transition-all ${(currentPage === totalPages || totalPages === 0) ? 'border-white/5 text-[#444] cursor-not-allowed' : 'border-white/10 text-white hover:border-[#EF4444]'}`}
                      >
                        <ChevronRightIcon />
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>
        ) : (
          <section>
            <h2 className="text-2xl font-black text-white mb-6 uppercase tracking-tight">Auditoría Global</h2>
            <div className="bg-[#0d0d0d] p-6 rounded-2xl border border-white/5 shadow-2xl">
              <PlatformAuditTable audit={audit} organizations={orgs} selectedOrgId={selectedOrgIdForAudit} onChangeOrganizationId={setSelectedOrgIdForAudit} loading={loadingAudit} />
            </div>
          </section>
        )}

        {activeOrg && (
          <OrganizationDetailsPanel
            isOpen={isDetailsModalOpen}
            onClose={() => setIsDetailsModalOpen(false)}
            organization={activeOrg}
            draft={draftFor(activeOrg.id)}
            onDraftChange={(patch) => setDraft(activeOrg.id, patch)}
            onCreateFirstAdmin={() => handleBootstrapFirstAdmin(activeOrg.id)}
            onToggleStatus={() => toggleStatus(activeOrg)}
            onRenamed={(newName) => setOrgs(prev => prev.map(o => o.id === activeOrg.id ? { ...o, name: newName } : o))}
          />
        )}

        <OrganizationFormModal
          isOpen={isCreateModalOpen}
          name={name}
          adminEmail={adminEmail}
          adminPassword={adminPassword}
          adminDisplayName={adminDisplayName}
          includeAdminOnCreate={includeAdminOnCreate}
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={handleCreate}
          onNameChange={setName}
          onIncludeAdminChange={setIncludeAdminOnCreate}
          onAdminEmailChange={setAdminEmail}
          onAdminPasswordChange={setAdminPassword}
          onAdminDisplayNameChange={setAdminDisplayName}
        />
      </div>
    </div>
  );
}

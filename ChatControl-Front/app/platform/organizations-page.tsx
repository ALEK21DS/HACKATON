'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  isLoggedIn,
  logout,
  getMe,
  getPlatformOrganizations,
  createPlatformOrganization,
  bootstrapPlatformOrganizationFirstAdmin,
  setPlatformOrganizationStatus,
  getPlatformAuditLogs,
  type MeResponse,
  type PlatformOrganization,
  type PlatformAuditLogRow,
} from '@/lib/api';
import { AppButton } from '@/components/ui/button';
import { OrganizationCard } from './components/organization-card';
import { OrganizationDetailsPanel } from './components/organization-details-panel';
import { OrganizationFormModal } from './components/organization-form-modal';
import { PlatformAuditTable } from './components/platform-audit-table';
import type { FirstAdminDraft } from './components/first-admin-form';

export function OrganizationsPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [orgs, setOrgs] = useState<PlatformOrganization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [audit, setAudit] = useState<PlatformAuditLogRow[]>([]);
  const [name, setName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminDisplayName, setAdminDisplayName] = useState('');
  const [includeAdminOnCreate, setIncludeAdminOnCreate] = useState(true);
  const [activeOrgId, setActiveOrgId] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [firstAdminDraft, setFirstAdminDraft] = useState<Record<string, FirstAdminDraft>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

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
        const list = await getPlatformOrganizations();
        setOrgs(list);
        if (list.length > 0) setActiveOrgId(list[0].id);
        setAudit(await getPlatformAuditLogs({ take: 80 }));
      } catch {
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  useEffect(() => {
    if (!me || me.role !== 'SUPER_ADMIN') return;
    (async () => {
      try {
        setAudit(
          await getPlatformAuditLogs({
            take: 80,
            organizationId: selectedOrgId || undefined,
          }),
        );
      } catch {
        setAudit([]);
      }
    })();
  }, [selectedOrgId, me?.id, me?.role]);

  async function refreshOrganizations() {
    const list = await getPlatformOrganizations();
    setOrgs(list);
    if (list.length === 0) {
      setActiveOrgId('');
      return;
    }
    const exists = list.some((o) => o.id === activeOrgId);
    if (!exists) setActiveOrgId(list[0].id);
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
    const email = adminEmail.trim();
    const pass = adminPassword;
    if (includeAdminOnCreate && ((!email && pass) || (email && !pass))) {
      setError('Si añades administrador, indica correo y contraseña (min. 6 caracteres).');
      return;
    }
    try {
      await createPlatformOrganization({
        name,
        ...(includeAdminOnCreate && email && pass
          ? {
              adminEmail: email,
              adminPassword: pass,
              ...(adminDisplayName.trim() ? { adminDisplayName: adminDisplayName.trim() } : {}),
            }
          : {}),
      });
      setName('');
      setAdminEmail('');
      setAdminPassword('');
      setAdminDisplayName('');
      setIncludeAdminOnCreate(true);
      setIsCreateModalOpen(false);
      await refreshOrganizations();
      setAudit(await getPlatformAuditLogs({ take: 80 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  async function handleBootstrapFirstAdmin(orgId: string) {
    setError('');
    const d = draftFor(orgId);
    if (!d.email.trim() || d.password.length < 6) {
      setError('Correo y contrasena (min. 6 caracteres) para el primer administrador.');
      return;
    }
    try {
      await bootstrapPlatformOrganizationFirstAdmin(orgId, {
        email: d.email.trim(),
        password: d.password,
        ...(d.displayName.trim() ? { displayName: d.displayName.trim() } : {}),
      });
      setFirstAdminDraft((prev) => {
        const next = { ...prev };
        delete next[orgId];
        return next;
      });
      await refreshOrganizations();
      setAudit(await getPlatformAuditLogs({ take: 80, organizationId: selectedOrgId || undefined }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  async function toggleStatus(org: PlatformOrganization) {
    try {
      const next = org.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
      await setPlatformOrganizationStatus(org.id, next);
      await refreshOrganizations();
      setAudit(await getPlatformAuditLogs({ take: 80, organizationId: selectedOrgId || undefined }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  function openOrganizationDetails(orgId: string) {
    setActiveOrgId(orgId);
    setIsDetailsModalOpen(true);
  }

  if (loading) return <p style={{ padding: '2rem' }}>Cargando…</p>;

  const activeOrg = orgs.find((o) => o.id === activeOrgId) ?? null;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem' }}>
      <header style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.35rem' }}>Plataforma</h1>
          <p style={{ color: '#666', fontSize: '0.9rem' }}>Super admin: {me?.email}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <AppButton type="button" variant="primary" onClick={() => setIsCreateModalOpen(true)}>
            + Agregar empresa
          </AppButton>
          <Link href="/login" onClick={() => logout()}>
            Cerrar sesion
          </Link>
        </div>
      </header>

      <p style={{ color: '#555', fontSize: '0.9rem', marginBottom: '1rem', lineHeight: 1.5 }}>
        Selecciona una tarjeta para ver detalles. Si una empresa no tiene usuarios, puedes crear aqui su primer
        admin y luego entrar desde Iniciar sesion.
      </p>
      {error && <p style={{ color: 'crimson', marginBottom: '1rem' }}>{error}</p>}

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Empresas creadas</h2>
        {orgs.length === 0 ? (
          <p style={{ color: '#666' }}>No hay empresas todavia.</p>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            {orgs.map((organization) => (
              <OrganizationCard
                key={organization.id}
                organization={organization}
                isActive={organization.id === activeOrgId}
                onSelect={() => openOrganizationDetails(organization.id)}
              />
            ))}
          </div>
        )}
      </section>

      {activeOrg && (
        <OrganizationDetailsPanel
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          organization={activeOrg}
          draft={draftFor(activeOrg.id)}
          onDraftChange={(patch) => setDraft(activeOrg.id, patch)}
          onCreateFirstAdmin={() => handleBootstrapFirstAdmin(activeOrg.id)}
          onToggleStatus={() => toggleStatus(activeOrg)}
        />
      )}

      <PlatformAuditTable
        audit={audit}
        organizations={orgs}
        selectedOrgId={selectedOrgId}
        onChangeOrganizationId={setSelectedOrgId}
      />

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
  );
}

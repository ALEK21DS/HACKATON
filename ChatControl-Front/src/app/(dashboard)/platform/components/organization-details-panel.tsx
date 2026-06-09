'use client';

import { useState } from 'react';
import type { PlatformOrganization } from '@/lib/api';
import { renamePlatformOrganization, resetPlatformAdminPassword } from '@/lib/api';
import { AppModal } from '@/components/ui/modal';
import { FirstAdminForm, type FirstAdminDraft } from './first-admin-form';
import { Spinner } from '@/shared/ui/spinner';

type OrganizationDetailsPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  organization: PlatformOrganization;
  draft: FirstAdminDraft;
  onDraftChange: (patch: Partial<FirstAdminDraft>) => void;
  onCreateFirstAdmin: () => void;
  onToggleStatus: () => void;
  onRenamed: (newName: string) => void;
};

export function OrganizationDetailsPanel({
  isOpen,
  onClose,
  organization,
  draft,
  onDraftChange,
  onCreateFirstAdmin,
  onToggleStatus,
  onRenamed,
}: OrganizationDetailsPanelProps) {
  const [savingStatus, setSavingStatus] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'edit' | 'password'>('info');

  // Edit name state
  const [editName, setEditName] = useState(organization.name);
  const [editNameLoading, setEditNameLoading] = useState(false);
  const [editNameError, setEditNameError] = useState('');
  const [editNameSuccess, setEditNameSuccess] = useState('');

  // Reset password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = editName.trim();
    if (!trimmed) { setEditNameError('El nombre no puede estar vacío.'); return; }
    setEditNameLoading(true);
    setEditNameError('');
    setEditNameSuccess('');
    try {
      await renamePlatformOrganization(organization.id, trimmed);
      setEditNameSuccess('¡Nombre actualizado correctamente!');
      onRenamed(trimmed);
    } catch (err) {
      setEditNameError(err instanceof Error ? err.message : 'Error al renombrar.');
    } finally {
      setEditNameLoading(false);
    }
  }

  function validatePassword(pwd: string) {
    if (/\s/.test(pwd)) return 'La contraseña no puede contener espacios.';
    if (pwd.length < 6) return 'La contraseña debe tener al menos 6 caracteres.';
    return '';
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    const valErr = validatePassword(newPassword);
    if (valErr) { setPwdError(valErr); return; }
    if (newPassword !== confirmPassword) { setPwdError('Las contraseñas no coinciden.'); return; }
    setPwdLoading(true);
    setPwdError('');
    setPwdSuccess('');
    try {
      const res = await resetPlatformAdminPassword(organization.id, newPassword);
      setPwdSuccess(`¡Contraseña actualizada para ${res.adminEmail}!`);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwdError(err instanceof Error ? err.message : 'Error al cambiar contraseña.');
    } finally {
      setPwdLoading(false);
    }
  }

  const tabs = [
    { id: 'info', label: 'Información' },
    { id: 'edit', label: 'Editar' },
    { id: 'password', label: 'Contraseña' },
  ] as const;

  const inputCls = "w-full bg-[#1A1A1A] border border-[#404040]/30 rounded-md py-3 px-4 text-[#F2F2F2] placeholder:text-[#8C8C8C]/30 focus:outline-none focus:border-[#EF4444]/60 focus:ring-1 focus:ring-[#EF4444]/30 transition-all font-body text-sm";

  const EyeIcon = ({ show }: { show: boolean }) => show ? (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );

  return (
    <AppModal isOpen={isOpen} title="Detalle de empresa" onClose={onClose}>
      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#151515] rounded-lg p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 px-3 rounded-md text-[10px] font-headline font-extrabold uppercase tracking-[0.15em] transition-all ${
              activeTab === tab.id
                ? 'bg-[#EF4444] text-white shadow-[0_0_12px_rgba(239,68,68,0.4)]'
                : 'text-[#8C8C8C] hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: INFO */}
      {activeTab === 'info' && (
        <div className="space-y-6">
          <div>
            <p className="font-headline font-bold text-2xl text-white tracking-wide">{organization.name}</p>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <span className={`text-[10px] font-headline font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full ${organization.status === 'ACTIVE' ? 'bg-green-500/10 text-green-400' : 'bg-[#EF4444]/10 text-[#EF4444]'}`}>
                {organization.status}
              </span>
              <span className="text-sm text-[#8C8C8C] font-body">
                Usuarios: <span className="text-[#F2F2F2] font-semibold">{organization._count.users}</span>
                <span className="mx-2 opacity-30">|</span>
                Contactos: <span className="text-[#F2F2F2] font-semibold">{organization._count.contacts}</span>
              </span>
            </div>
          </div>
          <div className="pt-4 border-t border-[#404040]/30">
            <button
              type="button"
              onClick={() => { setSavingStatus(true); try { onToggleStatus(); } finally { setSavingStatus(false); } }}
              disabled={savingStatus}
              className={`w-full sm:w-auto min-h-[44px] px-6 rounded-md font-headline font-extrabold text-xs uppercase tracking-[0.2em] active:scale-[0.98] transition-all disabled:opacity-50 inline-flex items-center gap-2 ${
                organization.status === 'ACTIVE'
                  ? 'border border-[#EF4444] text-[#EF4444] hover:bg-[#EF4444]/10'
                  : 'bg-green-600 hover:bg-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.3)]'
              }`}
            >
              {savingStatus ? <><Spinner /> {organization.status === 'ACTIVE' ? 'Suspender empresa' : 'Activar empresa'}</> : organization.status === 'ACTIVE' ? 'Suspender empresa' : 'Activar empresa'}
            </button>
          </div>
          <div className="bg-[#1A1A1A] rounded-lg p-4 border border-[#404040]/30">
            <p className="text-xs text-[#8C8C8C] leading-relaxed">
              Las integraciones (tokens/API keys) se configuran iniciando sesión con un usuario{' '}
              <strong className="text-white">ORG_ADMIN</strong> de esta empresa, en la ruta{' '}
              <code className="bg-black px-1.5 py-0.5 rounded text-[#EF4444]">/org/integrations</code>.
            </p>
          </div>
          {organization._count.users === 0 && (
            <div className="pt-6 border-t border-[#404040]/30">
              <h3 className="font-headline font-bold text-lg text-white mb-4">Crear primer admin</h3>
              <FirstAdminForm draft={draft} onChange={onDraftChange} onSubmit={onCreateFirstAdmin} />
            </div>
          )}
        </div>
      )}

      {/* Tab: EDIT NAME */}
      {activeTab === 'edit' && (
        <form onSubmit={handleRename} className="space-y-6">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-[#8C8C8C] font-bold mb-2 ml-1">
              Nombre de la empresa
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => { setEditName(e.target.value); setEditNameError(''); setEditNameSuccess(''); }}
              className={inputCls}
              placeholder="Nombre de la empresa"
              required
            />
            {editNameError && <p className="mt-2 text-[11px] text-[#EF4444] font-bold tracking-widest uppercase">{editNameError}</p>}
            {editNameSuccess && <p className="mt-2 text-[11px] text-green-400 font-bold tracking-widest uppercase">{editNameSuccess}</p>}
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-[#404040]/30">
            <button
              type="submit"
              disabled={editNameLoading}
              className="min-h-[44px] px-6 rounded-md bg-[#1A1A1A] hover:bg-[#EF4444] text-[#8C8C8C] hover:text-white font-headline font-extrabold text-xs uppercase tracking-[0.2em] transition-all active:scale-[0.98] disabled:opacity-50 inline-flex items-center gap-2"
            >
              {editNameLoading ? <><Spinner /> Guardando...</> : 'Guardar nombre'}
            </button>
          </div>
        </form>
      )}

      {/* Tab: RESET PASSWORD */}
      {activeTab === 'password' && (
        <form onSubmit={handleResetPassword} className="space-y-5">
          <p className="text-xs text-[#8C8C8C] bg-[#1A1A1A] p-3 rounded-lg border border-[#404040]/30">
            Esto cambiará la contraseña del primer <strong className="text-white">ORG_ADMIN</strong> de esta empresa.
          </p>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-[#8C8C8C] font-bold mb-2 ml-1">
              Nueva contraseña
            </label>
            <div className="relative">
              <input
                type={showNewPwd ? 'text' : 'password'}
                value={newPassword}
                onKeyDown={(e) => { if (e.key === ' ') e.preventDefault(); }}
                onChange={(e) => { setNewPassword(e.target.value); setPwdError(''); setPwdSuccess(''); }}
                autoComplete="new-password"
                className={`${inputCls} pr-11`}
                placeholder="Mín. 6 caracteres, sin espacios"
                minLength={6}
                required
              />
              <button type="button" onClick={() => setShowNewPwd(!showNewPwd)} className="absolute inset-y-0 right-3 flex items-center text-[#8C8C8C]/50 hover:text-white transition-colors">
                <EyeIcon show={showNewPwd} />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-[#8C8C8C] font-bold mb-2 ml-1">
              Confirmar contraseña
            </label>
            <div className="relative">
              <input
                type={showConfirmPwd ? 'text' : 'password'}
                value={confirmPassword}
                onKeyDown={(e) => { if (e.key === ' ') e.preventDefault(); }}
                onChange={(e) => { setConfirmPassword(e.target.value); setPwdError(''); setPwdSuccess(''); }}
                autoComplete="new-password"
                className={`${inputCls} pr-11 ${confirmPassword && confirmPassword !== newPassword ? 'border-[#EF4444]/60' : confirmPassword && confirmPassword === newPassword ? 'border-green-500/60' : ''}`}
                placeholder="Repite la contraseña"
                required
              />
              <button type="button" onClick={() => setShowConfirmPwd(!showConfirmPwd)} className="absolute inset-y-0 right-3 flex items-center text-[#8C8C8C]/50 hover:text-white transition-colors">
                <EyeIcon show={showConfirmPwd} />
              </button>
            </div>
            {confirmPassword && confirmPassword !== newPassword && (
              <p className="mt-1 text-[10px] text-[#EF4444] font-bold tracking-widest uppercase">Las contraseñas no coinciden</p>
            )}
            {confirmPassword && confirmPassword === newPassword && newPassword.length >= 6 && (
              <p className="mt-1 text-[10px] text-green-400 font-bold tracking-widest uppercase">✓ Las contraseñas coinciden</p>
            )}
          </div>
          {pwdError && <p className="text-[11px] text-[#EF4444] font-bold tracking-widest uppercase">{pwdError}</p>}
          {pwdSuccess && <p className="text-[11px] text-green-400 font-bold tracking-widest uppercase">{pwdSuccess}</p>}
          <div className="flex justify-end gap-3 pt-4 border-t border-[#404040]/30">
            <button
              type="submit"
              disabled={pwdLoading}
              className="min-h-[44px] px-6 rounded-md bg-[#1A1A1A] hover:bg-[#EF4444] text-[#8C8C8C] hover:text-white font-headline font-extrabold text-xs uppercase tracking-[0.2em] transition-all active:scale-[0.98] disabled:opacity-50 inline-flex items-center gap-2"
            >
              {pwdLoading ? <><Spinner /> Cambiando...</> : 'Cambiar contraseña'}
            </button>
          </div>
        </form>
      )}
    </AppModal>
  );
}

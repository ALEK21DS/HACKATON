'use client';

import { useState } from 'react';
import { AppModal } from '@/components/ui/modal';
import type { FormEvent } from 'react';
import { Spinner } from '@/shared/ui/spinner';

type OrganizationFormModalProps = {
  isOpen: boolean;
  name: string;
  adminEmail: string;
  adminPassword: string;
  adminDisplayName: string;
  includeAdminOnCreate: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  onNameChange: (value: string) => void;
  onIncludeAdminChange: (checked: boolean) => void;
  onAdminEmailChange: (value: string) => void;
  onAdminPasswordChange: (value: string) => void;
  onAdminDisplayNameChange: (value: string) => void;
};

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

export function OrganizationFormModal({
  isOpen,
  name,
  adminEmail,
  adminPassword,
  adminDisplayName,
  includeAdminOnCreate,
  onClose,
  onSubmit,
  onNameChange,
  onIncludeAdminChange,
  onAdminEmailChange,
  onAdminPasswordChange,
  onAdminDisplayNameChange,
}: OrganizationFormModalProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [savingCreate, setSavingCreate] = useState(false);

  const inputCls = "w-full bg-[#1A1A1A] border border-[#404040]/30 rounded-md py-3 px-4 text-[#F2F2F2] placeholder:text-[#8C8C8C]/30 focus:outline-none focus:border-[#EF4444]/60 focus:ring-1 focus:ring-[#EF4444]/30 transition-all font-body text-sm";

  function validateEmail(email: string) {
    if (!email.includes('@')) return 'El correo debe contener @';
    if (/\s/.test(email)) return 'El correo no puede tener espacios';
    return '';
  }

  function validatePassword(pwd: string) {
    if (/\s/.test(pwd)) return 'La contraseña no puede contener espacios';
    if (pwd.length < 6) return 'Mínimo 6 caracteres';
    return '';
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (includeAdminOnCreate) {
      const emailErr = validateEmail(adminEmail);
      if (emailErr) errors.email = emailErr;
      const pwdErr = validatePassword(adminPassword);
      if (pwdErr) errors.password = pwdErr;
      if (adminPassword !== confirmPassword) errors.confirm = 'Las contraseñas no coinciden';
    }
    setFormErrors(errors);
    if (Object.keys(errors).length === 0) {
      setSavingCreate(true);
      try {
        await onSubmit(e);
      } finally {
        setSavingCreate(false);
      }
    }
  }

  const passwordsMatch = confirmPassword && confirmPassword === adminPassword;
  const passwordsMismatch = confirmPassword && confirmPassword !== adminPassword;

  return (
    <AppModal isOpen={isOpen} title="Agregar empresa" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Company name */}
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-[#8C8C8C] font-bold mb-2 ml-1">
            Nombre de empresa
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            className={inputCls}
            placeholder="Ej: Acme S.A.S."
            maxLength={100}
            required
          />
          <p className={`text-right text-[10px] mt-1 ${name.length >= 90 ? 'text-[#EF4444]' : 'text-[#8C8C8C]/40'}`}>{name.length}/100</p>
        </div>

        {/* Include admin toggle */}
        <div className="flex items-center gap-3 py-1">
          <label className="relative flex cursor-pointer items-center rounded-full p-1" htmlFor="checkbox-admin">
            <input
              type="checkbox"
              className="before:content[''] peer relative h-5 w-5 cursor-pointer appearance-none rounded-md border border-[#404040]/50 bg-[#1A1A1A] transition-all checked:border-[#EF4444] checked:bg-[#EF4444] hover:before:opacity-10"
              id="checkbox-admin"
              checked={includeAdminOnCreate}
              onChange={(e) => { onIncludeAdminChange(e.target.checked); setFormErrors({}); setConfirmPassword(''); }}
            />
            <div className="pointer-events-none absolute top-2/4 left-2/4 -translate-y-2/4 -translate-x-2/4 text-white opacity-0 transition-opacity peer-checked:opacity-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </label>
          <label htmlFor="checkbox-admin" className="text-sm font-bold text-[#F2F2F2] cursor-pointer font-body">
            Crear usuario admin ahora
          </label>
        </div>

        {/* Admin fields — vertical list */}
        {includeAdminOnCreate && (
          <div className="bg-[#151515] rounded-xl p-5 border border-[#404040]/30 space-y-4">
            {/* Email */}
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-[#8C8C8C] font-bold mb-2 ml-1">
                Correo del admin
              </label>
              <input
                type="email"
                value={adminEmail}
                onKeyDown={(e) => { if (e.key === ' ') e.preventDefault(); }}
                onChange={(e) => {
                  onAdminEmailChange(e.target.value);
                  setFormErrors((p) => ({ ...p, email: '' }));
                }}
                autoComplete="email"
                className={`${inputCls} ${formErrors.email ? 'border-[#EF4444]/60' : ''}`}
                placeholder="admin@empresa.com"
                maxLength={100}
              />
              <p className={`text-right text-[10px] mt-1 ${adminEmail.length >= 90 ? 'text-[#EF4444]' : 'text-[#8C8C8C]/40'}`}>{adminEmail.length}/100</p>
              {formErrors.email && <p className="mt-1 text-[10px] text-[#EF4444] font-bold tracking-widest uppercase">{formErrors.email}</p>}
            </div>

            {/* Nombre visible */}
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-[#8C8C8C] font-bold mb-2 ml-1">
                Nombre visible (opcional)
              </label>
              <input
                type="text"
                value={adminDisplayName}
                onChange={(e) => onAdminDisplayNameChange(e.target.value)}
                className={inputCls}
                placeholder="Ej: Juan Pérez"
                maxLength={100}
              />
              <p className={`text-right text-[10px] mt-1 ${adminDisplayName.length >= 90 ? 'text-[#EF4444]' : 'text-[#8C8C8C]/40'}`}>{adminDisplayName.length}/100</p>
            </div>

            {/* Password */}
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-[#8C8C8C] font-bold mb-2 ml-1">
                Contraseña (mín. 6 caracteres)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={adminPassword}
                  onKeyDown={(e) => { if (e.key === ' ') e.preventDefault(); }}
                  onChange={(e) => {
                    onAdminPasswordChange(e.target.value);
                    setFormErrors((p) => ({ ...p, password: '', confirm: '' }));
                  }}
                  autoComplete="new-password"
                  className={`${inputCls} pr-11 ${formErrors.password ? 'border-[#EF4444]/60' : ''}`}
                  placeholder="••••••••"
                  minLength={6}
                  maxLength={64}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-3 flex items-center text-[#8C8C8C]/50 hover:text-white transition-colors">
                  <EyeIcon show={showPassword} />
                </button>
              </div>
              <p className={`text-right text-[10px] mt-1 ${adminPassword.length >= 55 ? 'text-[#EF4444]' : 'text-[#8C8C8C]/40'}`}>{adminPassword.length}/64</p>
              {formErrors.password && <p className="mt-1 text-[10px] text-[#EF4444] font-bold tracking-widest uppercase">{formErrors.password}</p>}
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-[#8C8C8C] font-bold mb-2 ml-1">
                Confirmar contraseña
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onKeyDown={(e) => { if (e.key === ' ') e.preventDefault(); }}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setFormErrors((p) => ({ ...p, confirm: '' }));
                  }}
                  autoComplete="new-password"
                  className={`${inputCls} pr-11 ${passwordsMismatch ? 'border-[#EF4444]/60' : passwordsMatch ? 'border-green-500/60' : ''}`}
                  placeholder="Repite la contraseña"
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute inset-y-0 right-3 flex items-center text-[#8C8C8C]/50 hover:text-white transition-colors">
                  <EyeIcon show={showConfirm} />
                </button>
              </div>
              {passwordsMismatch && <p className="mt-1 text-[10px] text-[#EF4444] font-bold tracking-widest uppercase">Las contraseñas no coinciden</p>}
              {passwordsMatch && adminPassword.length >= 6 && <p className="mt-1 text-[10px] text-green-400 font-bold tracking-widest uppercase">✓ Las contraseñas coinciden</p>}
              {formErrors.confirm && !confirmPassword && <p className="mt-1 text-[10px] text-[#EF4444] font-bold tracking-widest uppercase">{formErrors.confirm}</p>}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-[#404040]/30">
          <button
            type="button"
            onClick={onClose}
            className="relative min-h-[44px] px-6 rounded-md bg-[#1A1A1A] hover:bg-[#252525] text-[#8C8C8C] hover:text-white font-headline font-extrabold text-xs uppercase tracking-[0.2em] transition-all"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={savingCreate}
            className="relative min-h-[44px] px-6 rounded-md bg-[#1A1A1A] hover:bg-[#EF4444] text-[#8C8C8C] hover:text-white font-headline font-extrabold text-xs uppercase tracking-[0.2em] active:scale-[0.98] transition-all disabled:opacity-50 inline-flex items-center gap-2"
          >
            {savingCreate ? <><Spinner /> Guardando...</> : 'Crear empresa'}
          </button>
        </div>
      </form>
    </AppModal>
  );
}

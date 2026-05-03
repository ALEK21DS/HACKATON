import { AppButton } from '@/components/ui/button';
import { AppInput } from '@/components/ui/input';

export type FirstAdminDraft = { email: string; password: string; displayName: string };

type FirstAdminFormProps = {
  draft: FirstAdminDraft;
  onChange: (patch: Partial<FirstAdminDraft>) => void;
  onSubmit: () => void;
};

export function FirstAdminForm({ draft, onChange, onSubmit }: FirstAdminFormProps) {
  return (
    <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-end">
      <div className="flex-1 min-w-[200px]">
        <label className="block text-[10px] uppercase tracking-widest text-[#8C8C8C] font-bold mb-2 ml-1">Correo del admin</label>
        <input
          type="email"
          value={draft.email}
          onChange={(e) => onChange({ email: e.target.value })}
          className="w-full bg-[#1A1A1A] border border-[#404040]/30 rounded-md py-3 px-4 text-[#F2F2F2] placeholder:text-[#8C8C8C]/30 focus:outline-none focus:border-[#EF4444]/60 focus:ring-1 focus:ring-[#EF4444]/30 transition-all font-body text-sm"
          placeholder="admin@empresa.com"
        />
      </div>
      <div className="flex-1 min-w-[180px]">
        <label className="block text-[10px] uppercase tracking-widest text-[#8C8C8C] font-bold mb-2 ml-1">Contraseña (mín. 6)</label>
        <input
          type="password"
          value={draft.password}
          onChange={(e) => onChange({ password: e.target.value })}
          className="w-full bg-[#1A1A1A] border border-[#404040]/30 rounded-md py-3 px-4 text-[#F2F2F2] placeholder:text-[#8C8C8C]/30 focus:outline-none focus:border-[#EF4444]/60 focus:ring-1 focus:ring-[#EF4444]/30 transition-all font-body text-sm"
          placeholder="••••••••"
          minLength={6}
        />
      </div>
      <div className="flex-1 min-w-[180px]">
        <label className="block text-[10px] uppercase tracking-widest text-[#8C8C8C] font-bold mb-2 ml-1">Nombre visible</label>
        <input
          type="text"
          value={draft.displayName}
          onChange={(e) => onChange({ displayName: e.target.value })}
          className="w-full bg-[#1A1A1A] border border-[#404040]/30 rounded-md py-3 px-4 text-[#F2F2F2] placeholder:text-[#8C8C8C]/30 focus:outline-none focus:border-[#EF4444]/60 focus:ring-1 focus:ring-[#EF4444]/30 transition-all font-body text-sm"
          placeholder="Ej: Juan Pérez"
        />
      </div>
      <button 
        type="button" 
        onClick={onSubmit}
        className="w-full sm:w-auto relative min-h-[44px] px-6 rounded-md bg-[#EF4444] hover:bg-[#EF4444]/80 text-white font-headline font-extrabold text-xs uppercase tracking-[0.2em] active:scale-[0.98] transition-all"
      >
        Guardar
      </button>
    </div>
  );
}

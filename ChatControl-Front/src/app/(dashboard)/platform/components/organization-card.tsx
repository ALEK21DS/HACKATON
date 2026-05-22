import type { PlatformOrganization } from '@/lib/api';

type OrganizationCardProps = {
  organization: PlatformOrganization;
  isActive: boolean;
  onSelect: () => void;
};

export function OrganizationCard({ organization, isActive, onSelect }: OrganizationCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-xl p-5 sm:p-6 transition-all duration-300 border ${
        isActive 
          ? 'bg-[#151515] border-[#EF4444] shadow-[0_0_20px_rgba(239,68,68,0.2)]' 
          : 'bg-[#0d0d0d] border-white/5 hover:border-[#EF4444]/40 hover:bg-[#121212]'
      }`}
    >
      <div className="flex justify-between items-center gap-4">
        <div>
          <strong className="text-lg font-headline font-bold text-white tracking-wide">{organization.name}</strong>
          <div className="text-xs sm:text-sm text-[#8C8C8C] mt-2 font-body">
            Usuarios: <span className="text-[#F2F2F2] font-semibold">{organization._count.users}</span> <span className="mx-2 opacity-30">|</span> Contactos: <span className="text-[#F2F2F2] font-semibold">{organization._count.contacts}</span>
          </div>
          {organization.whatsappPhoneNumberId && (
            <div className="text-[10px] uppercase tracking-widest text-[#8C8C8C]/60 mt-3 font-bold">
              ID: {organization.whatsappPhoneNumberId}
            </div>
          )}
        </div>
        <div className="text-right flex flex-col items-end">
          <span className={`text-[10px] font-headline font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full ${organization.status === 'ACTIVE' ? 'bg-green-500/10 text-green-400' : 'bg-[#EF4444]/10 text-[#EF4444]'}`}>
            {organization.status}
          </span>
          <div className="text-[10px] uppercase tracking-widest text-[#8C8C8C] mt-4 flex items-center font-bold">
            Ver detalles
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3 ml-1">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </div>
        </div>
      </div>
    </button>
  );
}

import type { ReactNode } from 'react';
import { AppButton } from '../atoms/button';

type AppModalProps = {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function AppModal({ isOpen, title, onClose, children }: AppModalProps) {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[1000] font-body"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[720px] bg-[#0d0d0d] rounded-2xl p-6 sm:p-8 border border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.8)] text-[#F2F2F2]"
      >
        <div className="flex justify-between items-center mb-6 border-b border-[#404040]/30 pb-4">
          <h2 className="font-headline font-bold text-xl">{title}</h2>
          <button 
            type="button" 
            onClick={onClose}
            className="text-[#8C8C8C] hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { login, loginLegacy, getMe } from '@/lib/api';
import gsap from 'gsap';

export default function LoginPage() {
  const router = useRouter();
  const [legacyMode, setLegacyMode] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // GSAP Intro Animations
    let ctx = gsap.context(() => {
      gsap.to('.ambient-kinetic-1', {
        scale: 1.1,
        opacity: 0.06,
        duration: 4,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut"
      });
      gsap.to('.ambient-kinetic-2', {
        scale: 1.25,
        opacity: 0.03,
        duration: 5.5,
        delay: 0.5,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut"
      });

      gsap.from('.brand-header > *', {
        y: 20,
        opacity: 0,
        duration: 1,
        stagger: 0.15,
        ease: 'power3.out'
      });

      gsap.from('.login-card', {
        y: 30,
        opacity: 0,
        duration: 1.2,
        delay: 0.3,
        ease: 'power3.out'
      });

      gsap.from('.side-decor', {
        opacity: 0,
        duration: 1.5,
        delay: 0.8,
        ease: 'power3.out'
      });
    }, containerRef);
    
    return () => ctx.revert();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (legacyMode) {
        await loginLegacy(phone, password);
      } else {
        await login(email, password);
      }
      const me = await getMe();
      if (me.role === 'SUPER_ADMIN') {
        router.replace('/platform');
      } else {
        router.replace('/chat');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
      // Shake animation on error using GSAP
      gsap.fromTo('.login-card', 
        { x: -5 }, 
        { x: 5, duration: 0.05, yoyo: true, repeat: 5, ease: 'none', onComplete: () => gsap.set('.login-card', { x: 0 }) }
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div ref={containerRef} className="viewport-container min-h-screen relative flex items-center justify-center p-4 sm:p-6" suppressHydrationWarning>
      {/* Ambient Kinetic Signal (Background Decoration) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="ambient-kinetic-1 absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-[#EF4444] opacity-[0.04] blur-[120px] rounded-full"></div>
        <div className="ambient-kinetic-2 absolute -bottom-[10%] -right-[5%] w-[40%] h-[40%] bg-[#EF4444] opacity-[0.02] blur-[100px] rounded-full"></div>
        {/* Grid Pattern Overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(#EF4444 0.5px, transparent 0.5px)", backgroundSize: "40px 40px" }}></div>
      </div>

      {/* Main Content Scrollable Area */}
      <main className="relative z-10 w-full max-w-[440px] flex flex-col items-center py-10">
        
        {/* Brand Identity Section */}
        <div className="brand-header text-center mb-8 relative">
          <div className="flex justify-center mb-4">
            <Image
              src="/assets/images/NOIRLINE2.png"
              alt="ChatControl"
              width={150}
              height={150}
              className="w-[150px] h-[150px] object-contain drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]"
              priority
            />
          </div>
          <h1 className="font-headline font-black text-4xl sm:text-5xl text-[#EF4444] brand-text uppercase mb-2 tracking-tight">Nextline</h1>
          <p className="font-headline text-[10px] sm:text-xs tracking-[0.4em] uppercase text-[#8C8C8C] font-bold">Plataforma de comunicación</p>
        </div>

        {/* Login Card */}
        <div className="login-card w-full bg-[#0d0d0d] p-8 sm:p-10 rounded-2xl border border-white/5 shadow-[0_0_60px_rgba(0,0,0,0.8)] relative">
          <div className="mb-8">
            <h2 className="font-headline text-xl sm:text-2xl font-bold text-on-surface mb-2">Acceso al Sistema</h2>
            <p className="text-xs sm:text-sm text-[#8C8C8C]/80">Ingresa tus credenciales para continuar.</p>
          </div>
          
          <form className="space-y-6 sm:space-y-8" onSubmit={handleSubmit}>
            {!legacyMode ? (
              <div className="space-y-2">
                <label className="font-label text-[10px] uppercase tracking-widest text-[#8C8C8C] font-bold ml-1">Correo electrónico</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-[#8C8C8C]/40 group-focus-within:text-[#EF4444] transition-colors">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                  </div>
                  <input 
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#1A1A1A] border border-[#404040]/30 rounded-md py-3.5 pl-11 pr-4 text-[#F2F2F2] placeholder:text-[#8C8C8C]/30 focus:outline-none focus:border-[#EF4444]/60 focus:ring-1 focus:ring-[#EF4444]/30 transition-all font-body text-sm" 
                    placeholder="admin@chatcontrol.local" 
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="font-label text-[10px] uppercase tracking-widest text-[#8C8C8C] font-bold ml-1">Número de teléfono</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-[#8C8C8C]/40 group-focus-within:text-[#EF4444] transition-colors">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-2.896-1.596-5.265-3.965-6.861-6.86l1.294-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                    </svg>
                  </div>
                  <input 
                    required
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-[#1A1A1A] border border-[#404040]/30 rounded-md py-3.5 pl-11 pr-4 text-[#F2F2F2] placeholder:text-[#8C8C8C]/30 focus:outline-none focus:border-[#EF4444]/60 focus:ring-1 focus:ring-[#EF4444]/30 transition-all font-body text-sm" 
                    placeholder="Ej: 5491112345678" 
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex justify-between items-end px-1">
                <label className="font-label text-[10px] uppercase tracking-widest text-[#8C8C8C] font-bold">Contraseña</label>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-[#8C8C8C]/40 group-focus-within:text-[#EF4444] transition-colors">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <input 
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-[#404040]/30 rounded-md py-3.5 pl-11 pr-11 text-[#F2F2F2] placeholder:text-[#8C8C8C]/30 focus:outline-none focus:border-[#EF4444]/60 focus:ring-1 focus:ring-[#EF4444]/30 transition-all font-body text-sm" 
                  placeholder="••••••••••••" 
                />
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[#8C8C8C]/40 hover:text-[#F2F2F2] transition-colors focus:outline-none"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-center text-[#EF4444] text-[11px] uppercase tracking-widest font-bold mt-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1.5 shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className={`login-submit-btn relative w-full min-h-[48px] rounded-md text-white font-headline font-extrabold text-sm uppercase tracking-[0.2em] active:scale-[0.98] flex items-center justify-center overflow-hidden mt-6 sm:mt-8 ${loading ? 'opacity-80 cursor-wait' : ''}`}
            >
              {loading ? (
                <span className="relative z-[1] py-3.5">ENTRANDO...</span>
              ) : (
                <>
                  <span className="login-submit-label inline-flex items-center justify-center py-3.5">
                    ENTRAR
                  </span>
                  <span className="login-submit-arrow" aria-hidden>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 52 20"
                      fill="none"
                      className="login-arrow-svg h-6 w-[3.25rem] shrink-0 overflow-visible"
                      aria-hidden
                    >
                      <path
                        d="M2 10h14"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="square"
                        opacity="0.45"
                      />
                      <path
                        d="M12 10h18"
                        stroke="currentColor"
                        strokeWidth="2.25"
                        strokeLinecap="square"
                      />
                      <polygon points="30,4 30,16 44,10" fill="currentColor" />
                      <path
                        d="M44 10h6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="square"
                        opacity="0.85"
                      />
                    </svg>
                  </span>
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-[#404040]/30 min-h-[40px]">
            <div className="flex items-center justify-center">
              <button 
                type="button"
                onClick={() => { setLegacyMode(!legacyMode); setError(''); }}
                className="flex items-center space-x-2 text-[#8C8C8C] hover:text-[#EF4444] transition-colors group"
              >
                {legacyMode ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-2.896-1.596-5.265-3.965-6.861-6.86l1.294-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                )}
                <span className="text-[9px] font-label uppercase tracking-[0.1em] font-extrabold">{legacyMode ? 'ACCESO CON CORREO' : 'ACCESO CON NÚMERO (LEGACY)'}</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Side Decoration (Anchored to fixed viewport instead of card) */}
      <div className="side-decor fixed right-6 sm:right-10 bottom-6 sm:bottom-10 opacity-60 pointer-events-none z-0">
        <Image
          src="/assets/images/krakedev_logo-ByJvfRFA.png"
          alt="Krakedev Infrastructure"
          width={120}
          height={80}
          className="w-[100px] sm:w-[130px] h-auto object-contain drop-shadow-[0_0_15px_rgba(239,68,68,0.5)] select-none pointer-events-none"
          priority
        />
      </div>
    </div>
  );
}

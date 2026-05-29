'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import gsap from 'gsap';
import { getMe, login, loginLegacy } from '@/lib/api';

type LoginMode = 'email' | 'phone';

const quickSignals = [
  { label: 'Inbox', value: 'Tiempo real' },
  { label: 'Equipos', value: 'Multiempresa' },
  { label: 'IA', value: 'Gemini listo' },
];

function MailIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.75 6.75h14.5v10.5H4.75z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m5.25 7.25 6.75 5 6.75-5" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.7 4.5 9.1 8c.25.62.06 1.33-.47 1.73l-1.12.84a11.4 11.4 0 0 0 5.92 5.92l.84-1.12c.4-.53 1.11-.72 1.73-.47l3.5 1.4c.58.23.94.82.86 1.44l-.22 1.73c-.08.6-.55 1.07-1.15 1.15C10.4 21.83 2.17 13.6 3.38 5.01c.08-.6.55-1.07 1.15-1.15l1.73-.22c.62-.08 1.21.28 1.44.86Z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 10.25V8a5 5 0 0 1 10 0v2.25" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 10.25h12v9H6z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14v2" />
    </svg>
  );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return hidden ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4 4 16 16" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 5.55A9.4 9.4 0 0 1 12 5.2c4.1 0 7.44 2.67 8.85 6.3a9.95 9.95 0 0 1-2.36 3.48" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.12 14.12A3 3 0 0 1 9.88 9.88" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.62 6.65A10.1 10.1 0 0 0 3.15 11.5c1.41 3.63 4.75 6.3 8.85 6.3 1.02 0 2-.17 2.91-.48" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.15 11.5c1.41-3.63 4.75-6.3 8.85-6.3s7.44 2.67 8.85 6.3c-1.41 3.63-4.75 6.3-8.85 6.3s-7.44-2.67-8.85-6.3Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m13 6 6 6-6 6" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<LoginMode>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isPhoneMode = mode === 'phone';

  useEffect(() => {
    const mm = gsap.matchMedia();

    mm.add(
      {
        reduceMotion: '(prefers-reduced-motion: reduce)',
        desktop: '(min-width: 900px)',
      },
      (context) => {
        const { reduceMotion, desktop } = context.conditions ?? {};
        if (reduceMotion) return;

        const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } });
        timeline
          .from('.login-shell', { autoAlpha: 0, duration: 0.45 })
          .from('.brand-panel', { x: desktop ? -28 : 0, y: desktop ? 0 : 18, autoAlpha: 0, duration: 0.7 }, '-=0.15')
          .from('.auth-panel', { x: desktop ? 28 : 0, y: desktop ? 0 : 18, autoAlpha: 0, duration: 0.7 }, '-=0.5')
          .from('.login-stagger', { y: 14, autoAlpha: 0, duration: 0.45, stagger: 0.06 }, '-=0.35');
      },
      containerRef,
    );

    return () => mm.revert();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isPhoneMode) {
        await loginLegacy(phone, password);
      } else {
        await login(email, password);
      }

      const me = await getMe();
      router.replace(me.role === 'SUPER_ADMIN' ? '/platform' : '/chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesion. Revisa tus credenciales.');
      gsap.fromTo('.auth-panel', { x: -5 }, { x: 5, duration: 0.06, yoyo: true, repeat: 4, ease: 'none', clearProps: 'transform' });
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode: LoginMode) {
    setMode(nextMode);
    setError('');
  }

  return (
    <main ref={containerRef} className="login-shell min-h-dvh overflow-hidden bg-[#040404] text-[#f2f2f2]">
      <div className="login-grid-bg fixed inset-0 pointer-events-none" />

      <section className="relative z-10 grid min-h-dvh grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(430px,520px)]">
        <div className="brand-panel relative flex min-h-[42dvh] flex-col justify-between overflow-hidden border-b border-white/10 px-6 py-7 sm:px-10 lg:min-h-dvh lg:border-b-0 lg:border-r lg:border-[#ef4444]/20">
          <div className="login-scanline absolute inset-0 pointer-events-none" />
          <div className="login-redline absolute right-0 top-0 hidden h-full w-px lg:block" />
          <Image
            src="/assets/images/NOIRLINE.png"
            alt=""
            width={720}
            height={720}
            className="login-hero-mark pointer-events-none absolute -right-28 top-1/2 hidden w-[52vw] max-w-[760px] -translate-y-1/2 select-none object-contain lg:block"
            priority
          />
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="login-logo-tile flex h-[52px] w-[52px] items-center justify-center rounded-lg border border-white/15 bg-white/[0.04]">
                <Image src="/assets/images/NOIRLINE2.png" alt="Nextline" width={34} height={34} className="h-8 w-8 object-contain" priority />
              </div>
              <div>
                <p className="text-base font-extrabold text-white">Nextline</p>
                <p className="text-sm text-[#8c8c8c]">ChatControl Console</p>
              </div>
            </div>
            <div className="hidden rounded-full border border-[#ef4444]/35 bg-[#ef4444]/10 px-3 py-1.5 text-sm font-semibold text-[#ffdad7] shadow-[0_0_28px_rgba(239,68,68,0.16)] sm:block">
              Online
            </div>
          </div>

          <div className="relative max-w-3xl py-12 sm:py-16 lg:py-0">
            <div className="login-gloss-pill mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-sm text-[#f2f2f2]">
              <span className="h-2 w-2 rounded-full bg-[#ef4444] shadow-[0_0_16px_rgba(239,68,68,0.8)]" />
              Centro operativo para WhatsApp e IA
            </div>
            <h1 className="max-w-3xl text-5xl font-black leading-[0.9] text-white sm:text-6xl lg:text-7xl">
              Control total, respuesta inmediata.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-[#d4d4d8] sm:text-lg">
              Entra al panel para coordinar conversaciones, agentes, integraciones y auditoria con la identidad visual oscura de ChatControl.
            </p>
          </div>

          <div className="relative grid gap-3 sm:grid-cols-3">
            {quickSignals.map((item) => (
              <div key={item.label} className="login-stat-card rounded-lg border border-white/10 p-4">
                <p className="text-sm text-[#8c8c8c]">{item.label}</p>
                <p className="mt-2 text-base font-bold text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-center px-4 py-8 sm:px-8 lg:px-10">
          <div className="auth-panel login-gloss-panel relative w-full max-w-[440px] overflow-hidden rounded-lg p-5 sm:p-7">
            <div className="login-reflection pointer-events-none absolute inset-x-0 top-0 h-24" />
            <div className="login-stagger mb-7 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[#ffdad7]">Acceso seguro</p>
                <h2 className="mt-2 text-3xl font-black leading-tight text-white">Bienvenido de vuelta</h2>
              </div>
              <Image src="/assets/images/krakedev_logo-ByJvfRFA.png" alt="Krakedev" width={82} height={48} className="mt-1 h-auto w-20 object-contain opacity-80" />
            </div>

            <div className="login-stagger mb-6 grid grid-cols-2 rounded-lg border border-white/10 bg-black/35 p-1 shadow-inner shadow-black/60">
              <button
                type="button"
                onClick={() => switchMode('email')}
                className={`min-h-11 rounded-md px-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ef4444] ${!isPhoneMode ? 'bg-[#f5f2ee] text-[#161311]' : 'text-[#b7aea6] hover:text-white'}`}
                aria-pressed={!isPhoneMode}
              >
                Correo
              </button>
              <button
                type="button"
                onClick={() => switchMode('phone')}
                className={`min-h-11 rounded-md px-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ef4444] ${isPhoneMode ? 'bg-[#f5f2ee] text-[#161311]' : 'text-[#b7aea6] hover:text-white'}`}
                aria-pressed={isPhoneMode}
              >
                Telefono
              </button>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="login-stagger space-y-2">
                <label htmlFor={isPhoneMode ? 'phone' : 'email'} className="block text-sm font-bold text-[#d8d0c8]">
                  {isPhoneMode ? 'Numero de telefono' : 'Correo electronico'}
                </label>
                <div className="group relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7f7770] transition-colors group-focus-within:text-[#ef4444]">
                    {isPhoneMode ? <PhoneIcon /> : <MailIcon />}
                  </span>
                  <input
                    id={isPhoneMode ? 'phone' : 'email'}
                    required
                    type={isPhoneMode ? 'tel' : 'email'}
                    inputMode={isPhoneMode ? 'tel' : 'email'}
                    autoComplete={isPhoneMode ? 'tel' : 'email'}
                    value={isPhoneMode ? phone : email}
                    onChange={(e) => (isPhoneMode ? setPhone(e.target.value) : setEmail(e.target.value))}
                    className="login-gloss-field min-h-12 w-full rounded-lg border border-white/10 py-3 pl-12 pr-4 text-base text-white outline-none transition-colors placeholder:text-[#8c8c8c]/70 focus:border-[#ef4444]/70 focus:ring-2 focus:ring-[#ef4444]/20"
                    placeholder={isPhoneMode ? '593999999999' : 'admin@empresa.com'}
                  />
                </div>
              </div>

              <div className="login-stagger space-y-2">
                <label htmlFor="password" className="block text-sm font-bold text-[#d8d0c8]">
                  Contrasena
                </label>
                <div className="group relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7f7770] transition-colors group-focus-within:text-[#ef4444]">
                    <LockIcon />
                  </span>
                  <input
                    id="password"
                    required
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="login-gloss-field min-h-12 w-full rounded-lg border border-white/10 py-3 pl-12 pr-14 text-base text-white outline-none transition-colors placeholder:text-[#8c8c8c]/70 focus:border-[#ef4444]/70 focus:ring-2 focus:ring-[#ef4444]/20"
                    placeholder="Tu clave de acceso"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-[#9f968e] transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ef4444]"
                    aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                  >
                    <EyeIcon hidden={showPassword} />
                  </button>
                </div>
              </div>

              {error && (
                <div className="login-stagger rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 px-4 py-3 text-sm font-semibold text-[#ffb4ad]" role="alert">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="login-stagger login-gloss-button group flex min-h-12 w-full items-center justify-between rounded-lg px-4 py-3 text-base font-black text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdad7] disabled:cursor-wait disabled:opacity-70"
              >
                <span>{loading ? 'Entrando...' : 'Entrar al panel'}</span>
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-white/15 transition-transform group-hover:translate-x-0.5">
                  <ArrowIcon />
                </span>
              </button>
            </form>

            <div className="login-stagger mt-6 border-t border-white/10 pt-5">
              <p className="text-sm leading-6 text-[#8c8c8c]">
                Usa las credenciales creadas por el administrador de tu organizacion. El acceso legacy por telefono queda disponible para migraciones.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

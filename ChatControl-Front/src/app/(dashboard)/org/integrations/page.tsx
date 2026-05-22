'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  isLoggedIn,
  getMe,
  getIntegrationStatus,
  updateIntegrations,
  type IntegrationStatus,
  type MeResponse,
} from '@/lib/api';

export default function IntegrationsPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [waToken, setWaToken] = useState('');
  const [waPhoneId, setWaPhoneId] = useState('');
  const [waWaba, setWaWaba] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login');
      return;
    }
    (async () => {
      try {
        const profile = await getMe();
        if (profile.role !== 'ORG_ADMIN') {
          router.replace('/chat');
          return;
        }
        setMe(profile);
        setStatus(await getIntegrationStatus());
      } catch {
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setMsg('');
    try {
      const next = await updateIntegrations({
        whatsappAccessToken: waToken || undefined,
        whatsappPhoneNumberId: waPhoneId || undefined,
        whatsappBusinessAccountId: waWaba || undefined,
        geminiApiKey: geminiKey || undefined,
      });
      setStatus(next);
      setWaToken('');
      setGeminiKey('');
      setMsg('Guardado. Los secretos no se vuelven a mostrar.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al guardar');
    }
  }

  if (loading) return <p style={{ padding: '2rem' }}>Cargando…</p>;

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '2rem' }}>
      <p>
        <Link href="/chat">← Volver al chat</Link>
      </p>
      <h1 style={{ fontSize: '1.35rem', marginBottom: '0.5rem' }}>Integraciones</h1>
      <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Admin: {me?.email}. Los valores se guardan cifrados en el servidor.
      </p>

      {status && (
        <ul style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          <li>WhatsApp token configurado: {status.hasWhatsappToken ? 'sí' : 'no'}</li>
          <li>Gemini API key configurada: {status.hasGeminiKey ? 'sí' : 'no'}</li>
          <li>phone_number_id (Meta): {status.whatsappPhoneNumberId || '(vacío)'}</li>
        </ul>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <label>
          WhatsApp access token
          <input
            type="password"
            value={waToken}
            onChange={(e) => setWaToken(e.target.value)}
            placeholder="Dejar vacío para no cambiar"
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </label>
        <label>
          WhatsApp phone number ID (metadata del webhook)
          <input
            value={waPhoneId}
            onChange={(e) => setWaPhoneId(e.target.value)}
            placeholder="Ej: 123456789012345"
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </label>
        <label>
          WhatsApp Business Account ID (WABA, para plantillas Meta)
          <input
            value={waWaba}
            onChange={(e) => setWaWaba(e.target.value)}
            placeholder="Opcional si ya está en .env"
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </label>
        <label>
          Gemini API key
          <input
            type="password"
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            placeholder="Dejar vacío para no cambiar"
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </label>
        {err && <p style={{ color: 'crimson' }}>{err}</p>}
        {msg && <p style={{ color: 'green' }}>{msg}</p>}
        <button type="submit">Guardar integraciones</button>
      </form>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  isLoggedIn,
  getMe,
  getOrgUsers,
  createOrgUser,
  type MeResponse,
  type UserRole,
} from '@/lib/api';

type OrgUserRow = { id: string; email: string; displayName: string | null; role: UserRole; createdAt: string };

export default function OrgUsersPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [users, setUsers] = useState<OrgUserRow[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'AGENT' | 'ORG_ADMIN'>('AGENT');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setUsers(await getOrgUsers());
  }

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
        await refresh();
      } catch {
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setMsg('');
    try {
      await createOrgUser({ email, password, displayName: displayName || undefined, role });
      setEmail('');
      setPassword('');
      setDisplayName('');
      setRole('AGENT');
      setMsg('Usuario creado.');
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    }
  }

  if (loading) return <p style={{ padding: '2rem' }}>Cargando…</p>;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '2rem' }}>
      <p>
        <Link href="/chat">← Volver al chat</Link>
      </p>
      <h1 style={{ fontSize: '1.35rem' }}>Usuarios de la empresa</h1>
      <p style={{ color: '#666', fontSize: '0.9rem' }}>Administrador: {me?.email}</p>

      <h2 style={{ fontSize: '1.05rem', marginTop: '1.5rem' }}>Crear usuario</h2>
      <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '2rem' }}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="correo@empresa.com"
          style={{ padding: '0.5rem' }}
        />
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña (mín. 6)"
          style={{ padding: '0.5rem' }}
        />
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Nombre para mostrar (opcional)"
          style={{ padding: '0.5rem' }}
        />
        <select value={role} onChange={(e) => setRole(e.target.value as 'AGENT' | 'ORG_ADMIN')} style={{ padding: '0.5rem' }}>
          <option value="AGENT">Agente (solo chat)</option>
          <option value="ORG_ADMIN">Admin de empresa</option>
        </select>
        {err && <p style={{ color: 'crimson' }}>{err}</p>}
        {msg && <p style={{ color: 'green' }}>{msg}</p>}
        <button type="submit">Crear</button>
      </form>

      <h2 style={{ fontSize: '1.05rem' }}>Lista</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {users.map((u) => (
          <li
            key={u.id}
            style={{
              border: '1px solid #ddd',
              borderRadius: 8,
              padding: '0.75rem',
              marginBottom: '0.5rem',
            }}
          >
            <strong>{u.displayName || u.email}</strong>
            <div style={{ fontSize: '0.85rem', color: '#555' }}>
              {u.email} · {u.role}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

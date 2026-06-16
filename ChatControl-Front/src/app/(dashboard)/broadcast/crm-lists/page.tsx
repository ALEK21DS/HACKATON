'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  isLoggedIn,
  getCrmBroadcastLists,
  deleteBroadcastList,
  type BroadcastListItem,
} from '@/lib/api';
import { Spinner } from '@/shared/ui/spinner';

export default function CrmListsPage() {
  const router = useRouter();
  const [lists, setLists] = useState<BroadcastListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login');
      return;
    }
    loadLists();
  }, [router]);

  async function loadLists() {
    setLoading(true);
    try {
      const data = await getCrmBroadcastLists();
      setLists(data);
    } catch {
      setLists([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta lista CRM?')) return;
    setDeletingId(id);
    try {
      await deleteBroadcastList(id);
      setLists((prev) => prev.filter((l) => l.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div style={{ padding: '2rem', color: '#F2F2F2', minHeight: '100vh', background: '#040404' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <Link href="/broadcast" style={subNavStyle(false)}>Campañas</Link>
            <Link href="/templates" style={subNavStyle(false)}>Templates</Link>
            <Link href="/broadcast/crm-lists" style={subNavStyle(true)}>Listas CRM</Link>
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, margin: 0 }}>Listas CRM</h1>
          <p style={{ color: '#666', marginTop: '0.5rem' }}>
            Listas importadas desde CRM asignadas a tu usuario para campañas masivas.
          </p>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
            <Spinner size={32} />
          </div>
        ) : lists.length === 0 ? (
          <div style={{
            padding: '3rem',
            textAlign: 'center',
            borderRadius: 20,
            border: '1px dashed rgba(255,255,255,0.08)',
            color: '#666',
          }}>
            No hay listas CRM disponibles. Los contactos exportados desde el CRM aparecerán aquí.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {lists.map((list) => (
              <div
                key={list.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  padding: '1.25rem 1.5rem',
                  borderRadius: 16,
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1rem' }}>{list.name}</div>
                  <div style={{ color: '#666', fontSize: '0.8rem', marginTop: 4 }}>
                    {list.contactCount} contactos
                    {list.crmExportedAt ? ` · ${new Date(list.crmExportedAt).toLocaleDateString()}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Link
                    href={`/broadcast?source=crm&lists=${list.id}`}
                    style={{
                      padding: '0.6rem 1rem',
                      borderRadius: 10,
                      background: '#EF4444',
                      color: 'white',
                      fontWeight: 800,
                      fontSize: '0.75rem',
                      textDecoration: 'none',
                      textTransform: 'uppercase',
                    }}
                  >
                    Usar en campaña
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(list.id)}
                    disabled={deletingId === list.id}
                    style={{
                      padding: '0.6rem 1rem',
                      borderRadius: 10,
                      border: '1px solid rgba(239,68,68,0.3)',
                      background: 'transparent',
                      color: '#EF4444',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    {deletingId === list.id ? '...' : 'Eliminar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function subNavStyle(active: boolean): React.CSSProperties {
  return {
    padding: '0.5rem 0.875rem',
    borderRadius: 8,
    background: active ? '#EF4444' : 'rgba(255,255,255,0.03)',
    color: active ? 'white' : '#8C8C8C',
    fontSize: '0.65rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    textDecoration: 'none',
  };
}

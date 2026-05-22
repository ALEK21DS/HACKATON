'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isLoggedIn } from '@/lib/api';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    if (isLoggedIn()) router.replace('/chat');
    else router.replace('/login');
  }, [router]);
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      Cargando…
    </div>
  );
}

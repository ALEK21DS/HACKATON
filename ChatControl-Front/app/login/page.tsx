'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { login } from '@/lib/api';
import styles from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(phone, password);
      router.replace('/chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.logoWrap}>
          <Image
            src="/assets/images/logo-mensaje.png"
            alt="ChatControl"
            width={80}
            height={80}
            className={styles.logo}
            priority
          />
        </div>
        <h1 className={styles.title}>ChatControl</h1>
        <p className={styles.subtitle}>Inicia sesión para continuar</p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>
            Número de teléfono
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ej: 5491112345678"
              className={styles.input}
              required
              autoComplete="tel"
            />
          </label>
          <label className={styles.label}>
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              required
              autoComplete="current-password"
            />
          </label>
          {error && <p className={styles.error}>{error}</p>}
          <button
            type="submit"
            className={`${styles.button} ${loading ? styles.buttonLoading : ''}`}
            disabled={loading}
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}

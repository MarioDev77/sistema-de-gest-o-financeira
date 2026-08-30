'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import BrandMark from '@/components/BrandMark';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const loggedUser = await login(email, password);
      router.replace(loggedUser.role === 'admin' ? '/dashboard' : '/vendas');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-gold">
          <BrandMark className="h-9 w-9" />
          <h1 className="mt-3 font-display text-2xl italic text-parchment">Livro-Caixa</h1>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-parchment/40">
            Gestão financeira
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-parchment/10 bg-ink-soft p-7"
        >
          <div className="mb-4">
            <label htmlFor="email" className="mb-1.5 block text-xs text-parchment/60">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-parchment/15 bg-ink px-3 py-2 text-sm text-parchment outline-none focus:border-gold"
            />
          </div>

          <div className="mb-5">
            <label htmlFor="password" className="mb-1.5 block text-xs text-parchment/60">
              Senha
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-parchment/15 bg-ink px-3 py-2 text-sm text-parchment outline-none focus:border-gold"
            />
          </div>

          {error && (
            <p className="mb-4 rounded-md border border-bordeaux/30 bg-bordeaux/10 px-3 py-2 text-xs text-bordeaux-soft">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-gold py-2.5 text-sm font-medium text-ink transition hover:bg-gold-soft disabled:opacity-60"
          >
            {submitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}

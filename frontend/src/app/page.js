'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
    router.replace(user.role === 'admin' ? '/dashboard' : '/vendas');
  }, [loading, user, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink text-parchment/50 text-sm">
      Carregando...
    </div>
  );
}

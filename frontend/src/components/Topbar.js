'use client';

import { useRouter, usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '@/context/AuthContext';

const TITLES = {
  '/dashboard': 'Dashboard',
  '/produtos': 'Produtos',
  '/estoque': 'Estoque',
  '/clientes': 'Clientes',
  '/vendas': 'Vendas',
  '/despesas': 'Despesas',
  '/fluxo-caixa': 'Fluxo de Caixa',
  '/emprestimos': 'Empréstimos',
  '/balancete': 'Balancete',
  '/relatorios': 'Relatórios',
  '/ia': 'Análise Financeira IA',
  '/fechamento': 'Fechamento Mensal',
};

export default function Topbar() {
  const { logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const title = TITLES[pathname] || 'Gestão Financeira';

  function handleLogout() {
    logout();
    router.replace('/login');
  }

  return (
    <header className="flex h-16 flex-none items-center justify-between border-b border-ink-line/10 bg-parchment px-8 dark:border-parchment/10 dark:bg-ink">
      <h1 className="font-display text-xl italic text-ink dark:text-parchment">{title}</h1>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <button
          onClick={handleLogout}
          className="rounded-full border border-bordeaux/30 px-3.5 py-1.5 text-xs font-medium text-bordeaux transition hover:bg-bordeaux/10"
        >
          Sair
        </button>
      </div>
    </header>
  );
}

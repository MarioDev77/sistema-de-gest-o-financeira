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

export default function Topbar({ onOpenSidebar }) {
  const { logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const title = TITLES[pathname] || 'Gestão Financeira';

  function handleLogout() {
    logout();
    router.replace('/login');
  }

  return (
    <header className="flex h-16 flex-none items-center justify-between gap-3 border-b border-ink-line/10 bg-parchment px-4 sm:px-8 dark:border-parchment/10 dark:bg-ink">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onOpenSidebar}
          aria-label="Abrir menu"
          className="-ml-1 rounded-md p-1.5 text-ink hover:bg-parchment-soft lg:hidden dark:text-parchment dark:hover:bg-ink-soft"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </button>
        <h1 className="truncate font-display text-lg italic text-ink sm:text-xl dark:text-parchment">{title}</h1>
      </div>
      <div className="flex flex-none items-center gap-2 sm:gap-3">
        <ThemeToggle />
        <button
          onClick={handleLogout}
          className="rounded-full border border-bordeaux/30 px-3 py-1.5 text-xs font-medium text-bordeaux transition hover:bg-bordeaux/10 sm:px-3.5"
        >
          Sair
        </button>
      </div>
    </header>
  );
}

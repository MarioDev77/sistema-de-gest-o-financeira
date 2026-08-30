'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import BrandMark from './BrandMark';
import { useAuth } from '@/context/AuthContext';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', adminOnly: true },
  { label: 'Produtos', href: '/produtos' },
  { label: 'Estoque', href: '/estoque' },
  { label: 'Clientes', href: '/clientes' },
  { label: 'Vendas', href: '/vendas' },
  { label: 'Despesas', href: '/despesas', adminOnly: true },
  { label: 'Fluxo de Caixa', href: '/fluxo-caixa', adminOnly: true },
  { label: 'Empréstimos', href: '/emprestimos', adminOnly: true },
  { label: 'Balancete', href: '/balancete', adminOnly: true },
  { label: 'Relatórios', href: '/relatorios', adminOnly: true },
  { label: 'Análise IA', href: '/ia', adminOnly: true },
  { label: 'Fechamento Mensal', href: '/fechamento', adminOnly: true },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <aside className="flex h-screen w-60 flex-none flex-col overflow-y-auto border-r border-ink-line/60 bg-ink px-4 py-6 text-parchment">
      <div className="mb-8 flex items-center gap-2 px-2 text-gold">
        <BrandMark className="h-6 w-6" />
        <span className="font-display text-lg italic leading-none">Livro-Caixa</span>
      </div>

      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`block rounded-md px-3 py-2 text-sm transition ${
                isActive
                  ? 'bg-gold/15 text-gold'
                  : 'text-parchment/80 hover:bg-parchment/5 hover:text-parchment'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {user && (
        <div className="mt-6 border-t border-ink-line/60 pt-4 px-2 text-xs text-parchment/50">
          <p className="truncate text-parchment/80">{user.name}</p>
          <p className="capitalize">{user.role === 'admin' ? 'Administrador' : 'Funcionário'}</p>
        </div>
      )}
    </aside>
  );
}

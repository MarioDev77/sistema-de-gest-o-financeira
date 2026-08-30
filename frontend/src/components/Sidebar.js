'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
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

// Sidebar funciona como menu fixo em telas grandes (lg+) e como uma gaveta
// deslizante com fundo escurecido em telas menores (celular/tablet retrato).
export default function Sidebar({ open, onClose }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <>
      {/* Fundo escurecido atrás da gaveta — só existe em telas < lg e só quando aberta */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-none transform flex-col overflow-y-auto border-r border-ink-line/60 bg-ink px-4 py-6 text-parchment transition-transform duration-200 ease-in-out lg:static lg:z-auto lg:w-60 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-8 flex items-center justify-between px-2">
          <div className="flex items-center gap-2 text-gold">
            <Image src="/logo.png" alt="Robson" width={28} height={22} className="h-7 w-auto" />
            <div className="leading-none">
              <span className="font-display block text-lg italic leading-none">Robson</span>
              <span className="block text-[9px] uppercase tracking-[0.2em] text-parchment/40">
                Store &amp; Finance
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar menu"
            className="text-parchment/70 hover:text-parchment lg:hidden"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 space-y-1">
          {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={onClose}
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
    </>
  );
}

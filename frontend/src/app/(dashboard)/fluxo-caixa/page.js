'use client';

import { useEffect, useState } from 'react';
import { useApiClient } from '@/lib/useApiClient';
import { money, shortDate } from '@/lib/format';
import PageHeader from '@/components/ui/PageHeader';
import Table from '@/components/ui/Table';
import ErrorBanner from '@/components/ui/ErrorBanner';
import StatCard from '@/components/ui/StatCard';

export default function FluxoCaixaPage() {
  const api = useApiClient();
  const [movements, setMovements] = useState([]);
  const [summary, setSummary] = useState({ totalIn: 0, totalOut: 0, balance: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/cash-movements')
      .then((data) => { setMovements(data.movements); setSummary(data.summary); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns = [
    { key: 'movement_date', label: 'Data', render: (r) => shortDate(r.movement_date) },
    { key: 'direction', label: 'Direção', render: (r) => (r.direction === 'entrada' ? 'Entrada' : 'Saída') },
    { key: 'category', label: 'Categoria' },
    { key: 'description', label: 'Descrição', render: (r) => r.description || '—' },
    { key: 'amount', label: 'Valor', align: 'right', render: (r) => (
      <span className={r.direction === 'entrada' ? 'text-sage' : 'text-bordeaux'}>
        {r.direction === 'entrada' ? '+' : '-'} {money(r.amount)}
      </span>
    ) },
  ];

  return (
    <div>
      <PageHeader eyebrow="Livro-caixa" title="Fluxo de Caixa" />
      <ErrorBanner message={error} />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total de entradas" value={money(summary.totalIn)} />
        <StatCard label="Total de saídas" value={money(summary.totalOut)} />
        <StatCard label="Saldo" value={money(summary.balance)} />
      </div>
      {loading ? <p className="text-mist">Carregando...</p> : <Table columns={columns} rows={movements} />}
    </div>
  );
}

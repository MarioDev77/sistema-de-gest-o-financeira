'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useApiClient } from '@/lib/useApiClient';
import { money, shortDate } from '@/lib/format';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import ErrorBanner from '@/components/ui/ErrorBanner';

const PIE_COLORS = ['#B8863B', '#5F7A63', '#7A2E3A', '#8B8F99', '#D9B978', '#7C9781'];

const PAYMENT_LABELS = {
  dinheiro: 'Dinheiro', pix: 'PIX', debito: 'Débito', credito: 'Crédito',
  transferencia: 'Transferência', outros: 'Outros',
};

export default function DashboardPage() {
  const api = useApiClient();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard')
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <p className="text-mist">Carregando...</p>;

  return (
    <div>
      <PageHeader eyebrow="Visão geral" title="Dashboard" />
      <ErrorBanner message={error} />
      {!data ? null : (
        <>
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Faturamento do dia" value={money(data.revenueToday)} hint={`${data.salesToday} venda(s)`} />
            <StatCard label="Faturamento do mês" value={money(data.revenueMonth)} hint={`${data.salesMonth} venda(s)`} />
            <StatCard label="Vendas à vista (mês)" value={money(data.avistaMonth)} />
            <StatCard label="Vendas a prazo (mês)" value={money(data.aprazoMonth)} />
            <StatCard label="Recebido de parcelas (mês)" value={money(data.receivedInstallmentsMonth)} />
            <StatCard label="Contas a receber (total)" value={money(data.pendingReceivable)} />
            <StatCard label="Despesas do mês" value={money(data.expensesMonth)} hint={data.overdueExpenses > 0 ? `${data.overdueExpenses} vencida(s)` : undefined} />
            <StatCard label="Lucro bruto (mês)" value={money(data.grossProfitMonth)} />
            <StatCard label="Lucro líquido (mês)" value={money(data.netProfitMonth)} />
            <StatCard label="Produtos com estoque baixo" value={data.lowStockCount} />
            <StatCard label="Valor de estoque (custo)" value={money(data.stockCostValue)} />
            <StatCard label="Valor de estoque (venda)" value={money(data.stockSaleValue)} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="rounded-lg border border-ink-line/10 p-5 dark:border-parchment/10 lg:col-span-2">
              <p className="mb-4 font-display italic text-ink dark:text-parchment">Faturamento — últimos 14 dias</p>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.dailyRevenue.map((d) => ({ ...d, label: shortDate(d.day) }))}>
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={70} tickFormatter={(v) => money(v)} />
                  <Tooltip formatter={(v) => money(v)} />
                  <Line type="monotone" dataKey="total" stroke="#B8863B" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-lg border border-ink-line/10 p-5 dark:border-parchment/10">
              <p className="mb-4 font-display italic text-ink dark:text-parchment">Formas de pagamento (mês)</p>
              {data.paymentMethods.length === 0 ? <p className="text-sm text-mist">Sem vendas no mês.</p> : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={data.paymentMethods} dataKey="total" nameKey="method" outerRadius={80}
                      label={(entry) => PAYMENT_LABELS[entry.method] || entry.method}>
                      {data.paymentMethods.map((entry, i) => (
                        <Cell key={entry.method} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => money(v)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useApiClient } from '@/lib/useApiClient';
import { money, shortDate } from '@/lib/format';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Field, { Select } from '@/components/ui/Field';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export default function IaPage() {
  const api = useApiClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function runAnalysis() {
    setLoading(true);
    setError('');
    try {
      const result = await api.get(`/ai/analysis?year=${year}&month=${month}`);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Dados reais, nunca inventados" title="Análise Financeira IA" />
      <ErrorBanner message={error} />

      <div className="mb-6 flex items-end gap-4">
        <Field label="Mês">
          <Select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </Select>
        </Field>
        <Field label="Ano">
          <Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[now.getFullYear(), now.getFullYear() - 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
        </Field>
        <Button onClick={runAnalysis} disabled={loading}>{loading ? 'Analisando...' : 'Gerar análise do mês'}</Button>
      </div>

      {data && (
        <div className="space-y-6">
          <div className={`rounded-md border p-4 text-sm ${data.recomendacoesDisponiveis ? 'border-gold/40 bg-gold/5' : 'border-mist/30 bg-mist/5'}`}>
            {data.aviso}
          </div>

          {data.recomendacoes && (
            <div className="rounded-lg border border-ink-line/10 p-5 dark:border-parchment/10">
              <p className="mb-2 font-display italic text-gold">Resumo e recomendações (IA)</p>
              <p className="whitespace-pre-line text-sm leading-relaxed">{data.recomendacoes}</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-ink-line/10 p-4 dark:border-parchment/10">
              <p className="mb-2 font-medium">Produtos mais vendidos</p>
              {data.dadosReais.topProducts.length === 0 ? <p className="text-xs text-mist">Sem vendas no período.</p> : (
                <ul className="space-y-1 text-sm">
                  {data.dadosReais.topProducts.map((p) => (
                    <li key={p.name} className="flex justify-between"><span>{p.name}</span><span className="figures">{money(p.revenue)}</span></li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-lg border border-ink-line/10 p-4 dark:border-parchment/10">
              <p className="mb-2 font-medium">Produtos parados</p>
              {data.dadosReais.slowProducts.length === 0 ? <p className="text-xs text-mist">Nenhum produto parado.</p> : (
                <ul className="space-y-1 text-sm">
                  {data.dadosReais.slowProducts.map((p) => (
                    <li key={p.name} className="flex justify-between"><span>{p.name}</span><span className="figures">{p.quantity} un.</span></li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-lg border border-ink-line/10 p-4 dark:border-parchment/10">
              <p className="mb-2 font-medium">Maiores despesas</p>
              {data.dadosReais.topExpenses.length === 0 ? <p className="text-xs text-mist">Sem despesas no período.</p> : (
                <ul className="space-y-1 text-sm">
                  {data.dadosReais.topExpenses.map((e) => (
                    <li key={e.category} className="flex justify-between capitalize"><span>{e.category}</span><span className="figures">{money(e.total)}</span></li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-lg border border-ink-line/10 p-4 dark:border-parchment/10">
              <p className="mb-2 font-medium">Clientes com pendências</p>
              {data.dadosReais.pendingCustomers.length === 0 ? <p className="text-xs text-mist">Nenhuma pendência.</p> : (
                <ul className="space-y-1 text-sm">
                  {data.dadosReais.pendingCustomers.map((c) => (
                    <li key={c.name} className="flex justify-between"><span>{c.name}</span><span className="figures text-bordeaux">{money(c.pending)}</span></li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-lg border border-ink-line/10 p-4 dark:border-parchment/10 md:col-span-2">
              <p className="mb-2 font-medium">Empréstimos vencidos</p>
              {data.dadosReais.overdueLoans.length === 0 ? <p className="text-xs text-mist">Nenhum empréstimo vencido.</p> : (
                <ul className="space-y-1 text-sm">
                  {data.dadosReais.overdueLoans.map((l) => (
                    <li key={l.person_name} className="flex justify-between">
                      <span>{l.person_name}</span>
                      <span className="figures text-bordeaux">{money(l.total_amount)} — venceu em {shortDate(l.due_date)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

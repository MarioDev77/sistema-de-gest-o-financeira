'use client';

import { useEffect, useState } from 'react';
import { useApiClient } from '@/lib/useApiClient';
import { money } from '@/lib/format';
import PageHeader from '@/components/ui/PageHeader';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Field, { Select } from '@/components/ui/Field';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function Row({ label, value, bold }) {
  return (
    <div className={`flex justify-between border-b border-ink-line/5 py-2 dark:border-parchment/5 ${bold ? 'font-semibold' : ''}`}>
      <span>{label}</span>
      <span className="figures">{money(value)}</span>
    </div>
  );
}

export default function BalancetePage() {
  const api = useApiClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/balance-sheet?year=${year}&month=${month}`)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  return (
    <div>
      <PageHeader eyebrow="Resumo do mês" title="Balancete" />
      <ErrorBanner message={error} />

      <div className="mb-6 flex gap-4">
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
      </div>

      {loading || !data ? <p className="text-mist">Carregando...</p> : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-lg border border-ink-line/10 p-5 dark:border-parchment/10">
            <p className="mb-3 font-display italic text-gold">Receitas</p>
            <Row label="Vendas à vista" value={data.revenues.avista} />
            <Row label="Recebimentos a prazo" value={data.revenues.recebimentosAprazo} />
            <Row label="Outras receitas" value={data.revenues.outrasReceitas} />
            <Row label="Juros recebidos" value={data.revenues.jurosRecebidos} />
          </div>
          <div className="rounded-lg border border-ink-line/10 p-5 dark:border-parchment/10">
            <p className="mb-3 font-display italic text-bordeaux">Saídas</p>
            <Row label="Despesas" value={data.saidas.despesas} />
            <Row label="Empréstimos concedidos" value={data.saidas.emprestimosConcedidos} />
            <Row label="Outras saídas" value={data.saidas.outrasSaidas} />
          </div>
          <div className="rounded-lg border border-gold/40 bg-gold/5 p-5">
            <p className="mb-3 font-display italic text-ink dark:text-parchment">Resultados</p>
            <Row label="Faturamento" value={data.resultados.faturamento} />
            <Row label="Custos" value={data.resultados.custos} />
            <Row label="Despesas" value={data.resultados.despesas} />
            <Row label="Lucro Bruto" value={data.resultados.lucroBruto} bold />
            <Row label="Lucro Líquido" value={data.resultados.lucroLiquido} bold />
            <Row label="Emprestado" value={data.resultados.valoresEmprestados} />
            <Row label="Recebido de empréstimos" value={data.resultados.valoresRecebidosEmprestimos} />
          </div>
        </div>
      )}
    </div>
  );
}

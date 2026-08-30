'use client';

import { useState } from 'react';
import { useApiClient } from '@/lib/useApiClient';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Field, { Input } from '@/components/ui/Field';

const REPORTS = [
  { key: 'pdf/vendas', label: 'Vendas', filename: 'relatorio-vendas.pdf', kind: 'pdf' },
  { key: 'pdf/despesas', label: 'Despesas', filename: 'relatorio-despesas.pdf', kind: 'pdf' },
  { key: 'pdf/fluxo-caixa', label: 'Fluxo de Caixa', filename: 'relatorio-fluxo-caixa.pdf', kind: 'pdf' },
  { key: 'pdf/emprestimos', label: 'Empréstimos', filename: 'relatorio-emprestimos.pdf', kind: 'pdf' },
];

export default function RelatoriosPage() {
  const api = useApiClient();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState('');

  function withPeriod(path) {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    return qs ? `/reports/${path}?${qs}` : `/reports/${path}`;
  }

  async function handleDownload(report) {
    setDownloading(report.key);
    setError('');
    try {
      await api.download(withPeriod(report.key), report.filename);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading('');
    }
  }

  async function handleExcel() {
    setDownloading('excel');
    setError('');
    try {
      await api.download(withPeriod('excel'), 'relatorio-financeiro-completo.xlsx');
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading('');
    }
  }

  return (
    <div>
      <PageHeader eyebrow="PDF e Excel" title="Relatórios" />
      <ErrorBanner message={error} />

      <div className="mb-6 grid max-w-md grid-cols-2 gap-4">
        <Field label="De"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Até"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>
      <p className="mb-6 text-xs text-mist">Deixe em branco para incluir todo o período disponível.</p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {REPORTS.map((r) => (
          <div key={r.key} className="rounded-lg border border-ink-line/10 bg-parchment-soft p-5 dark:border-parchment/10 dark:bg-ink-soft">
            <p className="mb-3 font-display italic text-ink dark:text-parchment">{r.label}</p>
            <Button variant="ghost" onClick={() => handleDownload(r)} disabled={downloading === r.key}>
              {downloading === r.key ? 'Gerando...' : 'Baixar PDF'}
            </Button>
          </div>
        ))}
        <div className="rounded-lg border border-gold/40 bg-gold/10 p-5">
          <p className="mb-3 font-display italic text-ink dark:text-parchment">Financeiro Completo</p>
          <p className="mb-3 text-xs text-mist">Excel com 10 planilhas: vendas, produtos, estoque, clientes, contas a receber, despesas, fluxo de caixa, empréstimos, pagamentos e balancete.</p>
          <Button onClick={handleExcel} disabled={downloading === 'excel'}>
            {downloading === 'excel' ? 'Gerando...' : 'Baixar Excel'}
          </Button>
        </div>
      </div>
    </div>
  );
}

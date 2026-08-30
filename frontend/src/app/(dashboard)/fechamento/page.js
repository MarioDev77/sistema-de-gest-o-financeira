'use client';

import { useEffect, useState } from 'react';
import { useApiClient } from '@/lib/useApiClient';
import { money } from '@/lib/format';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Field, { Select } from '@/components/ui/Field';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export default function FechamentoPage() {
  const api = useApiClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [closings, setClosings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await api.get('/monthly-closings');
      setClosings(data.closings);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function handleClose() {
    if (!confirm(`Fechar ${MONTHS[month - 1]}/${year}? Isso gera um snapshot consolidado — não apaga nenhum dado.`)) return;
    setClosing(true);
    setError('');
    try {
      await api.post('/monthly-closings', { year, month });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setClosing(false);
    }
  }

  const columns = [
    { key: 'period', label: 'Período', render: (r) => `${MONTHS[r.month - 1]}/${r.year}` },
    { key: 'revenue', label: 'Faturamento', align: 'right', render: (r) => money(r.revenue) },
    { key: 'net_profit', label: 'Lucro Líquido', align: 'right', render: (r) => money(r.net_profit) },
    { key: 'loaned_amount', label: 'Emprestado', align: 'right', render: (r) => money(r.loaned_amount) },
    { key: 'closed_at', label: 'Fechado em', render: (r) => new Date(r.closed_at).toLocaleString('pt-BR') },
  ];

  return (
    <div>
      <PageHeader eyebrow="Nunca apaga histórico" title="Fechamento Mensal" />
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
        <Button onClick={handleClose} disabled={closing}>{closing ? 'Fechando...' : 'Fechar mês'}</Button>
      </div>

      <p className="mb-4 text-xs text-mist">
        Histórico de meses já fechados:
      </p>
      {loading ? <p className="text-mist">Carregando...</p> : <Table columns={columns} rows={closings} keyField="id" />}
    </div>
  );
}

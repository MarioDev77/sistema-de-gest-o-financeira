'use client';

import { useEffect, useState } from 'react';
import { useApiClient } from '@/lib/useApiClient';
import { money, shortDate } from '@/lib/format';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Field, { Input, Select, TextArea } from '@/components/ui/Field';

const CATEGORIES = ['aluguel','energia','agua','internet','funcionarios','fornecedores','transporte','marketing','embalagens','impostos','manutencao','outros'];
const PAYMENT_METHODS = ['dinheiro','pix','debito','credito','transferencia','outros'];

const EMPTY_FORM = { description: '', category: 'outros', amount: '', expenseDate: '', dueDate: '', notes: '' };

export default function DespesasPage() {
  const api = useApiClient();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [payMethod, setPayMethod] = useState('dinheiro');

  async function loadExpenses() {
    setLoading(true);
    try {
      const data = await api.get('/expenses');
      setExpenses(data.expenses);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadExpenses(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/expenses', { ...form, amount: Number(form.amount) });
      setModalOpen(false);
      setForm(EMPTY_FORM);
      await loadExpenses();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkPaid(id) {
    try {
      await api.post(`/expenses/${id}/pay`, { paymentMethod: payMethod });
      await loadExpenses();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Excluir esta despesa?')) return;
    try {
      await api.delete(`/expenses/${id}`);
      await loadExpenses();
    } catch (err) {
      setError(err.message);
    }
  }

  const totalMonth = expenses
    .filter((e) => e.status === 'pago' && new Date(e.expense_date).getMonth() === new Date().getMonth())
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const columns = [
    { key: 'description', label: 'Descrição' },
    { key: 'category', label: 'Categoria', render: (r) => <span className="capitalize">{r.category}</span> },
    { key: 'expense_date', label: 'Data', render: (r) => shortDate(r.expense_date) },
    { key: 'amount', label: 'Valor', align: 'right', render: (r) => money(r.amount) },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
    { key: 'actions', label: '', render: (r) => (
      <div className="flex justify-end gap-2">
        {r.status !== 'pago' && (
          <div className="flex items-center gap-1">
            <Select className="!w-28 !py-1 text-xs" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
            <button onClick={() => handleMarkPaid(r.id)} className="text-xs text-sage hover:underline">Marcar paga</button>
          </div>
        )}
        <button onClick={() => handleDelete(r.id)} className="text-xs text-bordeaux hover:underline">Excluir</button>
      </div>
    ) },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={`Pago este mês: ${money(totalMonth)}`}
        title="Despesas"
        action={<Button onClick={() => setModalOpen(true)}>+ Nova despesa</Button>}
      />
      <ErrorBanner message={error} />
      {loading ? <p className="text-mist">Carregando...</p> : <Table columns={columns} rows={expenses} />}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nova despesa">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Descrição"><Input required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Categoria">
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Valor (R$)"><Input type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
          <Field label="Data da despesa"><Input type="date" required value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} /></Field>
          <Field label="Vencimento (opcional)"><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
          <Field label="Observações"><TextArea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

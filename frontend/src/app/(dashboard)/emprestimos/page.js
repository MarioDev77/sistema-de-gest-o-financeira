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
import StatCard from '@/components/ui/StatCard';
import Field, { Input, Select, TextArea } from '@/components/ui/Field';

const EMPTY_FORM = {
  personName: '', document: '', phone: '', principalAmount: '', interestType: 'fixo',
  interestPercentage: '', loanDate: '', installmentsCount: '1', notes: '',
};

export default function EmprestimosPage() {
  const api = useApiClient();
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [payAmount, setPayAmount] = useState({});

  async function load() {
    setLoading(true);
    try {
      const data = await api.get('/loans');
      setLoans(data.loans);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/loans', {
        ...form,
        principalAmount: Number(form.principalAmount),
        interestPercentage: Number(form.interestPercentage) || 0,
        installmentsCount: Number(form.installmentsCount),
      });
      setModalOpen(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function openDetail(loan) {
    try {
      const data = await api.get(`/loans/${loan.id}`);
      setDetail(data);
      setDetailOpen(true);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handlePay(installmentId) {
    const amount = Number(payAmount[installmentId]);
    if (!amount || amount <= 0) return;
    try {
      await api.post(`/loans/installments/${installmentId}/pay`, { amount, paymentMethod: 'dinheiro' });
      const data = await api.get(`/loans/${detail.loan.id}`);
      setDetail(data);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCancel(id) {
    if (!confirm('Cancelar este empréstimo?')) return;
    try {
      await api.post(`/loans/${id}/cancel`);
      setDetailOpen(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const totals = loans.reduce((acc, l) => ({
    lent: acc.lent + Number(l.principal_amount),
    toReceive: acc.toReceive + Number(l.total_amount),
    received: acc.received + Number(l.received),
  }), { lent: 0, toReceive: 0, received: 0 });

  const columns = [
    { key: 'person_name', label: 'Pessoa', render: (r) => (
      <button onClick={() => openDetail(r)} className="text-left text-gold hover:underline">{r.person_name}</button>
    ) },
    { key: 'principal_amount', label: 'Valor', align: 'right', render: (r) => money(r.principal_amount) },
    { key: 'total_amount', label: 'Total', align: 'right', render: (r) => money(r.total_amount) },
    { key: 'received', label: 'Recebido', align: 'right', render: (r) => money(r.received) },
    { key: 'remaining', label: 'Restante', align: 'right', render: (r) => money(r.remaining) },
    { key: 'due_date', label: 'Vencimento', render: (r) => shortDate(r.due_date) },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
  ];

  return (
    <div>
      <PageHeader eyebrow={`${loans.length} empréstimo(s)`} title="Empréstimos" action={<Button onClick={() => setModalOpen(true)}>+ Novo empréstimo</Button>} />
      <ErrorBanner message={error} />
      <div className="mb-6 grid grid-cols-3 gap-4">
        <StatCard label="Total emprestado" value={money(totals.lent)} />
        <StatCard label="Total a receber" value={money(totals.toReceive)} />
        <StatCard label="Total recebido" value={money(totals.received)} />
      </div>
      {loading ? <p className="text-mist">Carregando...</p> : <Table columns={columns} rows={loans} />}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Novo empréstimo" wide>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <Field label="Nome da pessoa"><Input required value={form.personName} onChange={(e) => setForm({ ...form, personName: e.target.value })} /></Field>
          <Field label="CPF/CNPJ (opcional)"><Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} /></Field>
          <Field label="Telefone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Valor emprestado (R$)"><Input type="number" step="0.01" required value={form.principalAmount} onChange={(e) => setForm({ ...form, principalAmount: e.target.value })} /></Field>
          <Field label="Tipo de juros">
            <Select value={form.interestType} onChange={(e) => setForm({ ...form, interestType: e.target.value })}>
              <option value="fixo">Fixo (uma vez)</option>
              <option value="simples">Simples (por parcela)</option>
              <option value="por_parcela">Cobrado por parcela</option>
            </Select>
          </Field>
          <Field label="Juros (%)"><Input type="number" step="0.01" value={form.interestPercentage} onChange={(e) => setForm({ ...form, interestPercentage: e.target.value })} /></Field>
          <Field label="Data do empréstimo"><Input type="date" required value={form.loanDate} onChange={(e) => setForm({ ...form, loanDate: e.target.value })} /></Field>
          <Field label="Número de parcelas"><Input type="number" min="1" required value={form.installmentsCount} onChange={(e) => setForm({ ...form, installmentsCount: e.target.value })} /></Field>
          <div className="col-span-2">
            <Field label="Observações"><TextArea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          </div>
          <div className="col-span-2 flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Registrar'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={detail ? detail.loan.person_name : ''} wide>
        {detail && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <Badge status={detail.loan.status} />
              {detail.loan.status !== 'cancelado' && (
                <Button variant="danger" onClick={() => handleCancel(detail.loan.id)}>Cancelar empréstimo</Button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-md bg-parchment-soft p-3 dark:bg-ink"><p className="text-xs text-mist">Principal</p><p className="figures">{money(detail.loan.principal_amount)}</p></div>
              <div className="rounded-md bg-parchment-soft p-3 dark:bg-ink"><p className="text-xs text-mist">Juros ({detail.loan.interest_percentage}%)</p><p className="figures">{money(detail.loan.total_amount - detail.loan.principal_amount)}</p></div>
              <div className="rounded-md bg-parchment-soft p-3 dark:bg-ink"><p className="text-xs text-mist">Total a receber</p><p className="figures">{money(detail.loan.total_amount)}</p></div>
            </div>
            <div>
              <p className="mb-2 font-medium">Parcelas</p>
              <div className="space-y-2">
                {detail.installments.map((inst) => (
                  <div key={inst.id} className="flex items-center justify-between rounded-md border border-ink-line/10 p-3 dark:border-parchment/10">
                    <div>
                      <p>Parcela {inst.installment_number} — venc. {shortDate(inst.due_date)}</p>
                      <p className="text-xs text-mist">{money(inst.paid_amount)} de {money(inst.amount)} pago</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge status={inst.status} />
                      {!['pago', 'cancelado'].includes(inst.status) && (
                        <>
                          <Input type="number" step="0.01" className="w-24" placeholder="Valor"
                            value={payAmount[inst.id] || ''}
                            onChange={(e) => setPayAmount({ ...payAmount, [inst.id]: e.target.value })} />
                          <Button onClick={() => handlePay(inst.id)}>Pagar</Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

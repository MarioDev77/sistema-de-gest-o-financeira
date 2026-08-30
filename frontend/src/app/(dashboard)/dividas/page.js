'use client';

import { useEffect, useState } from 'react';
import { useApiClient } from '@/lib/useApiClient';
import { money, shortDate, dateTime, paymentMethodLabel } from '@/lib/format';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import ErrorBanner from '@/components/ui/ErrorBanner';
import StatCard from '@/components/ui/StatCard';
import Field, { Input, Select, TextArea } from '@/components/ui/Field';
import CurrencyInput from '@/components/ui/CurrencyInput';
import Tabs from '@/components/ui/Tabs';

const INSTALLMENT_OPTIONS = Array.from({ length: 48 }, (_, i) => i + 1);
const INDETERMINADO = 'indeterminado';

const EMPTY_FORM = {
  creditorName: '', document: '', phone: '', principalAmount: '', interestType: 'fixo',
  interestPercentage: '', debtDate: '', installmentsCount: '1', notes: '',
};

const EMPTY_EDIT_FORM = {
  creditorName: '', document: '', phone: '', notes: '',
  principalAmount: '', interestType: 'fixo', interestPercentage: '', debtDate: '', installmentsCount: '1',
};

const EMPTY_PAY_FORM = {
  interestAmount: '', principalAmount: '', paymentMethod: 'dinheiro', notes: '',
};

// "Dívidas" registra o dinheiro que EU peguei emprestado de alguém — o
// espelho de "Empréstimos" (lá é o dinheiro que EU emprestei para alguém).
// Serve só para eu não esquecer quanto devo, para quem e quando vence.
export default function DividasPage() {
  const api = useApiClient();
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editingDebtId, setEditingDebtId] = useState(null);
  const [editHasPayments, setEditHasPayments] = useState(false);

  const [payForm, setPayForm] = useState(EMPTY_PAY_FORM);
  const [savingPay, setSavingPay] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get('/debts');
      setDebts(data.debts);
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
      const isOpenEnded = form.installmentsCount === INDETERMINADO;
      await api.post('/debts', {
        ...form,
        principalAmount: Number(form.principalAmount),
        interestPercentage: Number(form.interestPercentage) || 0,
        isOpenEnded,
        installmentsCount: isOpenEnded ? null : Number(form.installmentsCount),
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

  async function openDetail(debt) {
    try {
      const data = await api.get(`/debts/${debt.id}`);
      setDetail(data);
      setDetailOpen(true);
    } catch (err) {
      setError(err.message);
    }
  }

  function fillEditForm(debt) {
    setEditForm({
      creditorName: debt.creditor_name || '',
      document: debt.document || '',
      phone: debt.phone || '',
      notes: debt.notes || '',
      principalAmount: debt.principal_amount || '',
      interestType: debt.interest_type || 'fixo',
      interestPercentage: debt.interest_percentage || '',
      debtDate: debt.debt_date ? debt.debt_date.slice(0, 10) : '',
      installmentsCount: debt.is_open_ended ? INDETERMINADO : String(debt.installments_count || 1),
    });
  }

  async function openEditFromRow(debt) {
    try {
      const data = await api.get(`/debts/${debt.id}`);
      setEditingDebtId(debt.id);
      setEditHasPayments((data.payments || []).length > 0);
      fillEditForm(data.debt);
      setEditModalOpen(true);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    setSavingEdit(true);
    setError('');
    try {
      const isOpenEnded = editForm.installmentsCount === INDETERMINADO;
      const payload = {
        ...editForm,
        principalAmount: Number(editForm.principalAmount),
        interestPercentage: Number(editForm.interestPercentage) || 0,
        isOpenEnded,
        installmentsCount: isOpenEnded ? null : Number(editForm.installmentsCount),
      };
      const result = await api.put(`/debts/${editingDebtId}`, payload);
      if (result.scheduleRebuilt === false) {
        setError('Nome/observações atualizados. Valor, juros e parcelas não foram alterados porque esta dívida já tem pagamentos registrados.');
      }
      if (detail && detail.debt.id === editingDebtId) {
        const data = await api.get(`/debts/${editingDebtId}`);
        setDetail(data);
      }
      setEditModalOpen(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handlePaySubmit(e) {
    e.preventDefault();
    setSavingPay(true);
    setError('');
    try {
      await api.post(`/debts/${detail.debt.id}/pay`, {
        interestAmount: Number(payForm.interestAmount) || 0,
        principalAmount: Number(payForm.principalAmount) || 0,
        paymentMethod: payForm.paymentMethod,
        notes: payForm.notes,
      });
      const data = await api.get(`/debts/${detail.debt.id}`);
      setDetail(data);
      setPayForm(EMPTY_PAY_FORM);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingPay(false);
    }
  }

  async function handleCancel(id) {
    if (!confirm('Cancelar esta dívida?')) return;
    try {
      await api.post(`/debts/${id}/cancel`);
      setDetailOpen(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const totals = debts.reduce((acc, d) => ({
    borrowed: acc.borrowed + Number(d.principal_amount),
    toPay: acc.toPay + Number(d.total_amount),
    paid: acc.paid + Number(d.paid),
  }), { borrowed: 0, toPay: 0, paid: 0 });

  const columns = [
    { key: 'creditor_name', label: 'Credor', render: (r) => (
      <button onClick={() => openDetail(r)} className="text-left text-gold hover:underline">{r.creditor_name}</button>
    ) },
    { key: 'principal_amount', label: 'Valor', align: 'right', render: (r) => money(r.principal_amount) },
    { key: 'total_amount', label: 'Total a pagar', align: 'right', render: (r) => money(r.total_amount) },
    { key: 'paid', label: 'Pago', align: 'right', render: (r) => money(r.paid) },
    { key: 'remaining', label: 'Restante', align: 'right', render: (r) => money(r.remaining) },
    { key: 'debt_date', label: 'Data da dívida', render: (r) => shortDate(r.debt_date) },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
    { key: 'actions', label: '', render: (r) => (
      <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => openEditFromRow(r)}>Editar</Button>
    ) },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={`${debts.length} dívida(s)`}
        title="Dívidas"
        action={<Button onClick={() => setModalOpen(true)}>+ Nova dívida</Button>}
      />
      <p className="mb-4 -mt-2 text-xs text-mist">
        Registre aqui o dinheiro que você pegou emprestado de alguém — para não esquecer quanto deve, para quem e quando vence.
      </p>
      <ErrorBanner message={error} />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total pego emprestado" value={money(totals.borrowed)} />
        <StatCard label="Total a pagar" value={money(totals.toPay)} />
        <StatCard label="Total já pago" value={money(totals.paid)} />
      </div>
      {loading ? <p className="text-mist">Carregando...</p> : <Table columns={columns} rows={debts} emptyLabel="Nenhuma dívida registrada ainda." />}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nova dívida" wide>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome do credor"><Input required value={form.creditorName} onChange={(e) => setForm({ ...form, creditorName: e.target.value })} /></Field>
          <Field label="CPF/CNPJ (opcional)"><Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} /></Field>
          <Field label="Telefone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Valor da dívida (R$)">
            <CurrencyInput required value={form.principalAmount} onValueChange={(v) => setForm({ ...form, principalAmount: v })} />
          </Field>
          <Field label="Tipo de juros">
            <Select value={form.interestType} onChange={(e) => setForm({ ...form, interestType: e.target.value })}>
              <option value="fixo">Fixo (uma vez)</option>
              <option value="simples">Simples (por parcela)</option>
              <option value="por_parcela">Cobrado por parcela</option>
            </Select>
          </Field>
          <Field label="Juros (%)"><Input type="number" step="0.01" value={form.interestPercentage} onChange={(e) => setForm({ ...form, interestPercentage: e.target.value })} /></Field>
          <Field label="Data da dívida"><Input type="date" required value={form.debtDate} onChange={(e) => setForm({ ...form, debtDate: e.target.value })} /></Field>
          <Field label="Número de parcelas (1 a cada mês)">
            <Select value={form.installmentsCount} onChange={(e) => setForm({ ...form, installmentsCount: e.target.value })}>
              {INSTALLMENT_OPTIONS.map((n) => (
                <option key={n} value={n}>{n} {n === 1 ? 'mês' : 'meses'}</option>
              ))}
              <option value={INDETERMINADO}>Prazo indeterminado (sem parcelas fixas)</option>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Observações"><TextArea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Registrar'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title="Editar dívida" wide>
        <form onSubmit={handleEditSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {editHasPayments && (
            <p className="sm:col-span-2 rounded-md bg-parchment-soft p-3 text-xs text-mist dark:bg-ink">
              Esta dívida já tem pagamentos registrados, então valor, juros e número de
              parcelas não podem ser alterados aqui (só nome, contato e observações).
            </p>
          )}
          <Field label="Nome do credor"><Input required value={editForm.creditorName} onChange={(e) => setEditForm({ ...editForm, creditorName: e.target.value })} /></Field>
          <Field label="CPF/CNPJ (opcional)"><Input value={editForm.document} onChange={(e) => setEditForm({ ...editForm, document: e.target.value })} /></Field>
          <Field label="Telefone"><Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></Field>
          <Field label="Valor da dívida (R$)">
            <CurrencyInput required disabled={editHasPayments} value={editForm.principalAmount}
              onValueChange={(v) => setEditForm({ ...editForm, principalAmount: v })} />
          </Field>
          <Field label="Tipo de juros">
            <Select disabled={editHasPayments} value={editForm.interestType} onChange={(e) => setEditForm({ ...editForm, interestType: e.target.value })}>
              <option value="fixo">Fixo (uma vez)</option>
              <option value="simples">Simples (por parcela)</option>
              <option value="por_parcela">Cobrado por parcela</option>
            </Select>
          </Field>
          <Field label="Juros (%)">
            <Input type="number" step="0.01" disabled={editHasPayments} value={editForm.interestPercentage}
              onChange={(e) => setEditForm({ ...editForm, interestPercentage: e.target.value })} />
          </Field>
          <Field label="Data da dívida">
            <Input type="date" disabled={editHasPayments} value={editForm.debtDate}
              onChange={(e) => setEditForm({ ...editForm, debtDate: e.target.value })} />
          </Field>
          <Field label="Número de parcelas (1 a cada mês)">
            <Select disabled={editHasPayments} value={editForm.installmentsCount}
              onChange={(e) => setEditForm({ ...editForm, installmentsCount: e.target.value })}>
              {INSTALLMENT_OPTIONS.map((n) => (
                <option key={n} value={n}>{n} {n === 1 ? 'mês' : 'meses'}</option>
              ))}
              <option value={INDETERMINADO}>Prazo indeterminado (sem parcelas fixas)</option>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Observações"><TextArea rows={2} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} /></Field>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setEditModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={savingEdit}>{savingEdit ? 'Salvando...' : 'Salvar alterações'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={detail ? detail.debt.creditor_name : ''} wide>
        {detail && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <Badge status={detail.debt.status} />
              <div className="flex gap-2">
                {detail.debt.status !== 'cancelado' && (
                  <Button variant="ghost" onClick={() => openEditFromRow(detail.debt)}>Editar</Button>
                )}
                {detail.debt.status !== 'cancelado' && (
                  <Button variant="danger" onClick={() => handleCancel(detail.debt.id)}>Cancelar dívida</Button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 text-center sm:grid-cols-3">
              <div className="rounded-md bg-parchment-soft p-3 dark:bg-ink"><p className="text-xs text-mist">Principal</p><p className="figures">{money(detail.debt.principal_amount)}</p></div>
              <div className="rounded-md bg-parchment-soft p-3 dark:bg-ink"><p className="text-xs text-mist">Juros ({detail.debt.interest_percentage}%)</p><p className="figures">{money(detail.debt.total_amount - detail.debt.principal_amount)}</p></div>
              <div className="rounded-md bg-parchment-soft p-3 dark:bg-ink"><p className="text-xs text-mist">Total a pagar</p><p className="figures">{money(detail.debt.total_amount)}</p></div>
            </div>

            {detail.debt.status !== 'cancelado' && detail.debt.status !== 'pago' && (
              <div className="rounded-md border border-gold/30 p-4">
                <p className="mb-3 font-display text-base italic text-ink dark:text-parchment">Registrar pagamento</p>
                <form onSubmit={handlePaySubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Juros pago (R$)">
                    <CurrencyInput value={payForm.interestAmount}
                      onValueChange={(v) => setPayForm({ ...payForm, interestAmount: v })} />
                  </Field>
                  <Field label="Abatimento do capital (R$)">
                    <CurrencyInput value={payForm.principalAmount}
                      onValueChange={(v) => setPayForm({ ...payForm, principalAmount: v })} />
                  </Field>
                  <Field label="Forma de pagamento">
                    <Select value={payForm.paymentMethod} onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}>
                      <option value="dinheiro">Dinheiro</option>
                      <option value="pix">PIX</option>
                      <option value="debito">Débito</option>
                      <option value="credito">Crédito</option>
                      <option value="transferencia">Transferência</option>
                      <option value="outros">Outros</option>
                    </Select>
                  </Field>
                  <Field label="Observações"><Input value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} /></Field>
                  <div className="sm:col-span-2 flex justify-end">
                    <Button type="submit" disabled={savingPay}>{savingPay ? 'Registrando...' : 'Registrar pagamento'}</Button>
                  </div>
                </form>
              </div>
            )}

            <Tabs tabs={[
              { key: 'parcelas', label: 'Parcelas' },
              { key: 'pago', label: `Pago (${detail.payments.length})` },
            ]}>
              {(active) => active === 'parcelas' ? (
                <div className="space-y-2">
                  {detail.debt.is_open_ended && detail.installments.length === 0 && (
                    <p className="rounded-md border border-dashed border-ink-line/20 p-4 text-center text-xs text-mist dark:border-parchment/20">
                      Dívida de prazo indeterminado — sem parcelas fixas. Use
                      &quot;Registrar pagamento&quot; acima para lançar juros e abatimentos mês a mês.
                    </p>
                  )}
                  {detail.installments.map((inst) => (
                    <div key={inst.id} className="flex flex-col gap-2 rounded-md border border-ink-line/10 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-parchment/10">
                      <div>
                        <p>Parcela {inst.installment_number} — venc. {shortDate(inst.due_date)}</p>
                        <p className="text-xs text-mist">{money(inst.paid_amount)} de {money(inst.amount)} pago (juros: {money(inst.interest_amount)})</p>
                      </div>
                      <Badge status={inst.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <Table
                  columns={[
                    { key: 'payment_date', label: 'Pago em', render: (r) => dateTime(r.payment_date) },
                    { key: 'amount', label: 'Valor', align: 'right', render: (r) => money(r.amount) },
                    { key: 'principal_portion', label: 'Principal', align: 'right', render: (r) => money(r.principal_portion) },
                    { key: 'interest_portion', label: 'Juros', align: 'right', render: (r) => money(r.interest_portion) },
                    { key: 'payment_method', label: 'Forma', render: (r) => paymentMethodLabel(r.payment_method) },
                  ]}
                  rows={detail.payments}
                  emptyLabel="Nenhum pagamento registrado ainda."
                />
              )}
            </Tabs>
          </div>
        )}
      </Modal>
    </div>
  );
}

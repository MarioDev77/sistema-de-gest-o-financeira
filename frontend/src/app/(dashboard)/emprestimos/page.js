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
import Tabs from '@/components/ui/Tabs';

const EMPTY_FORM = {
  personName: '', document: '', phone: '', principalAmount: '', interestType: 'fixo',
  interestPercentage: '', loanDate: '', installmentsCount: '1', notes: '',
};

const EMPTY_RECEIPT_FORM = {
  personName: '', amount: '', receiptDate: '', paymentMethod: 'dinheiro', notes: '',
};

const EMPTY_EDIT_FORM = {
  personName: '', document: '', phone: '', dueDate: '', notes: '',
};

const EMPTY_RECEIVE_FORM = {
  interestAmount: '', principalAmount: '', paymentMethod: 'dinheiro', notes: '',
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

  const [receipts, setReceipts] = useState([]);
  const [receiptsLoading, setReceiptsLoading] = useState(true);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptForm, setReceiptForm] = useState(EMPTY_RECEIPT_FORM);
  const [savingReceipt, setSavingReceipt] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [savingEdit, setSavingEdit] = useState(false);

  const [receiveForm, setReceiveForm] = useState(EMPTY_RECEIVE_FORM);
  const [savingReceive, setSavingReceive] = useState(false);

  const [interestModalOpen, setInterestModalOpen] = useState(false);
  const [interestPayments, setInterestPayments] = useState([]);
  const [interestTotal, setInterestTotal] = useState(0);
  const [interestLoading, setInterestLoading] = useState(false);

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

  async function loadReceipts() {
    setReceiptsLoading(true);
    try {
      const data = await api.get('/receipts');
      setReceipts(data.receipts);
    } catch (err) {
      setError(err.message);
    } finally {
      setReceiptsLoading(false);
    }
  }

  useEffect(() => { load(); loadReceipts(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

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

  async function handleReceiptSubmit(e) {
    e.preventDefault();
    setSavingReceipt(true);
    setError('');
    try {
      await api.post('/receipts', {
        ...receiptForm,
        amount: Number(receiptForm.amount),
      });
      setReceiptModalOpen(false);
      setReceiptForm(EMPTY_RECEIPT_FORM);
      await loadReceipts();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingReceipt(false);
    }
  }

  async function handleCancelReceipt(id) {
    if (!confirm('Cancelar este recibo?')) return;
    try {
      await api.post(`/receipts/${id}/cancel`);
      await loadReceipts();
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

  function openEdit() {
    if (!detail) return;
    setEditForm({
      personName: detail.loan.person_name || '',
      document: detail.loan.document || '',
      phone: detail.loan.phone || '',
      dueDate: detail.loan.due_date ? detail.loan.due_date.slice(0, 10) : '',
      notes: detail.loan.notes || '',
    });
    setEditModalOpen(true);
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    setSavingEdit(true);
    setError('');
    try {
      await api.put(`/loans/${detail.loan.id}`, editForm);
      const data = await api.get(`/loans/${detail.loan.id}`);
      setDetail(data);
      setEditModalOpen(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleReceiveSubmit(e) {
    e.preventDefault();
    setSavingReceive(true);
    setError('');
    try {
      await api.post(`/loans/${detail.loan.id}/receive`, {
        interestAmount: Number(receiveForm.interestAmount) || 0,
        principalAmount: Number(receiveForm.principalAmount) || 0,
        paymentMethod: receiveForm.paymentMethod,
        notes: receiveForm.notes,
      });
      const data = await api.get(`/loans/${detail.loan.id}`);
      setDetail(data);
      setReceiveForm(EMPTY_RECEIVE_FORM);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingReceive(false);
    }
  }

  async function openInterestModal() {
    setInterestModalOpen(true);
    setInterestLoading(true);
    try {
      const data = await api.get('/loans/payments/interest');
      setInterestPayments(data.payments);
      setInterestTotal(data.total);
    } catch (err) {
      setError(err.message);
    } finally {
      setInterestLoading(false);
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
      <PageHeader
        eyebrow={`${loans.length} empréstimo(s)`}
        title="Empréstimos"
        action={(
          <div className="flex gap-2">
            <Button variant="ghost" onClick={openInterestModal}>Juros recebidos</Button>
            <Button variant="ghost" onClick={() => setReceiptModalOpen(true)}>+ Recibo</Button>
            <Button onClick={() => setModalOpen(true)}>+ Novo empréstimo</Button>
          </div>
        )}
      />
      <ErrorBanner message={error} />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total emprestado" value={money(totals.lent)} />
        <StatCard label="Total a receber" value={money(totals.toReceive)} />
        <StatCard label="Total recebido" value={money(totals.received)} />
      </div>
      {loading ? <p className="text-mist">Carregando...</p> : <Table columns={columns} rows={loans} />}

      <div className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg italic text-ink dark:text-parchment">Recibos avulsos</h3>
          <span className="text-xs text-mist">{receipts.length} recibo(s)</span>
        </div>
        {receiptsLoading ? (
          <p className="text-mist">Carregando...</p>
        ) : (
          <Table
            columns={[
              { key: 'person_name', label: 'Pessoa' },
              { key: 'amount', label: 'Valor', align: 'right', render: (r) => money(r.amount) },
              { key: 'receipt_date', label: 'Data', render: (r) => shortDate(r.receipt_date) },
              { key: 'payment_method', label: 'Forma', render: (r) => paymentMethodLabel(r.payment_method) },
              { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
              { key: 'actions', label: '', render: (r) => (
                r.status !== 'cancelado' && (
                  <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => handleCancelReceipt(r.id)}>Cancelar</Button>
                )
              ) },
            ]}
            rows={receipts}
            emptyLabel="Nenhum recibo registrado ainda."
          />
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Novo empréstimo" wide>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          <div className="sm:col-span-2">
            <Field label="Observações"><TextArea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Registrar'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={receiptModalOpen} onClose={() => setReceiptModalOpen(false)} title="Novo recibo">
        <form onSubmit={handleReceiptSubmit} className="grid grid-cols-1 gap-4">
          <Field label="Nome da pessoa"><Input required value={receiptForm.personName} onChange={(e) => setReceiptForm({ ...receiptForm, personName: e.target.value })} /></Field>
          <Field label="Valor recebido (R$)"><Input type="number" step="0.01" required value={receiptForm.amount} onChange={(e) => setReceiptForm({ ...receiptForm, amount: e.target.value })} /></Field>
          <Field label="Data do recebimento"><Input type="date" required value={receiptForm.receiptDate} onChange={(e) => setReceiptForm({ ...receiptForm, receiptDate: e.target.value })} /></Field>
          <Field label="Forma de pagamento">
            <Select value={receiptForm.paymentMethod} onChange={(e) => setReceiptForm({ ...receiptForm, paymentMethod: e.target.value })}>
              <option value="dinheiro">Dinheiro</option>
              <option value="pix">PIX</option>
              <option value="debito">Débito</option>
              <option value="credito">Crédito</option>
              <option value="transferencia">Transferência</option>
              <option value="outros">Outros</option>
            </Select>
          </Field>
          <Field label="Observações"><TextArea rows={2} value={receiptForm.notes} onChange={(e) => setReceiptForm({ ...receiptForm, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setReceiptModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={savingReceipt}>{savingReceipt ? 'Salvando...' : 'Registrar'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title="Editar empréstimo">
        <form onSubmit={handleEditSubmit} className="grid grid-cols-1 gap-4">
          <Field label="Nome da pessoa"><Input required value={editForm.personName} onChange={(e) => setEditForm({ ...editForm, personName: e.target.value })} /></Field>
          <Field label="CPF/CNPJ (opcional)"><Input value={editForm.document} onChange={(e) => setEditForm({ ...editForm, document: e.target.value })} /></Field>
          <Field label="Telefone"><Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></Field>
          <Field label="Vencimento"><Input type="date" value={editForm.dueDate} onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })} /></Field>
          <Field label="Observações"><TextArea rows={2} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setEditModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={savingEdit}>{savingEdit ? 'Salvando...' : 'Salvar alterações'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={interestModalOpen} onClose={() => setInterestModalOpen(false)} title="Juros recebidos" wide>
        <div className="space-y-4 text-sm">
          <div className="rounded-md bg-parchment-soft p-3 text-center dark:bg-ink">
            <p className="text-xs text-mist">Total de juros recebidos</p>
            <p className="figures text-lg">{money(interestTotal)}</p>
          </div>
          {interestLoading ? (
            <p className="text-mist">Carregando...</p>
          ) : (
            <Table
              columns={[
                { key: 'person_name', label: 'Pessoa' },
                { key: 'payment_date', label: 'Recebido em', render: (r) => dateTime(r.payment_date) },
                { key: 'interest_portion', label: 'Juros', align: 'right', render: (r) => money(r.interest_portion) },
                { key: 'principal_portion', label: 'Principal', align: 'right', render: (r) => money(r.principal_portion) },
                { key: 'payment_method', label: 'Forma', render: (r) => paymentMethodLabel(r.payment_method) },
              ]}
              rows={interestPayments}
              emptyLabel="Nenhum juro recebido ainda."
            />
          )}
        </div>
      </Modal>

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={detail ? detail.loan.person_name : ''} wide>
        {detail && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <Badge status={detail.loan.status} />
              <div className="flex gap-2">
                {detail.loan.status !== 'cancelado' && (
                  <Button variant="ghost" onClick={openEdit}>Editar</Button>
                )}
                {detail.loan.status !== 'cancelado' && (
                  <Button variant="danger" onClick={() => handleCancel(detail.loan.id)}>Cancelar empréstimo</Button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 text-center sm:grid-cols-3">
              <div className="rounded-md bg-parchment-soft p-3 dark:bg-ink"><p className="text-xs text-mist">Principal</p><p className="figures">{money(detail.loan.principal_amount)}</p></div>
              <div className="rounded-md bg-parchment-soft p-3 dark:bg-ink"><p className="text-xs text-mist">Juros ({detail.loan.interest_percentage}%)</p><p className="figures">{money(detail.loan.total_amount - detail.loan.principal_amount)}</p></div>
              <div className="rounded-md bg-parchment-soft p-3 dark:bg-ink"><p className="text-xs text-mist">Total a receber</p><p className="figures">{money(detail.loan.total_amount)}</p></div>
            </div>

            {detail.loan.status !== 'cancelado' && detail.loan.status !== 'pago' && (
              <div className="rounded-md border border-gold/30 p-4">
                <p className="mb-3 font-display text-base italic text-ink dark:text-parchment">Registrar recebimento</p>
                <p className="mb-3 text-xs text-mist">
                  Informe quanto foi de juros e, se o cliente pagou a mais, quanto vai para abater o capital emprestado.
                </p>
                <form onSubmit={handleReceiveSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Juros recebido (R$)">
                    <Input type="number" step="0.01" min="0" value={receiveForm.interestAmount}
                      onChange={(e) => setReceiveForm({ ...receiveForm, interestAmount: e.target.value })} />
                  </Field>
                  <Field label="Abatimento do capital (R$)">
                    <Input type="number" step="0.01" min="0" value={receiveForm.principalAmount}
                      onChange={(e) => setReceiveForm({ ...receiveForm, principalAmount: e.target.value })} />
                  </Field>
                  <Field label="Forma de pagamento">
                    <Select value={receiveForm.paymentMethod} onChange={(e) => setReceiveForm({ ...receiveForm, paymentMethod: e.target.value })}>
                      <option value="dinheiro">Dinheiro</option>
                      <option value="pix">PIX</option>
                      <option value="debito">Débito</option>
                      <option value="credito">Crédito</option>
                      <option value="transferencia">Transferência</option>
                      <option value="outros">Outros</option>
                    </Select>
                  </Field>
                  <Field label="Observações"><Input value={receiveForm.notes} onChange={(e) => setReceiveForm({ ...receiveForm, notes: e.target.value })} /></Field>
                  <div className="sm:col-span-2 flex justify-end">
                    <Button type="submit" disabled={savingReceive}>{savingReceive ? 'Registrando...' : 'Registrar recebimento'}</Button>
                  </div>
                </form>
              </div>
            )}

            <Tabs tabs={[
              { key: 'parcelas', label: 'Parcelas' },
              { key: 'recebido', label: `Recebido (${detail.payments.length})` },
            ]}>
              {(active) => active === 'parcelas' ? (
                <div className="space-y-2">
                  {detail.installments.map((inst) => (
                    <div key={inst.id} className="flex flex-col gap-2 rounded-md border border-ink-line/10 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-parchment/10">
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
              ) : (
                <Table
                  columns={[
                    { key: 'payment_date', label: 'Recebido em', render: (r) => dateTime(r.payment_date) },
                    { key: 'amount', label: 'Valor', align: 'right', render: (r) => money(r.amount) },
                    { key: 'principal_portion', label: 'Principal', align: 'right', render: (r) => money(r.principal_portion) },
                    { key: 'interest_portion', label: 'Juros', align: 'right', render: (r) => money(r.interest_portion) },
                    { key: 'payment_method', label: 'Forma', render: (r) => paymentMethodLabel(r.payment_method) },
                  ]}
                  rows={detail.payments}
                  emptyLabel="Nenhum valor recebido ainda."
                />
              )}
            </Tabs>
          </div>
        )}
      </Modal>
    </div>
  );
}

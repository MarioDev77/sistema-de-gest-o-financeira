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

// 1 a cada 1 mês, até 48 meses — ou prazo indeterminado (sem parcelas fixas,
// juros lançados mês a mês em "Registrar recebimento").
const INSTALLMENT_OPTIONS = Array.from({ length: 48 }, (_, i) => i + 1);
const INDETERMINADO = 'indeterminado';

const EMPTY_FORM = {
  personName: '', document: '', phone: '', principalAmount: '', interestType: 'fixo',
  interestPercentage: '', loanDate: '', installmentsCount: '1', notes: '',
};

const EMPTY_RECEIPT_FORM = {
  personName: '', amount: '', receiptDate: '', paymentMethod: 'dinheiro', notes: '',
};

const EMPTY_EDIT_FORM = {
  personName: '', document: '', phone: '', dueDate: '', notes: '',
  principalAmount: '', interestType: 'fixo', interestPercentage: '', loanDate: '', installmentsCount: '1',
};

const EMPTY_RECEIVE_FORM = {
  interestAmount: '', principalAmount: '', paymentMethod: 'dinheiro', notes: '',
};

const EMPTY_RECEIPT_EDIT_FORM = {
  personName: '', amount: '', receiptDate: '', paymentMethod: 'dinheiro', notes: '',
};

const EMPTY_PAYMENT_EDIT_FORM = {
  interestAmount: '', principalAmount: '', paymentDate: '', paymentMethod: 'dinheiro', notes: '',
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
  const [editingLoanId, setEditingLoanId] = useState(null);
  const [editHasPayments, setEditHasPayments] = useState(false);

  const [receiveForm, setReceiveForm] = useState(EMPTY_RECEIVE_FORM);
  const [savingReceive, setSavingReceive] = useState(false);

  const [interestModalOpen, setInterestModalOpen] = useState(false);
  const [interestPayments, setInterestPayments] = useState([]);
  const [interestTotal, setInterestTotal] = useState(0);
  const [interestLoading, setInterestLoading] = useState(false);
  const [scheduleInstallments, setScheduleInstallments] = useState([]);
  const [scheduleTotal, setScheduleTotal] = useState(0);

  const [installmentEditModalOpen, setInstallmentEditModalOpen] = useState(false);
  const [installmentEditForm, setInstallmentEditForm] = useState({ dueDate: '', amount: '' });
  const [editingInstallmentId, setEditingInstallmentId] = useState(null);
  const [savingInstallmentEdit, setSavingInstallmentEdit] = useState(false);

  const [receiptEditModalOpen, setReceiptEditModalOpen] = useState(false);
  const [receiptEditForm, setReceiptEditForm] = useState(EMPTY_RECEIPT_EDIT_FORM);
  const [editingReceiptId, setEditingReceiptId] = useState(null);
  const [savingReceiptEdit, setSavingReceiptEdit] = useState(false);

  const [paymentEditModalOpen, setPaymentEditModalOpen] = useState(false);
  const [paymentEditForm, setPaymentEditForm] = useState(EMPTY_PAYMENT_EDIT_FORM);
  const [editingPaymentId, setEditingPaymentId] = useState(null);
  const [savingPaymentEdit, setSavingPaymentEdit] = useState(false);

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
      const isOpenEnded = form.installmentsCount === INDETERMINADO;
      await api.post('/loans', {
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

  function fillEditForm(loan) {
    setEditForm({
      personName: loan.person_name || '',
      document: loan.document || '',
      phone: loan.phone || '',
      dueDate: loan.due_date ? loan.due_date.slice(0, 10) : '',
      notes: loan.notes || '',
      principalAmount: loan.principal_amount || '',
      interestType: loan.interest_type || 'fixo',
      interestPercentage: loan.interest_percentage || '',
      loanDate: loan.loan_date ? loan.loan_date.slice(0, 10) : '',
      installmentsCount: loan.is_open_ended ? INDETERMINADO : String(loan.installments_count || 1),
    });
  }

  function openEdit() {
    if (!detail) return;
    setEditingLoanId(detail.loan.id);
    setEditHasPayments((detail.payments || []).length > 0);
    fillEditForm(detail.loan);
    setEditModalOpen(true);
  }

  // Botão "Editar" direto na linha da tabela principal — não precisa abrir o
  // detalhe do empréstimo antes para editar nome, valores, juros, parcelas etc.
  async function openEditFromRow(loan) {
    try {
      const data = await api.get(`/loans/${loan.id}`);
      setEditingLoanId(loan.id);
      setEditHasPayments((data.payments || []).length > 0);
      fillEditForm(data.loan);
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
      const result = await api.put(`/loans/${editingLoanId}`, payload);
      if (result.scheduleRebuilt === false) {
        setError('Nome/observações atualizados. Valor, juros e parcelas não foram alterados porque este empréstimo já tem recebimentos registrados.');
      }
      if (detail && detail.loan.id === editingLoanId) {
        const data = await api.get(`/loans/${editingLoanId}`);
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

  function openEditReceipt(receipt) {
    setEditingReceiptId(receipt.id);
    setReceiptEditForm({
      personName: receipt.person_name || '',
      amount: receipt.amount,
      receiptDate: receipt.receipt_date ? receipt.receipt_date.slice(0, 10) : '',
      paymentMethod: receipt.payment_method || 'dinheiro',
      notes: receipt.notes || '',
    });
    setReceiptEditModalOpen(true);
  }

  async function handleReceiptEditSubmit(e) {
    e.preventDefault();
    setSavingReceiptEdit(true);
    setError('');
    try {
      await api.put(`/receipts/${editingReceiptId}`, {
        ...receiptEditForm,
        amount: Number(receiptEditForm.amount),
      });
      setReceiptEditModalOpen(false);
      await loadReceipts();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingReceiptEdit(false);
    }
  }

  function openEditPayment(payment) {
    setEditingPaymentId(payment.id);
    setPaymentEditForm({
      interestAmount: payment.interest_portion || '0',
      principalAmount: payment.principal_portion || '0',
      paymentDate: payment.payment_date ? payment.payment_date.slice(0, 10) : '',
      paymentMethod: payment.payment_method || 'dinheiro',
      notes: payment.notes || '',
    });
    setPaymentEditModalOpen(true);
  }

  async function handlePaymentEditSubmit(e) {
    e.preventDefault();
    setSavingPaymentEdit(true);
    setError('');
    try {
      await api.put(`/loans/payments/${editingPaymentId}`, {
        interestAmount: Number(paymentEditForm.interestAmount) || 0,
        principalAmount: Number(paymentEditForm.principalAmount) || 0,
        paymentDate: paymentEditForm.paymentDate || null,
        paymentMethod: paymentEditForm.paymentMethod,
        notes: paymentEditForm.notes,
      });
      setPaymentEditModalOpen(false);
      // Atualiza tudo que pode ter mudado: lista de empréstimos, detalhe aberto
      // e a lista de juros recebidos (se estiver aberta).
      await load();
      if (detail) {
        const data = await api.get(`/loans/${detail.loan.id}`);
        setDetail(data);
      }
      if (interestModalOpen) {
        const data = await api.get('/loans/payments/interest');
        setInterestPayments(data.payments);
        setInterestTotal(data.total);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingPaymentEdit(false);
    }
  }

  async function openInterestModal() {
    setInterestModalOpen(true);
    setInterestLoading(true);
    try {
      const [interestData, scheduleData] = await Promise.all([
        api.get('/loans/payments/interest'),
        api.get('/loans/installments/schedule'),
      ]);
      setInterestPayments(interestData.payments);
      setInterestTotal(interestData.total);
      setScheduleInstallments(scheduleData.installments);
      setScheduleTotal(scheduleData.totalInterest);
    } catch (err) {
      setError(err.message);
    } finally {
      setInterestLoading(false);
    }
  }

  function openEditInstallment(inst) {
    setEditingInstallmentId(inst.id);
    setInstallmentEditForm({
      dueDate: inst.due_date ? inst.due_date.slice(0, 10) : '',
      amount: inst.amount,
    });
    setInstallmentEditModalOpen(true);
  }

  async function handleInstallmentEditSubmit(e) {
    e.preventDefault();
    setSavingInstallmentEdit(true);
    setError('');
    try {
      await api.put(`/loans/installments/${editingInstallmentId}`, {
        dueDate: installmentEditForm.dueDate || null,
        amount: installmentEditForm.amount === '' ? undefined : Number(installmentEditForm.amount),
      });
      setInstallmentEditModalOpen(false);
      await openInterestModal();
      await load();
      if (detail) {
        const data = await api.get(`/loans/${detail.loan.id}`);
        setDetail(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingInstallmentEdit(false);
    }
  }

  const totals = loans.reduce((acc, l) => ({
    lent: acc.lent + Number(l.principal_amount),
    toReceive: acc.toReceive + Number(l.total_amount),
    received: acc.received + Number(l.received),
    receivedThisMonth: acc.receivedThisMonth + Number(l.received_this_month || 0),
  }), { lent: 0, toReceive: 0, received: 0, receivedThisMonth: 0 });

  const columns = [
    { key: 'person_name', label: 'Pessoa', render: (r) => (
      <button onClick={() => openDetail(r)} className="text-left text-gold hover:underline">{r.person_name}</button>
    ) },
    { key: 'principal_amount', label: 'Valor', align: 'right', render: (r) => money(r.principal_amount) },
    { key: 'total_amount', label: 'Total', align: 'right', render: (r) => money(r.total_amount) },
    { key: 'received', label: 'Recebido', align: 'right', render: (r) => money(r.received) },
    { key: 'remaining', label: 'Restante', align: 'right', render: (r) => money(r.remaining) },
    { key: 'loan_date', label: 'Data do empréstimo', render: (r) => shortDate(r.loan_date) },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
    { key: 'actions', label: '', render: (r) => (
      <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => openEditFromRow(r)}>Editar</Button>
    ) },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={`${loans.length} empréstimo(s)`}
        title="Empréstimos"
        action={(
          <div className="flex gap-2">
            <Button variant="ghost" onClick={openInterestModal}>Juros por mês</Button>
            <Button variant="ghost" onClick={() => setReceiptModalOpen(true)}>+ Recibo</Button>
            <Button onClick={() => setModalOpen(true)}>+ Novo empréstimo</Button>
          </div>
        )}
      />
      <ErrorBanner message={error} />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total emprestado" value={money(totals.lent)} />
        <StatCard label="Total a receber" value={money(totals.toReceive)} />
        <StatCard label="Total recebido no mês" value={money(totals.receivedThisMonth)} />
        <StatCard label="Total recebido (geral)" value={money(totals.received)} />
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
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => openEditReceipt(r)}>Editar</Button>
                    <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => handleCancelReceipt(r.id)}>Cancelar</Button>
                  </div>
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
          <Field label="Valor emprestado (R$)">
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
          <Field label="Data do empréstimo"><Input type="date" required value={form.loanDate} onChange={(e) => setForm({ ...form, loanDate: e.target.value })} /></Field>
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

      <Modal open={receiptModalOpen} onClose={() => setReceiptModalOpen(false)} title="Novo recibo">
        <form onSubmit={handleReceiptSubmit} className="grid grid-cols-1 gap-4">
          <Field label="Nome da pessoa"><Input required value={receiptForm.personName} onChange={(e) => setReceiptForm({ ...receiptForm, personName: e.target.value })} /></Field>
          <Field label="Valor recebido (R$)">
            <CurrencyInput required value={receiptForm.amount} onValueChange={(v) => setReceiptForm({ ...receiptForm, amount: v })} />
          </Field>
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

      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title="Editar empréstimo" wide>
        <form onSubmit={handleEditSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {editHasPayments && (
            <p className="sm:col-span-2 rounded-md bg-parchment-soft p-3 text-xs text-mist dark:bg-ink">
              Este empréstimo já tem recebimentos registrados, então valor, juros e número de
              parcelas não podem ser alterados aqui (só nome, contato, vencimento e observações).
            </p>
          )}
          <Field label="Nome da pessoa"><Input required value={editForm.personName} onChange={(e) => setEditForm({ ...editForm, personName: e.target.value })} /></Field>
          <Field label="CPF/CNPJ (opcional)"><Input value={editForm.document} onChange={(e) => setEditForm({ ...editForm, document: e.target.value })} /></Field>
          <Field label="Telefone"><Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></Field>
          <Field label="Valor emprestado (R$)">
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
          <Field label="Data do empréstimo">
            <Input type="date" disabled={editHasPayments} value={editForm.loanDate}
              onChange={(e) => setEditForm({ ...editForm, loanDate: e.target.value })} />
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
          {editForm.installmentsCount === INDETERMINADO && (
            <div className="sm:col-span-2" />
          )}
          {editForm.installmentsCount !== INDETERMINADO && (
            <Field label="Vencimento (próxima parcela / geral)">
              <Input type="date" value={editForm.dueDate} onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })} />
            </Field>
          )}
          <div className="sm:col-span-2">
            <Field label="Observações"><TextArea rows={2} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} /></Field>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setEditModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={savingEdit}>{savingEdit ? 'Salvando...' : 'Salvar alterações'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={receiptEditModalOpen} onClose={() => setReceiptEditModalOpen(false)} title="Editar recibo">
        <form onSubmit={handleReceiptEditSubmit} className="grid grid-cols-1 gap-4">
          <Field label="Nome da pessoa"><Input required value={receiptEditForm.personName} onChange={(e) => setReceiptEditForm({ ...receiptEditForm, personName: e.target.value })} /></Field>
          <Field label="Valor recebido (R$)">
            <CurrencyInput required value={receiptEditForm.amount} onValueChange={(v) => setReceiptEditForm({ ...receiptEditForm, amount: v })} />
          </Field>
          <Field label="Data do recebimento"><Input type="date" required value={receiptEditForm.receiptDate} onChange={(e) => setReceiptEditForm({ ...receiptEditForm, receiptDate: e.target.value })} /></Field>
          <Field label="Forma de pagamento">
            <Select value={receiptEditForm.paymentMethod} onChange={(e) => setReceiptEditForm({ ...receiptEditForm, paymentMethod: e.target.value })}>
              <option value="dinheiro">Dinheiro</option>
              <option value="pix">PIX</option>
              <option value="debito">Débito</option>
              <option value="credito">Crédito</option>
              <option value="transferencia">Transferência</option>
              <option value="outros">Outros</option>
            </Select>
          </Field>
          <Field label="Observações"><TextArea rows={2} value={receiptEditForm.notes} onChange={(e) => setReceiptEditForm({ ...receiptEditForm, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setReceiptEditModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={savingReceiptEdit}>{savingReceiptEdit ? 'Salvando...' : 'Salvar alterações'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={paymentEditModalOpen} onClose={() => setPaymentEditModalOpen(false)} title="Editar recebimento">
        <form onSubmit={handlePaymentEditSubmit} className="grid grid-cols-1 gap-4">
          <p className="text-xs text-mist">
            O caixa (Fluxo de Caixa) é ajustado automaticamente pela diferença entre o valor antigo e o novo.
          </p>
          <Field label="Juros recebido (R$)">
            <CurrencyInput value={paymentEditForm.interestAmount}
              onValueChange={(v) => setPaymentEditForm({ ...paymentEditForm, interestAmount: v })} />
          </Field>
          <Field label="Abatimento do capital (R$)">
            <CurrencyInput value={paymentEditForm.principalAmount}
              onValueChange={(v) => setPaymentEditForm({ ...paymentEditForm, principalAmount: v })} />
          </Field>
          <Field label="Data do recebimento"><Input type="date" value={paymentEditForm.paymentDate} onChange={(e) => setPaymentEditForm({ ...paymentEditForm, paymentDate: e.target.value })} /></Field>
          <Field label="Forma de pagamento">
            <Select value={paymentEditForm.paymentMethod} onChange={(e) => setPaymentEditForm({ ...paymentEditForm, paymentMethod: e.target.value })}>
              <option value="dinheiro">Dinheiro</option>
              <option value="pix">PIX</option>
              <option value="debito">Débito</option>
              <option value="credito">Crédito</option>
              <option value="transferencia">Transferência</option>
              <option value="outros">Outros</option>
            </Select>
          </Field>
          <Field label="Observações"><Input value={paymentEditForm.notes} onChange={(e) => setPaymentEditForm({ ...paymentEditForm, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setPaymentEditModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={savingPaymentEdit}>{savingPaymentEdit ? 'Salvando...' : 'Salvar alterações'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={interestModalOpen} onClose={() => setInterestModalOpen(false)} title="Juros por mês" wide>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-md bg-parchment-soft p-3 text-center dark:bg-ink">
              <p className="text-xs text-mist">Total de juros previsto (todas as parcelas)</p>
              <p className="figures text-lg">{money(scheduleTotal)}</p>
            </div>
            <div className="rounded-md bg-parchment-soft p-3 text-center dark:bg-ink">
              <p className="text-xs text-mist">Total de juros já recebido</p>
              <p className="figures text-lg">{money(interestTotal)}</p>
            </div>
          </div>
          {interestLoading ? (
            <p className="text-mist">Carregando...</p>
          ) : (
            <Tabs tabs={[
              { key: 'parcelas', label: `Parcelas do mês (${scheduleInstallments.length})` },
              { key: 'recebidos', label: `Recebidos (${interestPayments.length})` },
            ]}>
              {(active) => active === 'parcelas' ? (
                <Table
                  columns={[
                    { key: 'person_name', label: 'Pessoa' },
                    { key: 'installment_number', label: 'Parcela' },
                    { key: 'due_date', label: 'Vencimento', render: (r) => shortDate(r.due_date) },
                    { key: 'interest_amount', label: 'Juros previsto', align: 'right', render: (r) => money(r.interest_amount) },
                    { key: 'amount', label: 'Valor total', align: 'right', render: (r) => money(r.amount) },
                    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
                    { key: 'actions', label: '', render: (r) => (
                      <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => openEditInstallment(r)}>Editar</Button>
                    ) },
                  ]}
                  rows={scheduleInstallments}
                  emptyLabel="Nenhuma parcela cadastrada ainda."
                />
              ) : (
                <Table
                  columns={[
                    { key: 'person_name', label: 'Pessoa' },
                    { key: 'installment_due_date', label: 'Venc. da parcela', render: (r) => r.installment_due_date ? shortDate(r.installment_due_date) : '—' },
                    { key: 'payment_date', label: 'Recebido em', render: (r) => dateTime(r.payment_date) },
                    { key: 'interest_portion', label: 'Juros', align: 'right', render: (r) => money(r.interest_portion) },
                    { key: 'principal_portion', label: 'Principal', align: 'right', render: (r) => money(r.principal_portion) },
                    { key: 'payment_method', label: 'Forma', render: (r) => paymentMethodLabel(r.payment_method) },
                    { key: 'actions', label: '', render: (r) => (
                      <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => openEditPayment(r)}>Editar</Button>
                    ) },
                  ]}
                  rows={interestPayments}
                  emptyLabel="Nenhum juro recebido ainda."
                />
              )}
            </Tabs>
          )}
        </div>
      </Modal>

      <Modal open={installmentEditModalOpen} onClose={() => setInstallmentEditModalOpen(false)} title="Editar parcela">
        <form onSubmit={handleInstallmentEditSubmit} className="grid grid-cols-1 gap-4">
          <Field label="Data de vencimento">
            <Input type="date" required value={installmentEditForm.dueDate}
              onChange={(e) => setInstallmentEditForm({ ...installmentEditForm, dueDate: e.target.value })} />
          </Field>
          <Field label="Valor da parcela (R$)">
            <CurrencyInput value={installmentEditForm.amount}
              onValueChange={(v) => setInstallmentEditForm({ ...installmentEditForm, amount: v })} />
          </Field>
          <p className="text-xs text-mist">
            Se a parcela já tiver algum valor recebido, só a data de vencimento pode ser alterada.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setInstallmentEditModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={savingInstallmentEdit}>{savingInstallmentEdit ? 'Salvando...' : 'Salvar alterações'}</Button>
          </div>
        </form>
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
                    <CurrencyInput value={receiveForm.interestAmount}
                      onValueChange={(v) => setReceiveForm({ ...receiveForm, interestAmount: v })} />
                  </Field>
                  <Field label="Abatimento do capital (R$)">
                    <CurrencyInput value={receiveForm.principalAmount}
                      onValueChange={(v) => setReceiveForm({ ...receiveForm, principalAmount: v })} />
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
                  {detail.loan.is_open_ended && detail.installments.length === 0 && (
                    <p className="rounded-md border border-dashed border-ink-line/20 p-4 text-center text-xs text-mist dark:border-parchment/20">
                      Empréstimo de prazo indeterminado — sem parcelas fixas. Use
                      &quot;Registrar recebimento&quot; acima para lançar juros e abatimentos mês a mês.
                    </p>
                  )}
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
                            <CurrencyInput className="w-32" placeholder="Valor"
                              value={payAmount[inst.id] || ''}
                              onValueChange={(v) => setPayAmount({ ...payAmount, [inst.id]: v })} />
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
                    { key: 'actions', label: '', render: (r) => (
                      <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => openEditPayment(r)}>Editar</Button>
                    ) },
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

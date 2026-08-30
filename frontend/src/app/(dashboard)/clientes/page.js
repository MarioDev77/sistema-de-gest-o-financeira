'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useApiClient } from '@/lib/useApiClient';
import { money, shortDate, dateTime, paymentMethodLabel } from '@/lib/format';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Field, { Input, TextArea } from '@/components/ui/Field';
import Tabs from '@/components/ui/Tabs';

const EMPTY_FORM = { name: '', document: '', phone: '', whatsapp: '', email: '', address: '', notes: '' };

export default function ClientesPage() {
  const { user } = useAuth();
  const api = useApiClient();
  const isAdmin = user?.role === 'admin';

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  async function loadCustomers() {
    setLoading(true);
    try {
      const data = await api.get('/customers');
      setCustomers(data.customers);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadCustomers(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(customer) {
    setEditingId(customer.id);
    setForm({
      name: customer.name, document: customer.document || '', phone: customer.phone || '',
      whatsapp: customer.whatsapp || '', email: customer.email || '',
      address: customer.address || '', notes: customer.notes || '',
    });
    setModalOpen(true);
  }

  async function openHistory(customer) {
    setError('');
    try {
      const data = await api.get(`/customers/${customer.id}/history`);
      setHistory(data);
      setHistoryOpen(true);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        await api.put(`/customers/${editingId}`, form);
      } else {
        await api.post('/customers', form);
      }
      setModalOpen(false);
      await loadCustomers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Excluir este cliente?')) return;
    try {
      await api.delete(`/customers/${id}`);
      await loadCustomers();
    } catch (err) {
      setError(err.message);
    }
  }

  const columns = [
    { key: 'name', label: 'Nome', render: (r) => (
      <button onClick={() => openHistory(r)} className="text-left hover:text-gold hover:underline">{r.name}</button>
    ) },
    { key: 'document', label: 'CPF/CNPJ', render: (r) => r.document || '—' },
    { key: 'phone', label: 'Telefone', render: (r) => r.phone || '—' },
    { key: 'email', label: 'E-mail', render: (r) => r.email || '—' },
    { key: 'actions', label: '', render: (r) => (
      <div className="flex justify-end gap-2">
        <button onClick={() => openEdit(r)} className="text-xs text-gold hover:underline">Editar</button>
        {isAdmin && <button onClick={() => handleDelete(r.id)} className="text-xs text-bordeaux hover:underline">Excluir</button>}
      </div>
    ) },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={`${customers.length} cliente(s)`}
        title="Clientes"
        action={<Button onClick={openCreate}>+ Novo cliente</Button>}
      />
      <ErrorBanner message={error} />
      {loading ? <p className="text-mist">Carregando...</p> : <Table columns={columns} rows={customers} />}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Editar cliente' : 'Novo cliente'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Nome"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="CPF/CNPJ"><Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} /></Field>
          <Field label="Telefone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="WhatsApp"><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></Field>
          <Field label="E-mail"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Endereço"><TextArea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title={history ? `Histórico — ${history.customer.name}` : ''} wide>
        {history && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-md bg-parchment-soft p-3 dark:bg-ink">
                <p className="text-xs text-mist">Total comprado</p>
                <p className="figures text-lg">{money(history.totals.totalPurchased)}</p>
              </div>
              <div className="rounded-md bg-parchment-soft p-3 dark:bg-ink">
                <p className="text-xs text-mist">Total recebido</p>
                <p className="figures text-lg text-sage">{money(history.totals.totalReceived)}</p>
              </div>
              <div className="rounded-md bg-parchment-soft p-3 dark:bg-ink">
                <p className="text-xs text-mist">Pendente</p>
                <p className="figures text-lg text-bordeaux">{money(history.totals.totalPending)}</p>
              </div>
            </div>
            <div>
              <p className="mb-2 font-medium">Compras</p>
              <Table
                columns={[
                  { key: 'sale_number', label: 'Venda' },
                  { key: 'sale_date', label: 'Data', render: (r) => shortDate(r.sale_date) },
                  { key: 'total', label: 'Total', align: 'right', render: (r) => money(r.total) },
                  { key: 'status', label: 'Status' },
                ]}
                rows={history.sales}
                emptyLabel="Nenhuma compra ainda."
              />
            </div>
            <Tabs tabs={[
              { key: 'recebido', label: `Recebido (${history.receivedPayments.length})` },
              { key: 'pendente', label: 'Pendente' },
            ]}>
              {(active) => active === 'recebido' ? (
                <Table
                  columns={[
                    { key: 'payment_date', label: 'Recebido em', render: (r) => dateTime(r.payment_date) },
                    { key: 'sale_number', label: 'Venda' },
                    { key: 'amount', label: 'Valor', align: 'right', render: (r) => money(r.amount) },
                    { key: 'payment_method', label: 'Forma', render: (r) => paymentMethodLabel(r.payment_method) },
                  ]}
                  rows={history.receivedPayments}
                  emptyLabel="Nenhum valor recebido ainda."
                />
              ) : (
                <Table
                  columns={[
                    { key: 'sale_number', label: 'Venda' },
                    { key: 'due_date', label: 'Vencimento', render: (r) => shortDate(r.due_date) },
                    { key: 'amount', label: 'Valor', align: 'right', render: (r) => money(r.amount - r.paid_amount) },
                    { key: 'status', label: 'Status' },
                  ]}
                  rows={history.pendingInstallments}
                  emptyLabel="Nenhuma pendência."
                />
              )}
            </Tabs>
          </div>
        )}
      </Modal>
    </div>
  );
}

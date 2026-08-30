'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useApiClient } from '@/lib/useApiClient';
import { money, shortDate, dateTime, paymentMethodLabel } from '@/lib/format';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Field, { Input, Select } from '@/components/ui/Field';
import Tabs from '@/components/ui/Tabs';

const PAYMENT_METHODS = [
  { value: 'dinheiro', label: 'Dinheiro' }, { value: 'pix', label: 'PIX' },
  { value: 'debito', label: 'Débito' }, { value: 'credito', label: 'Crédito' },
  { value: 'transferencia', label: 'Transferência' }, { value: 'outros', label: 'Outros' },
];

const EMPTY_SALE_FORM = {
  customerId: '', paymentMethod: 'dinheiro', saleType: 'avista',
  discount: '0', surcharge: '0', downPayment: '0', installmentsCount: '2', notes: '',
};

export default function VendasPage() {
  const { user } = useAuth();
  const api = useApiClient();
  const isAdmin = user?.role === 'admin';

  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [saleForm, setSaleForm] = useState(EMPTY_SALE_FORM);
  const [items, setItems] = useState([{ productId: '', quantity: 1 }]);
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [payAmount, setPayAmount] = useState({});

  async function loadAll() {
    setLoading(true);
    try {
      const [salesData, productsData, customersData] = await Promise.all([
        api.get('/sales'),
        api.get('/products'),
        api.get('/customers'),
      ]);
      setSales(salesData.sales);
      setProducts(productsData.products);
      setCustomers(customersData.customers);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function openCreate() {
    setSaleForm(EMPTY_SALE_FORM);
    setItems([{ productId: '', quantity: 1, unitPrice: '' }]);
    setModalOpen(true);
  }

  function updateItem(index, patch) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function selectProductForItem(index, productId) {
    const p = products.find((prod) => String(prod.id) === String(productId));
    updateItem(index, {
      productId,
      // Preenche o valor com o preço de tabela do produto, mas o campo continua
      // editável — permite vender por um valor diferente do cadastrado.
      unitPrice: p ? String(p.price) : '',
    });
  }

  function addItemRow() {
    setItems((prev) => [...prev, { productId: '', quantity: 1, unitPrice: '' }]);
  }

  function removeItemRow(index) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function itemUnitPrice(it) {
    if (it.unitPrice !== '' && it.unitPrice !== undefined && it.unitPrice !== null) return Number(it.unitPrice);
    const p = products.find((prod) => String(prod.id) === String(it.productId));
    return p ? Number(p.price) : 0;
  }

  function estimateTotal() {
    let subtotal = 0;
    items.forEach((it) => {
      if (!it.productId) return;
      subtotal += itemUnitPrice(it) * Number(it.quantity || 0);
    });
    return subtotal - Number(saleForm.discount || 0) + Number(saleForm.surcharge || 0);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        customerId: saleForm.customerId || null,
        items: items
          .filter((it) => it.productId)
          .map((it) => ({
            productId: Number(it.productId),
            quantity: Number(it.quantity),
            unitPrice: itemUnitPrice(it),
          })),
        paymentMethod: saleForm.paymentMethod,
        saleType: saleForm.saleType,
        discount: Number(saleForm.discount) || 0,
        surcharge: Number(saleForm.surcharge) || 0,
        notes: saleForm.notes || null,
      };
      if (saleForm.saleType === 'aprazo') {
        payload.installmentsCount = Number(saleForm.installmentsCount);
        payload.downPayment = Number(saleForm.downPayment) || 0;
      }
      await api.post('/sales', payload);
      setModalOpen(false);
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function openDetail(sale) {
    setError('');
    try {
      const data = await api.get(`/sales/${sale.id}`);
      setDetail(data);
      setDetailOpen(true);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handlePayInstallment(installmentId) {
    const amount = Number(payAmount[installmentId]);
    if (!amount || amount <= 0) return;
    try {
      await api.post(`/sales/installments/${installmentId}/pay`, { amount, paymentMethod: 'dinheiro' });
      const data = await api.get(`/sales/${detail.sale.id}`);
      setDetail(data);
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCancelSale(id) {
    if (!confirm('Cancelar esta venda? O estoque será estornado.')) return;
    try {
      await api.post(`/sales/${id}/cancel`);
      setDetailOpen(false);
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  const columns = [
    { key: 'sale_number', label: 'Número', render: (r) => (
      <button onClick={() => openDetail(r)} className="text-gold hover:underline">{r.sale_number}</button>
    ) },
    { key: 'sale_date', label: 'Data', render: (r) => shortDate(r.sale_date) },
    { key: 'customer_name', label: 'Cliente', render: (r) => r.customer_name || '—' },
    { key: 'sale_type', label: 'Tipo', render: (r) => (r.sale_type === 'avista' ? 'À vista' : 'A prazo') },
    { key: 'total', label: 'Total', align: 'right', render: (r) => money(r.total) },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
  ];

  return (
    <div>
      <PageHeader eyebrow={`${sales.length} venda(s)`} title="Vendas" action={<Button onClick={openCreate}>+ Nova venda</Button>} />
      <ErrorBanner message={error} />
      {loading ? <p className="text-mist">Carregando...</p> : <Table columns={columns} rows={sales} />}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nova venda" wide>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Cliente (opcional)">
            <Select value={saleForm.customerId} onChange={(e) => setSaleForm({ ...saleForm, customerId: e.target.value })}>
              <option value="">Venda avulsa</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>

          <div>
            <p className="mb-2 text-xs text-mist">Itens da venda</p>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Select className="flex-1" value={item.productId} onChange={(e) => selectProductForItem(idx, e.target.value)}>
                    <option value="">Selecione o produto...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id} disabled={p.quantity <= 0}>
                        {p.name} — {money(p.price)} (estoque: {p.quantity})
                      </option>
                    ))}
                  </Select>
                  <Input
                    type="number" min="1" className="w-20"
                    placeholder="Qtd"
                    value={item.quantity}
                    onChange={(e) => updateItem(idx, { quantity: e.target.value })}
                  />
                  <Input
                    type="number" min="0" step="0.01" className="w-28"
                    placeholder="Valor un."
                    value={item.unitPrice ?? ''}
                    onChange={(e) => updateItem(idx, { unitPrice: e.target.value })}
                  />
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItemRow(idx)} className="text-bordeaux">✕</button>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-1 text-xs text-mist">O valor unitário vem preenchido com o preço cadastrado do produto, mas pode ser alterado para essa venda.</p>
            <button type="button" onClick={addItemRow} className="mt-2 text-xs text-gold hover:underline">+ adicionar item</button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Desconto (R$)"><Input type="number" step="0.01" value={saleForm.discount} onChange={(e) => setSaleForm({ ...saleForm, discount: e.target.value })} /></Field>
            <Field label="Acréscimo (R$)"><Input type="number" step="0.01" value={saleForm.surcharge} onChange={(e) => setSaleForm({ ...saleForm, surcharge: e.target.value })} /></Field>
            <Field label="Forma de pagamento">
              <Select value={saleForm.paymentMethod} onChange={(e) => setSaleForm({ ...saleForm, paymentMethod: e.target.value })}>
                {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </Select>
            </Field>
          </div>

          <Field label="Tipo de venda">
            <Select value={saleForm.saleType} onChange={(e) => setSaleForm({ ...saleForm, saleType: e.target.value })}>
              <option value="avista">À vista</option>
              <option value="aprazo">A prazo</option>
            </Select>
          </Field>

          {saleForm.saleType === 'aprazo' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 rounded-md bg-parchment-soft p-4 dark:bg-ink">
              <Field label="Entrada (R$)"><Input type="number" step="0.01" value={saleForm.downPayment} onChange={(e) => setSaleForm({ ...saleForm, downPayment: e.target.value })} /></Field>
              <Field label="Número de parcelas"><Input type="number" min="1" value={saleForm.installmentsCount} onChange={(e) => setSaleForm({ ...saleForm, installmentsCount: e.target.value })} /></Field>
            </div>
          )}

          <div className="flex items-center justify-between rounded-md bg-gold/10 px-4 py-3">
            <span className="text-sm text-mist">Total estimado</span>
            <span className="figures font-display text-xl text-gold">{money(estimateTotal())}</span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Registrando...' : 'Confirmar venda'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={detail ? `Venda ${detail.sale.sale_number}` : ''} wide>
        {detail && (
          <div className="space-y-5 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-mist">{detail.sale.customer_name || 'Venda avulsa'} • {shortDate(detail.sale.sale_date)}</p>
                <Badge status={detail.sale.status} />
              </div>
              {isAdmin && detail.sale.status === 'concluida' && (
                <Button variant="danger" onClick={() => handleCancelSale(detail.sale.id)}>Cancelar venda</Button>
              )}
            </div>

            <Table
              columns={[
                { key: 'product_name', label: 'Produto' },
                { key: 'quantity', label: 'Qtd', align: 'right' },
                { key: 'unit_price', label: 'Preço unit.', align: 'right', render: (r) => money(r.unit_price) },
                { key: 'line_total', label: 'Total', align: 'right', render: (r) => money(r.line_total) },
              ]}
              rows={detail.items}
            />

            <div className="grid grid-cols-1 gap-3 text-center sm:grid-cols-3">
              <div className="rounded-md bg-parchment-soft p-3 dark:bg-ink"><p className="text-xs text-mist">Subtotal</p><p className="figures">{money(detail.sale.subtotal)}</p></div>
              <div className="rounded-md bg-parchment-soft p-3 dark:bg-ink"><p className="text-xs text-mist">Total</p><p className="figures">{money(detail.sale.total)}</p></div>
              <div className="rounded-md bg-parchment-soft p-3 dark:bg-ink"><p className="text-xs text-mist">Lucro</p><p className="figures">{money(detail.sale.profit)}</p></div>
            </div>

            {detail.installments.length > 0 ? (
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
                              <Input
                                type="number" step="0.01" className="w-24"
                                placeholder="Valor"
                                value={payAmount[inst.id] || ''}
                                onChange={(e) => setPayAmount({ ...payAmount, [inst.id]: e.target.value })}
                              />
                              <Button onClick={() => handlePayInstallment(inst.id)}>Pagar</Button>
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
                      { key: 'payment_method', label: 'Forma', render: (r) => paymentMethodLabel(r.payment_method) },
                    ]}
                    rows={detail.payments}
                    emptyLabel="Nenhum valor recebido ainda."
                  />
                )}
              </Tabs>
            ) : (
              <div>
                <p className="mb-2 font-medium">Recebido</p>
                <Table
                  columns={[
                    { key: 'payment_date', label: 'Recebido em', render: (r) => dateTime(r.payment_date) },
                    { key: 'amount', label: 'Valor', align: 'right', render: (r) => money(r.amount) },
                    { key: 'payment_method', label: 'Forma', render: (r) => paymentMethodLabel(r.payment_method) },
                  ]}
                  rows={detail.payments}
                  emptyLabel="Nenhum valor recebido ainda."
                />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

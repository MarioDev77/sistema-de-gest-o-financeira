'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useApiClient } from '@/lib/useApiClient';
import { shortDate } from '@/lib/format';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Field, { Input, Select, TextArea } from '@/components/ui/Field';

const REASONS = [
  { value: 'compra', label: 'Compra (entrada)' },
  { value: 'devolucao', label: 'Devolução (entrada)' },
  { value: 'perda', label: 'Perda (saída)' },
  { value: 'ajuste', label: 'Ajuste' },
];

export default function EstoquePage() {
  const { user } = useAuth();
  const api = useApiClient();
  const isAdmin = user?.role === 'admin';

  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ productId: '', direction: 'entrada', reason: 'compra', quantity: '', notes: '' });

  async function loadAll() {
    setLoading(true);
    try {
      const [movementsData, productsData] = await Promise.all([
        api.get('/stock-movements'),
        api.get('/products'),
      ]);
      setMovements(movementsData.movements);
      setProducts(productsData.products);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/stock-movements', { ...form, quantity: Number(form.quantity) });
      setModalOpen(false);
      setForm({ productId: '', direction: 'entrada', reason: 'compra', quantity: '', notes: '' });
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const lowStockProducts = products.filter((p) => p.quantity <= p.min_stock);

  const columns = [
    { key: 'created_at', label: 'Data', render: (r) => shortDate(r.created_at) },
    { key: 'product_name', label: 'Produto' },
    { key: 'direction', label: 'Direção', render: (r) => (r.direction === 'entrada' ? 'Entrada' : 'Saída') },
    { key: 'reason', label: 'Motivo' },
    { key: 'quantity', label: 'Quantidade', align: 'right' },
    { key: 'notes', label: 'Observações', render: (r) => r.notes || '—' },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Movimentações recentes"
        title="Estoque"
        action={isAdmin && <Button onClick={() => setModalOpen(true)}>+ Lançar movimentação</Button>}
      />
      <ErrorBanner message={error} />

      {lowStockProducts.length > 0 && (
        <div className="mb-6 rounded-lg border border-bordeaux/30 bg-bordeaux/5 p-4 text-sm text-bordeaux">
          <strong>{lowStockProducts.length} produto(s) com estoque baixo:</strong>{' '}
          {lowStockProducts.map((p) => p.name).join(', ')}
        </div>
      )}

      {loading ? <p className="text-mist">Carregando...</p> : <Table columns={columns} rows={movements} />}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nova movimentação manual">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Produto">
            <Select required value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
              <option value="">Selecione...</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} (estoque: {p.quantity})</option>)}
            </Select>
          </Field>
          <Field label="Motivo">
            <Select
              value={form.reason}
              onChange={(e) => {
                const reason = e.target.value;
                const direction = reason === 'perda' ? 'saida' : reason === 'ajuste' ? form.direction : 'entrada';
                setForm({ ...form, reason, direction });
              }}
            >
              {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </Select>
          </Field>
          {form.reason === 'ajuste' && (
            <Field label="Direção">
              <Select value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
              </Select>
            </Field>
          )}
          <Field label="Quantidade"><Input type="number" min="1" required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></Field>
          <Field label="Observações"><TextArea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Registrar'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

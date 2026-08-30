'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useApiClient } from '@/lib/useApiClient';
import { shortDate, money } from '@/lib/format';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Field, { Input, Select, TextArea } from '@/components/ui/Field';

const REASONS = [
  { value: 'compra', label: 'Compra (entrada)' },
  { value: 'devolucao', label: 'Devolução (entrada)' },
  { value: 'perda', label: 'Perda (saída)' },
  { value: 'ajuste', label: 'Ajuste' },
];

const EMPTY_PRODUCT_FORM = {
  name: '', sku: '', categoryId: '', brand: '', cost: '', price: '',
  minStock: '', description: '', status: 'ativo',
};

export default function EstoquePage() {
  const { user } = useAuth();
  const api = useApiClient();
  const isAdmin = user?.role === 'admin';

  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal de movimentação manual de estoque
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ productId: '', direction: 'entrada', reason: 'compra', quantity: '', notes: '' });

  // Modal de edição completa do produto
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_PRODUCT_FORM);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  async function loadAll() {
    setLoading(true);
    try {
      const [movementsData, productsData, categoriesData] = await Promise.all([
        api.get('/stock-movements'),
        api.get('/products'),
        api.get('/categories'),
      ]);
      setMovements(movementsData.movements);
      setProducts(productsData.products);
      setCategories(categoriesData.categories);
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

  function openEditProduct(product) {
    setEditingId(product.id);
    setEditError('');
    setEditForm({
      name: product.name, sku: product.sku || '', categoryId: product.category_id || '',
      brand: product.brand || '', cost: product.cost, price: product.price,
      minStock: product.min_stock, description: product.description || '', status: product.status,
    });
    setEditModalOpen(true);
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    setEditSaving(true);
    setEditError('');
    try {
      const payload = {
        ...editForm,
        categoryId: editForm.categoryId || null,
        cost: Number(editForm.cost),
        price: Number(editForm.price),
        minStock: Number(editForm.minStock) || 0,
      };
      await api.put(`/products/${editingId}`, payload);
      setEditModalOpen(false);
      await loadAll();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditSaving(false);
    }
  }

  const lowStockProducts = products.filter((p) => p.quantity <= p.min_stock);

  const movementColumns = [
    { key: 'created_at', label: 'Data', render: (r) => shortDate(r.created_at) },
    { key: 'product_name', label: 'Produto' },
    { key: 'direction', label: 'Direção', render: (r) => (r.direction === 'entrada' ? 'Entrada' : 'Saída') },
    { key: 'reason', label: 'Motivo' },
    { key: 'quantity', label: 'Quantidade', align: 'right' },
    { key: 'notes', label: 'Observações', render: (r) => r.notes || '—' },
  ];

  const productColumns = [
    { key: 'name', label: 'Produto' },
    { key: 'category_name', label: 'Categoria', render: (r) => r.category_name || '—' },
    { key: 'quantity', label: 'Estoque', align: 'right', render: (r) => (
      <span className={r.quantity <= r.min_stock ? 'text-bordeaux' : ''}>{r.quantity}</span>
    ) },
    { key: 'min_stock', label: 'Mínimo', align: 'right' },
    { key: 'cost', label: 'Custo', align: 'right', render: (r) => money(r.cost) },
    { key: 'price', label: 'Preço', align: 'right', render: (r) => money(r.price) },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
    ...(isAdmin ? [{
      key: 'actions', label: '', render: (r) => (
        <div className="flex justify-end">
          <button onClick={() => openEditProduct(r)} className="text-xs text-gold hover:underline">Editar</button>
        </div>
      ),
    }] : []),
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

      {loading ? <p className="text-mist">Carregando...</p> : <Table columns={movementColumns} rows={movements} />}

      <div className="mt-10">
        <h2 className="mb-3 font-display text-lg text-ink dark:text-parchment">Produtos em estoque</h2>
        <p className="mb-4 text-sm text-mist">
          Edite os dados do produto (nome, categoria, custo, preço, estoque mínimo, status e descrição) direto por aqui.
          A quantidade em estoque continua sendo alterada apenas por movimentação, para manter o histórico auditável.
        </p>
        {loading ? <p className="text-mist">Carregando...</p> : <Table columns={productColumns} rows={products} />}
      </div>

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

      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title="Editar produto" wide>
        <form onSubmit={handleEditSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ErrorBanner message={editError} />
          <Field label="Nome"><Input required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></Field>
          <Field label="SKU"><Input value={editForm.sku} onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })} /></Field>
          <Field label="Categoria">
            <Select value={editForm.categoryId} onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })}>
              <option value="">—</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Marca"><Input value={editForm.brand} onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })} /></Field>
          <Field label="Custo (R$)"><Input type="number" step="0.01" required value={editForm.cost} onChange={(e) => setEditForm({ ...editForm, cost: e.target.value })} /></Field>
          <Field label="Preço de venda (R$)"><Input type="number" step="0.01" required value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} /></Field>
          <Field label="Estoque mínimo"><Input type="number" value={editForm.minStock} onChange={(e) => setEditForm({ ...editForm, minStock: e.target.value })} /></Field>
          <Field label="Status">
            <Select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Descrição"><TextArea rows={3} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} /></Field>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setEditModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={editSaving}>{editSaving ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useApiClient } from '@/lib/useApiClient';
import { money } from '@/lib/format';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Field, { Input, Select, TextArea } from '@/components/ui/Field';

const EMPTY_FORM = {
  name: '', sku: '', categoryId: '', brand: '', cost: '', price: '',
  quantity: '', minStock: '', description: '', status: 'ativo',
};

export default function ProdutosPage() {
  const { user } = useAuth();
  const api = useApiClient();
  const isAdmin = user?.role === 'admin';

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const [productsData, categoriesData] = await Promise.all([
        api.get('/products'),
        api.get('/categories'),
      ]);
      setProducts(productsData.products);
      setCategories(categoriesData.categories);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(product) {
    setEditingId(product.id);
    setForm({
      name: product.name, sku: product.sku || '', categoryId: product.category_id || '',
      brand: product.brand || '', cost: product.cost, price: product.price,
      quantity: product.quantity, minStock: product.min_stock,
      description: product.description || '', status: product.status,
    });
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        categoryId: form.categoryId || null,
        cost: Number(form.cost),
        price: Number(form.price),
        quantity: Number(form.quantity) || 0,
        minStock: Number(form.minStock) || 0,
      };
      if (editingId) {
        await api.put(`/products/${editingId}`, payload);
      } else {
        await api.post('/products', payload);
      }
      setModalOpen(false);
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Excluir este produto? Ele some das listagens, mas o histórico de vendas é preservado.')) return;
    try {
      await api.delete(`/products/${id}`);
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  const columns = [
    { key: 'name', label: 'Produto' },
    { key: 'category_name', label: 'Categoria', render: (r) => r.category_name || '—' },
    { key: 'quantity', label: 'Estoque', align: 'right', render: (r) => (
      <span className={r.quantity <= r.min_stock ? 'text-bordeaux' : ''}>{r.quantity}</span>
    ) },
    { key: 'cost', label: 'Custo', align: 'right', render: (r) => money(r.cost) },
    { key: 'price', label: 'Preço', align: 'right', render: (r) => money(r.price) },
    { key: 'margin', label: 'Margem', align: 'right', render: (r) => `${r.margin}%` },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
    ...(isAdmin ? [{
      key: 'actions', label: '', render: (r) => (
        <div className="flex justify-end gap-2">
          <button onClick={() => openEdit(r)} className="text-xs text-gold hover:underline">Editar</button>
          <button onClick={() => handleDelete(r.id)} className="text-xs text-bordeaux hover:underline">Excluir</button>
        </div>
      ),
    }] : []),
  ];

  return (
    <div>
      <PageHeader
        eyebrow={`${products.length} produto(s)`}
        title="Catálogo de Produtos"
        action={isAdmin && <Button onClick={openCreate}>+ Novo produto</Button>}
      />
      <ErrorBanner message={error} />
      {loading ? <p className="text-mist">Carregando...</p> : <Table columns={columns} rows={products} />}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Editar produto' : 'Novo produto'} wide>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="SKU"><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></Field>
          <Field label="Categoria">
            <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">—</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Marca"><Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></Field>
          <Field label="Custo (R$)"><Input type="number" step="0.01" required value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></Field>
          <Field label="Preço de venda (R$)"><Input type="number" step="0.01" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
          {!editingId && (
            <Field label="Quantidade inicial"><Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></Field>
          )}
          <Field label="Estoque mínimo"><Input type="number" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} /></Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Descrição"><TextArea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

const { query } = require('../config/db');
const { logAudit } = require('../utils/audit');

function withMargin(product) {
  const price = Number(product.price);
  const cost = Number(product.cost);
  const unitProfit = price - cost;
  const margin = price > 0 ? (unitProfit / price) * 100 : 0;
  return { ...product, unit_profit: unitProfit.toFixed(2), margin: margin.toFixed(2) };
}

async function listProducts(req, res, next) {
  try {
    const { search, categoryId, status, lowStock } = req.query;
    const conditions = ['p.deleted_at IS NULL'];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`p.name ILIKE $${params.length}`);
    }
    if (categoryId) {
      params.push(Number(categoryId));
      conditions.push(`p.category_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`p.status = $${params.length}`);
    }
    if (lowStock === 'true') {
      conditions.push('p.quantity <= p.min_stock');
    }

    const { rows } = await query(
      `SELECT p.*, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY p.name`,
      params
    );

    res.json({ products: rows.map(withMargin) });
  } catch (err) {
    next(err);
  }
}

async function getProduct(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT p.*, c.name AS category_name
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.id = $1 AND p.deleted_at IS NULL`,
      [Number(req.params.id)]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Produto não encontrado.' });
    res.json({ product: withMargin(rows[0]) });
  } catch (err) {
    next(err);
  }
}

function validateProductInput(body) {
  const errors = [];
  if (!body.name || !body.name.trim()) errors.push('Nome é obrigatório.');
  if (body.cost === undefined || Number(body.cost) < 0) errors.push('Custo inválido.');
  if (body.price === undefined || Number(body.price) < 0) errors.push('Preço inválido.');
  if (body.quantity !== undefined && Number(body.quantity) < 0) errors.push('Quantidade inválida.');
  return errors;
}

async function createProduct(req, res, next) {
  try {
    const errors = validateProductInput(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });

    const {
      name, sku, categoryId, brand, productType, description, supplier,
      barcode, quantity, minStock, cost, price, entryDate, expiryDate,
      imageUrl, notes, status,
    } = req.body;

    const { rows } = await query(
      `INSERT INTO products
        (name, sku, category_id, brand, product_type, description, supplier, barcode,
         quantity, min_stock, cost, price, entry_date, expiry_date, image_url, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,COALESCE($17,'ativo'))
       RETURNING *`,
      [
        name.trim(), sku || null, categoryId || null, brand || null, productType || null,
        description || null, supplier || null, barcode || null, quantity || 0,
        minStock || 0, cost, price, entryDate || null, expiryDate || null,
        imageUrl || null, notes || null, status || null,
      ]
    );

    await logAudit({ userId: req.user.id, action: 'create', tableName: 'products', recordId: rows[0].id, newData: rows[0], req });
    res.status(201).json({ product: withMargin(rows[0]) });
  } catch (err) {
    next(err);
  }
}

async function updateProduct(req, res, next) {
  try {
    const id = Number(req.params.id);
    const errors = validateProductInput(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });

    const { rows: beforeRows } = await query('SELECT * FROM products WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (beforeRows.length === 0) return res.status(404).json({ error: 'Produto não encontrado.' });

    const {
      name, sku, categoryId, brand, productType, description, supplier,
      barcode, minStock, cost, price, entryDate, expiryDate, imageUrl, notes, status,
    } = req.body;

    // Quantidade NÃO é editada aqui — estoque só muda por movimentação (stockController),
    // pra manter uma trilha auditável de todo ajuste.
    const { rows } = await query(
      `UPDATE products SET
         name=$1, sku=$2, category_id=$3, brand=$4, product_type=$5, description=$6,
         supplier=$7, barcode=$8, min_stock=$9, cost=$10, price=$11, entry_date=$12,
         expiry_date=$13, image_url=$14, notes=$15, status=COALESCE($16, status)
       WHERE id=$17 RETURNING *`,
      [
        name.trim(), sku || null, categoryId || null, brand || null, productType || null,
        description || null, supplier || null, barcode || null, minStock || 0, cost, price,
        entryDate || null, expiryDate || null, imageUrl || null, notes || null, status || null, id,
      ]
    );

    await logAudit({ userId: req.user.id, action: 'update', tableName: 'products', recordId: id, oldData: beforeRows[0], newData: rows[0], req });
    res.json({ product: withMargin(rows[0]) });
  } catch (err) {
    next(err);
  }
}

async function deleteProduct(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { rows } = await query(
      'UPDATE products SET deleted_at = NOW(), deleted_by = $1 WHERE id = $2 AND deleted_at IS NULL RETURNING *',
      [req.user.id, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Produto não encontrado.' });
    await logAudit({ userId: req.user.id, action: 'delete', tableName: 'products', recordId: id, oldData: rows[0], req });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { listProducts, getProduct, createProduct, updateProduct, deleteProduct };

const { query } = require('../config/db');
const { logAudit } = require('../utils/audit');

async function listCategories(req, res, next) {
  try {
    const { rows } = await query(
      'SELECT id, name FROM categories WHERE deleted_at IS NULL ORDER BY name'
    );
    res.json({ categories: rows });
  } catch (err) {
    next(err);
  }
}

async function createCategory(req, res, next) {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nome da categoria é obrigatório.' });
    }
    const { rows } = await query(
      'INSERT INTO categories (name) VALUES ($1) RETURNING id, name',
      [name.trim()]
    );
    await logAudit({
      userId: req.user.id,
      action: 'create',
      tableName: 'categories',
      recordId: rows[0].id,
      newData: rows[0],
      req,
    });
    res.status(201).json({ category: rows[0] });
  } catch (err) {
    next(err);
  }
}

// Soft delete — categoria some da listagem mas produtos antigos continuam
// íntegros (category_id vira NULL só se a linha for de fato removida, o que
// não acontece aqui).
async function deleteCategory(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { rows } = await query(
      'UPDATE categories SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id, name',
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Categoria não encontrada.' });
    }
    await logAudit({
      userId: req.user.id,
      action: 'delete',
      tableName: 'categories',
      recordId: id,
      oldData: rows[0],
      req,
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { listCategories, createCategory, deleteCategory };

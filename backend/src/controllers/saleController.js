const { query, withTransaction } = require('../config/db');
const { logAudit } = require('../utils/audit');

const PAYMENT_METHODS = ['dinheiro', 'pix', 'debito', 'credito', 'transferencia', 'outros'];

// Marca como "vencido" qualquer parcela cujo prazo já passou e ainda não foi
// quitada — feito sob demanda (lazy) em vez de um job agendado, mais simples
// e sempre consistente com a data de leitura.
async function refreshOverdueInstallments() {
  await query(
    `UPDATE installments SET status = 'vencido'
     WHERE due_date < CURRENT_DATE AND status IN ('pendente','parcial')`
  );
}

function nextSaleNumber(id) {
  return `VD-${String(id).padStart(6, '0')}`;
}

async function listSales(req, res, next) {
  try {
    await refreshOverdueInstallments();
    const { from, to, customerId, status } = req.query;
    const conditions = ['s.deleted_at IS NULL'];
    const params = [];

    if (from) { params.push(from); conditions.push(`s.sale_date >= $${params.length}`); }
    if (to) { params.push(to); conditions.push(`s.sale_date <= $${params.length}`); }
    if (customerId) { params.push(Number(customerId)); conditions.push(`s.customer_id = $${params.length}`); }
    if (status) { params.push(status); conditions.push(`s.status = $${params.length}`); }

    const { rows } = await query(
      `SELECT s.*, c.name AS customer_name
       FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY s.sale_date DESC
       LIMIT 500`,
      params
    );
    res.json({ sales: rows });
  } catch (err) {
    next(err);
  }
}

async function getSale(req, res, next) {
  try {
    await refreshOverdueInstallments();
    const id = Number(req.params.id);

    const { rows: saleRows } = await query(
      `SELECT s.*, c.name AS customer_name FROM sales s
       LEFT JOIN customers c ON c.id = s.customer_id
       WHERE s.id = $1 AND s.deleted_at IS NULL`,
      [id]
    );
    if (saleRows.length === 0) return res.status(404).json({ error: 'Venda não encontrada.' });

    const { rows: items } = await query(
      `SELECT si.*, p.name AS product_name FROM sale_items si
       JOIN products p ON p.id = si.product_id WHERE si.sale_id = $1`,
      [id]
    );
    const { rows: installments } = await query(
      'SELECT * FROM installments WHERE sale_id = $1 ORDER BY installment_number',
      [id]
    );
    const { rows: payments } = await query(
      'SELECT * FROM payments WHERE sale_id = $1 ORDER BY payment_date',
      [id]
    );

    res.json({ sale: saleRows[0], items, installments, payments });
  } catch (err) {
    next(err);
  }
}

async function createSale(req, res, next) {
  try {
    const {
      customerId, items, discount = 0, surcharge = 0, paymentMethod,
      saleType, notes, downPayment = 0, installmentsCount, firstDueDate,
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'A venda precisa ter ao menos um item.' });
    }
    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ error: 'Forma de pagamento inválida.' });
    }
    if (!['avista', 'aprazo'].includes(saleType)) {
      return res.status(400).json({ error: 'Tipo de venda inválido.' });
    }
    if (saleType === 'aprazo' && (!installmentsCount || installmentsCount < 1)) {
      return res.status(400).json({ error: 'Informe o número de parcelas para venda a prazo.' });
    }

    const result = await withTransaction(async (client) => {
      let subtotal = 0;
      let totalCost = 0;
      const preparedItems = [];

      for (const item of items) {
        if (!item.productId || !item.quantity || item.quantity <= 0) {
          const err = new Error('Item de venda inválido.');
          err.status = 400;
          throw err;
        }

        const { rows: productRows } = await client.query(
          'SELECT id, name, price, cost, quantity FROM products WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
          [item.productId]
        );
        if (productRows.length === 0) {
          const err = new Error(`Produto ${item.productId} não encontrado.`);
          err.status = 404;
          throw err;
        }
        const product = productRows[0];
        const unitPrice = item.unitPrice !== undefined ? Number(item.unitPrice) : Number(product.price);

        if (product.quantity < item.quantity) {
          const err = new Error(`Estoque insuficiente para "${product.name}".`);
          err.status = 400;
          throw err;
        }

        const lineTotal = unitPrice * item.quantity;
        subtotal += lineTotal;
        totalCost += Number(product.cost) * item.quantity;

        preparedItems.push({
          productId: product.id,
          quantity: item.quantity,
          unitPrice,
          unitCost: Number(product.cost),
          lineTotal,
        });
      }

      const total = subtotal - Number(discount) + Number(surcharge);
      if (total < 0) {
        const err = new Error('Total da venda não pode ser negativo (verifique o desconto).');
        err.status = 400;
        throw err;
      }
      const profit = total - totalCost;

      const { rows: saleRows } = await client.query(
        `INSERT INTO sales
          (sale_number, customer_id, payment_method, sale_type, discount, surcharge,
           subtotal, total, total_cost, profit, notes, created_by)
         VALUES ('PENDENTE',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING *`,
        [customerId || null, paymentMethod, saleType, discount, surcharge, subtotal, total, totalCost, profit, notes || null, req.user.id]
      );
      const sale = saleRows[0];

      const saleNumber = nextSaleNumber(sale.id);
      await client.query('UPDATE sales SET sale_number = $1 WHERE id = $2', [saleNumber, sale.id]);
      sale.sale_number = saleNumber;

      for (const pi of preparedItems) {
        await client.query(
          `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, unit_cost, line_total)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [sale.id, pi.productId, pi.quantity, pi.unitPrice, pi.unitCost, pi.lineTotal]
        );
        await client.query('UPDATE products SET quantity = quantity - $1 WHERE id = $2', [pi.quantity, pi.productId]);
        await client.query(
          `INSERT INTO stock_movements (product_id, direction, reason, quantity, reference_sale_id, created_by)
           VALUES ($1,'saida','venda',$2,$3,$4)`,
          [pi.productId, pi.quantity, sale.id, req.user.id]
        );
      }

      const installments = [];

      if (saleType === 'avista') {
        await client.query(
          `INSERT INTO payments (sale_id, amount, payment_method, created_by) VALUES ($1,$2,$3,$4)`,
          [sale.id, total, paymentMethod, req.user.id]
        );
        await client.query(
          `INSERT INTO cash_movements (direction, category, amount, description, reference_type, reference_id, created_by)
           VALUES ('entrada','venda',$1,$2,'sale',$3,$4)`,
          [total, `Venda ${saleNumber}`, sale.id, req.user.id]
        );
      } else {
        const entrada = Number(downPayment) || 0;
        if (entrada > total) {
          const err = new Error('Entrada não pode ser maior que o total da venda.');
          err.status = 400;
          throw err;
        }
        if (entrada > 0) {
          await client.query(
            `INSERT INTO payments (sale_id, amount, payment_method, created_by) VALUES ($1,$2,$3,$4)`,
            [sale.id, entrada, paymentMethod, req.user.id]
          );
          await client.query(
            `INSERT INTO cash_movements (direction, category, amount, description, reference_type, reference_id, created_by)
             VALUES ('entrada','venda',$1,$2,'sale',$3,$4)`,
            [entrada, `Entrada venda ${saleNumber}`, sale.id, req.user.id]
          );
        }

        const remaining = total - entrada;
        const perInstallment = Math.floor((remaining / installmentsCount) * 100) / 100;
        const baseDate = firstDueDate ? new Date(firstDueDate) : new Date();

        let allocated = 0;
        for (let i = 1; i <= installmentsCount; i += 1) {
          const isLast = i === installmentsCount;
          const amount = isLast ? Number((remaining - allocated).toFixed(2)) : perInstallment;
          allocated += amount;

          const dueDate = new Date(baseDate);
          dueDate.setMonth(dueDate.getMonth() + (i - 1));

          const { rows: instRows } = await client.query(
            `INSERT INTO installments (sale_id, installment_number, due_date, amount)
             VALUES ($1,$2,$3,$4) RETURNING *`,
            [sale.id, i, dueDate.toISOString().slice(0, 10), amount]
          );
          installments.push(instRows[0]);
        }
      }

      return { sale, installments };
    });

    await logAudit({ userId: req.user.id, action: 'create', tableName: 'sales', recordId: result.sale.id, newData: result.sale, req });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function payInstallment(req, res, next) {
  try {
    const installmentId = Number(req.params.id);
    const { amount, paymentMethod, notes } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Valor do pagamento deve ser maior que zero.' });
    }
    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ error: 'Forma de pagamento inválida.' });
    }

    const result = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT i.*, s.sale_number FROM installments i
         JOIN sales s ON s.id = i.sale_id
         WHERE i.id = $1 FOR UPDATE`,
        [installmentId]
      );
      if (rows.length === 0) {
        const err = new Error('Parcela não encontrada.');
        err.status = 404;
        throw err;
      }
      const installment = rows[0];
      if (installment.status === 'pago' || installment.status === 'cancelado') {
        const err = new Error('Esta parcela já está quitada ou cancelada.');
        err.status = 400;
        throw err;
      }

      const remaining = Number(installment.amount) - Number(installment.paid_amount);
      if (Number(amount) > remaining + 0.01) {
        const err = new Error(`Valor excede o saldo restante da parcela (R$ ${remaining.toFixed(2)}).`);
        err.status = 400;
        throw err;
      }

      const newPaid = Number(installment.paid_amount) + Number(amount);
      const newStatus = newPaid >= Number(installment.amount) - 0.01 ? 'pago' : 'parcial';

      const { rows: updated } = await client.query(
        'UPDATE installments SET paid_amount = $1, status = $2 WHERE id = $3 RETURNING *',
        [newPaid, newStatus, installmentId]
      );

      await client.query(
        `INSERT INTO payments (sale_id, installment_id, amount, payment_method, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [installment.sale_id, installmentId, amount, paymentMethod, notes || null, req.user.id]
      );
      await client.query(
        `INSERT INTO cash_movements (direction, category, amount, description, reference_type, reference_id, created_by)
         VALUES ('entrada','recebimento_venda',$1,$2,'installment',$3,$4)`,
        [amount, `Parcela ${installment.installment_number} - ${installment.sale_number}`, installmentId, req.user.id]
      );

      return updated[0];
    });

    await logAudit({ userId: req.user.id, action: 'payment', tableName: 'installments', recordId: installmentId, newData: result, req });
    res.json({ installment: result });
  } catch (err) {
    next(err);
  }
}

// Cancelamento (somente admin, ver rota): estorna estoque e marca a venda/parcelas
// como canceladas. Não estorna automaticamente valores já recebidos no caixa —
// isso exige uma decisão humana e deve ser tratado como uma devolução/reembolso à parte.
async function cancelSale(req, res, next) {
  try {
    const id = Number(req.params.id);

    const result = await withTransaction(async (client) => {
      const { rows } = await client.query(
        'SELECT * FROM sales WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
        [id]
      );
      if (rows.length === 0) {
        const err = new Error('Venda não encontrada.');
        err.status = 404;
        throw err;
      }
      const sale = rows[0];
      if (sale.status === 'cancelada') {
        const err = new Error('Venda já está cancelada.');
        err.status = 400;
        throw err;
      }

      const { rows: items } = await client.query('SELECT * FROM sale_items WHERE sale_id = $1', [id]);
      for (const item of items) {
        await client.query('UPDATE products SET quantity = quantity + $1 WHERE id = $2', [item.quantity, item.product_id]);
        await client.query(
          `INSERT INTO stock_movements (product_id, direction, reason, quantity, reference_sale_id, notes, created_by)
           VALUES ($1,'entrada','devolucao',$2,$3,'Estorno por cancelamento de venda',$4)`,
          [item.product_id, item.quantity, id, req.user.id]
        );
      }

      await client.query("UPDATE installments SET status = 'cancelado' WHERE sale_id = $1 AND status NOT IN ('pago')", [id]);
      const { rows: updatedSale } = await client.query(
        "UPDATE sales SET status = 'cancelada' WHERE id = $1 RETURNING *",
        [id]
      );

      return updatedSale[0];
    });

    await logAudit({ userId: req.user.id, action: 'cancel', tableName: 'sales', recordId: id, newData: result, req });
    res.json({ sale: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { listSales, getSale, createSale, payInstallment, cancelSale };

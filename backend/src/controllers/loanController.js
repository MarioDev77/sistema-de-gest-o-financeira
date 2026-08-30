const { query, withTransaction } = require('../config/db');
const { logAudit } = require('../utils/audit');
const { calculateLoanTotal } = require('../utils/loanMath');

const PAYMENT_METHODS = ['dinheiro', 'pix', 'debito', 'credito', 'transferencia', 'outros'];
const INTEREST_TYPES = ['fixo', 'simples', 'por_parcela'];

async function refreshOverdueLoans() {
  await query(
    `UPDATE loan_installments SET status = 'vencido'
     WHERE due_date < CURRENT_DATE AND status IN ('pendente','parcial')`
  );
  await query(
    `UPDATE loans l SET status = 'vencido'
     WHERE l.status = 'ativo' AND l.deleted_at IS NULL
     AND EXISTS (SELECT 1 FROM loan_installments li WHERE li.loan_id = l.id AND li.status = 'vencido')`
  );
}

async function listLoans(req, res, next) {
  try {
    await refreshOverdueLoans();
    const { status, search } = req.query;
    const conditions = ['deleted_at IS NULL'];
    const params = [];
    if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
    if (search) { params.push(`%${search}%`); conditions.push(`person_name ILIKE $${params.length}`); }

    const { rows } = await query(
      `SELECT l.*,
         COALESCE((SELECT SUM(paid_amount) FROM loan_installments WHERE loan_id = l.id), 0) AS received,
         COALESCE((SELECT SUM(amount - paid_amount) FROM loan_installments WHERE loan_id = l.id AND status NOT IN ('cancelado')), 0) AS remaining
       FROM loans l WHERE ${conditions.join(' AND ')} ORDER BY l.loan_date DESC`,
      params
    );
    res.json({ loans: rows });
  } catch (err) {
    next(err);
  }
}

async function getLoan(req, res, next) {
  try {
    await refreshOverdueLoans();
    const id = Number(req.params.id);
    const { rows } = await query('SELECT * FROM loans WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Empréstimo não encontrado.' });

    const { rows: installments } = await query(
      'SELECT * FROM loan_installments WHERE loan_id = $1 ORDER BY installment_number', [id]
    );
    const { rows: payments } = await query(
      'SELECT * FROM loan_payments WHERE loan_id = $1 ORDER BY payment_date', [id]
    );
    res.json({ loan: rows[0], installments, payments });
  } catch (err) {
    next(err);
  }
}

async function createLoan(req, res, next) {
  try {
    const {
      personName, document, phone, principalAmount, interestType, interestPercentage = 0,
      loanDate, dueDate, installmentsCount = 1, paymentMethod, notes,
    } = req.body;

    if (!personName || !personName.trim()) return res.status(400).json({ error: 'Nome da pessoa é obrigatório.' });
    if (!principalAmount || Number(principalAmount) <= 0) return res.status(400).json({ error: 'Valor emprestado inválido.' });
    if (!INTEREST_TYPES.includes(interestType)) return res.status(400).json({ error: 'Tipo de juros inválido.' });
    if (!loanDate) return res.status(400).json({ error: 'Data do empréstimo é obrigatória.' });
    if (!installmentsCount || installmentsCount < 1) return res.status(400).json({ error: 'Número de parcelas inválido.' });

    const totalAmount = calculateLoanTotal({
      principal: principalAmount, interestType, interestPercentage, installmentsCount,
    });

    const result = await withTransaction(async (client) => {
      const { rows: loanRows } = await client.query(
        `INSERT INTO loans
          (person_name, document, phone, principal_amount, interest_type, interest_percentage,
           total_amount, loan_date, due_date, installments_count, payment_method, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [personName.trim(), document || null, phone || null, principalAmount, interestType,
         interestPercentage, totalAmount, loanDate, dueDate || null, installmentsCount,
         paymentMethod || null, notes || null, req.user.id]
      );
      const loan = loanRows[0];

      const perInstallment = Math.floor((totalAmount / installmentsCount) * 100) / 100;
      const baseDate = new Date(loanDate);
      let allocated = 0;
      const installments = [];

      for (let i = 1; i <= installmentsCount; i += 1) {
        const isLast = i === installmentsCount;
        const amount = isLast ? Number((totalAmount - allocated).toFixed(2)) : perInstallment;
        allocated += amount;
        const due = new Date(baseDate);
        due.setMonth(due.getMonth() + i);

        const { rows: instRows } = await client.query(
          `INSERT INTO loan_installments (loan_id, installment_number, due_date, amount)
           VALUES ($1,$2,$3,$4) RETURNING *`,
          [loan.id, i, due.toISOString().slice(0, 10), amount]
        );
        installments.push(instRows[0]);
      }

      // Dinheiro emprestado sai do caixa no momento da concessão.
      await client.query(
        `INSERT INTO cash_movements (direction, category, amount, description, reference_type, reference_id, created_by)
         VALUES ('saida','emprestimo_concedido',$1,$2,'loan',$3,$4)`,
        [principalAmount, `Empréstimo para ${personName.trim()}`, loan.id, req.user.id]
      );

      return { loan, installments };
    });

    await logAudit({ userId: req.user.id, action: 'create', tableName: 'loans', recordId: result.loan.id, newData: result.loan, req });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function updateLoan(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { personName, document, phone, dueDate, notes } = req.body;

    const { rows: existing } = await query('SELECT * FROM loans WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Empréstimo não encontrado.' });
    if (!personName || !personName.trim()) return res.status(400).json({ error: 'Nome da pessoa é obrigatório.' });

    const { rows } = await query(
      `UPDATE loans SET person_name = $1, document = $2, phone = $3, due_date = $4, notes = $5
       WHERE id = $6 RETURNING *`,
      [personName.trim(), document || null, phone || null, dueDate || null, notes || null, id]
    );

    await logAudit({ userId: req.user.id, action: 'update', tableName: 'loans', recordId: id, oldData: existing[0], newData: rows[0], req });
    res.json({ loan: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function payLoanInstallment(req, res, next) {
  try {
    const installmentId = Number(req.params.id);
    const { amount, paymentMethod, notes } = req.body;

    if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Valor inválido.' });
    if (!PAYMENT_METHODS.includes(paymentMethod)) return res.status(400).json({ error: 'Forma de pagamento inválida.' });

    const result = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT li.*, l.person_name, l.principal_amount, l.total_amount
         FROM loan_installments li JOIN loans l ON l.id = li.loan_id
         WHERE li.id = $1 FOR UPDATE`,
        [installmentId]
      );
      if (rows.length === 0) {
        const err = new Error('Parcela não encontrada.');
        err.status = 404;
        throw err;
      }
      const installment = rows[0];
      if (['pago', 'cancelado'].includes(installment.status)) {
        const err = new Error('Esta parcela já está quitada ou cancelada.');
        err.status = 400;
        throw err;
      }

      const remaining = Number(installment.amount) - Number(installment.paid_amount);
      if (Number(amount) > remaining + 0.01) {
        const err = new Error(`Valor excede o saldo restante (R$ ${remaining.toFixed(2)}).`);
        err.status = 400;
        throw err;
      }

      // Proporção principal/juros dentro da parcela, para diferenciar receita
      // financeira (juros) de retorno de capital (principal) nos relatórios.
      const interestRatio = installment.total_amount > 0
        ? (installment.total_amount - installment.principal_amount) / installment.total_amount
        : 0;
      const interestPortion = Number((amount * interestRatio).toFixed(2));
      const principalPortion = Number((amount - interestPortion).toFixed(2));

      const newPaid = Number(installment.paid_amount) + Number(amount);
      const newStatus = newPaid >= Number(installment.amount) - 0.01 ? 'pago' : 'parcial';

      const { rows: updated } = await client.query(
        'UPDATE loan_installments SET paid_amount = $1, status = $2 WHERE id = $3 RETURNING *',
        [newPaid, newStatus, installmentId]
      );

      await client.query(
        `INSERT INTO loan_payments (loan_id, installment_id, amount, principal_portion, interest_portion, payment_method, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [installment.loan_id, installmentId, amount, principalPortion, interestPortion, paymentMethod, notes || null, req.user.id]
      );

      if (principalPortion > 0) {
        await client.query(
          `INSERT INTO cash_movements (direction, category, amount, description, reference_type, reference_id, created_by)
           VALUES ('entrada','recebimento_emprestimo',$1,$2,'loan_installment',$3,$4)`,
          [principalPortion, `Recebimento empréstimo - ${installment.person_name}`, installmentId, req.user.id]
        );
      }
      if (interestPortion > 0) {
        await client.query(
          `INSERT INTO cash_movements (direction, category, amount, description, reference_type, reference_id, created_by)
           VALUES ('entrada','juros_emprestimo',$1,$2,'loan_installment',$3,$4)`,
          [interestPortion, `Juros recebidos - ${installment.person_name}`, installmentId, req.user.id]
        );
      }

      // Se todas as parcelas do empréstimo estiverem pagas, marca o empréstimo como pago.
      const { rows: pendingCount } = await client.query(
        `SELECT COUNT(*) FROM loan_installments WHERE loan_id = $1 AND status NOT IN ('pago','cancelado')`,
        [installment.loan_id]
      );
      const loanStatus = Number(pendingCount[0].count) === 0 ? 'pago' : 'parcial';
      await client.query('UPDATE loans SET status = $1 WHERE id = $2', [loanStatus, installment.loan_id]);

      return updated[0];
    });

    await logAudit({ userId: req.user.id, action: 'payment', tableName: 'loan_installments', recordId: installmentId, newData: result, req });
    res.json({ installment: result });
  } catch (err) {
    next(err);
  }
}

/**
 * Recebimento flexível: o cliente paga um valor de juros e, opcionalmente,
 * um valor a mais para abater o capital emprestado — sem precisar bater
 * exatamente com o valor de uma parcela específica. O valor é aplicado nas
 * parcelas pendentes (mais antiga primeiro); se sobrar valor além do total
 * das parcelas em aberto, é registrado como abatimento avulso do empréstimo.
 */
async function receiveLoanPayment(req, res, next) {
  try {
    const loanId = Number(req.params.id);
    const { interestAmount = 0, principalAmount = 0, paymentMethod, notes } = req.body;
    const interest = Number(interestAmount) || 0;
    const principal = Number(principalAmount) || 0;
    const total = Number((interest + principal).toFixed(2));

    if (total <= 0) return res.status(400).json({ error: 'Informe o valor de juros e/ou de abatimento do capital.' });
    if (!PAYMENT_METHODS.includes(paymentMethod)) return res.status(400).json({ error: 'Forma de pagamento inválida.' });

    const result = await withTransaction(async (client) => {
      const { rows: loanRows } = await client.query(
        'SELECT * FROM loans WHERE id = $1 AND deleted_at IS NULL FOR UPDATE', [loanId]
      );
      if (loanRows.length === 0) {
        const err = new Error('Empréstimo não encontrado.');
        err.status = 404;
        throw err;
      }
      const loan = loanRows[0];

      const { rows: installments } = await client.query(
        `SELECT * FROM loan_installments WHERE loan_id = $1 AND status NOT IN ('pago','cancelado')
         ORDER BY installment_number FOR UPDATE`,
        [loanId]
      );

      const interestRatio = total > 0 ? interest / total : 0;
      let remaining = total;
      const paymentsCreated = [];

      async function registerPortion(applied, installmentId, referenceType, referenceId) {
        const appliedInterest = Number((applied * interestRatio).toFixed(2));
        const appliedPrincipal = Number((applied - appliedInterest).toFixed(2));

        const { rows: paymentRows } = await client.query(
          `INSERT INTO loan_payments (loan_id, installment_id, amount, principal_portion, interest_portion, payment_method, notes, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
          [loanId, installmentId, applied, appliedPrincipal, appliedInterest, paymentMethod, notes || null, req.user.id]
        );
        paymentsCreated.push(paymentRows[0]);

        if (appliedPrincipal > 0) {
          await client.query(
            `INSERT INTO cash_movements (direction, category, amount, description, reference_type, reference_id, created_by)
             VALUES ('entrada','recebimento_emprestimo',$1,$2,$3,$4,$5)`,
            [appliedPrincipal, `Recebimento empréstimo - ${loan.person_name}`, referenceType, referenceId, req.user.id]
          );
        }
        if (appliedInterest > 0) {
          await client.query(
            `INSERT INTO cash_movements (direction, category, amount, description, reference_type, reference_id, created_by)
             VALUES ('entrada','juros_emprestimo',$1,$2,$3,$4,$5)`,
            [appliedInterest, `Juros recebidos - ${loan.person_name}`, referenceType, referenceId, req.user.id]
          );
        }
      }

      for (const inst of installments) {
        if (remaining <= 0) break;
        const owed = Number(inst.amount) - Number(inst.paid_amount);
        if (owed <= 0) continue;
        const applied = Number(Math.min(owed, remaining).toFixed(2));

        const newPaid = Number(inst.paid_amount) + applied;
        const newStatus = newPaid >= Number(inst.amount) - 0.01 ? 'pago' : 'parcial';
        await client.query('UPDATE loan_installments SET paid_amount = $1, status = $2 WHERE id = $3', [newPaid, newStatus, inst.id]);

        await registerPortion(applied, inst.id, 'loan_installment', inst.id);
        remaining = Number((remaining - applied).toFixed(2));
      }

      if (remaining > 0.01) {
        // Sobrou valor além do total das parcelas pendentes: registra como
        // abatimento avulso, direto no empréstimo (ex: adiantamento de capital).
        await registerPortion(remaining, null, 'loan', loanId);
      }

      const { rows: pendingCount } = await client.query(
        `SELECT COUNT(*) FROM loan_installments WHERE loan_id = $1 AND status NOT IN ('pago','cancelado')`,
        [loanId]
      );
      const loanStatus = Number(pendingCount[0].count) === 0 ? 'pago' : 'parcial';
      await client.query('UPDATE loans SET status = $1 WHERE id = $2', [loanStatus, loanId]);

      return paymentsCreated;
    });

    await logAudit({ userId: req.user.id, action: 'payment', tableName: 'loans', recordId: loanId, newData: { interest, principal }, req });
    res.status(201).json({ payments: result });
  } catch (err) {
    next(err);
  }
}

/**
 * Edita um recebimento já lançado (valor, divisão juros/principal, data,
 * forma de pagamento, observações). Usado tanto pela lista "Juros recebidos"
 * quanto pela aba "Recebido" dentro do empréstimo — corrige coisas como
 * "registrei R$100 de juros mas na verdade foram R$100 de juros + R$100 de
 * abatimento do capital".
 *
 * Em vez de sobrescrever o lançamento de caixa original (o que apagaria o
 * histórico), é lançado um ajuste no caixa com a diferença entre o valor
 * antigo e o novo, para que o saldo final bata com o valor corrigido.
 */
async function editLoanPayment(req, res, next) {
  try {
    const paymentId = Number(req.params.id);
    const { interestAmount = 0, principalAmount = 0, paymentDate, paymentMethod, notes } = req.body;
    const newInterest = Number(interestAmount) || 0;
    const newPrincipal = Number(principalAmount) || 0;
    const newTotal = Number((newInterest + newPrincipal).toFixed(2));

    if (newTotal <= 0) return res.status(400).json({ error: 'Informe ao menos um valor de juros ou de abatimento do capital.' });
    if (!PAYMENT_METHODS.includes(paymentMethod)) return res.status(400).json({ error: 'Forma de pagamento inválida.' });

    const result = await withTransaction(async (client) => {
      const { rows: paymentRows } = await client.query(
        `SELECT lp.*, l.person_name, l.status AS loan_status FROM loan_payments lp
         JOIN loans l ON l.id = lp.loan_id
         WHERE lp.id = $1 FOR UPDATE`,
        [paymentId]
      );
      if (paymentRows.length === 0) {
        const err = new Error('Recebimento não encontrado.');
        err.status = 404;
        throw err;
      }
      const oldPayment = paymentRows[0];
      const oldPrincipal = Number(oldPayment.principal_portion);
      const oldInterest = Number(oldPayment.interest_portion);
      const oldTotal = Number(oldPayment.amount);

      // Se o recebimento está ligado a uma parcela específica, ajusta o valor
      // pago dela pela diferença e recalcula o status.
      if (oldPayment.installment_id) {
        const { rows: instRows } = await client.query(
          'SELECT * FROM loan_installments WHERE id = $1 FOR UPDATE', [oldPayment.installment_id]
        );
        if (instRows.length > 0) {
          const inst = instRows[0];
          const deltaAmount = Number((newTotal - oldTotal).toFixed(2));
          const newPaid = Number((Number(inst.paid_amount) + deltaAmount).toFixed(2));
          if (newPaid < -0.01) {
            const err = new Error('Essa edição deixaria o valor pago da parcela negativo.');
            err.status = 400;
            throw err;
          }
          if (newPaid > Number(inst.amount) + 0.01) {
            const err = new Error(`O novo valor excede o total da parcela (R$ ${Number(inst.amount).toFixed(2)}).`);
            err.status = 400;
            throw err;
          }
          const clampedPaid = Math.max(newPaid, 0);
          const newInstallmentStatus = clampedPaid <= 0.01 ? 'pendente'
            : (clampedPaid >= Number(inst.amount) - 0.01 ? 'pago' : 'parcial');
          await client.query(
            'UPDATE loan_installments SET paid_amount = $1, status = $2 WHERE id = $3',
            [clampedPaid, newInstallmentStatus, inst.id]
          );
        }
      }

      const { rows: updatedRows } = await client.query(
        `UPDATE loan_payments SET amount = $1, principal_portion = $2, interest_portion = $3,
           payment_method = $4, payment_date = COALESCE($5, payment_date), notes = $6
         WHERE id = $7 RETURNING *`,
        [newTotal, newPrincipal, newInterest, paymentMethod, paymentDate || null,
         notes !== undefined ? (notes || null) : oldPayment.notes, paymentId]
      );
      const updatedPayment = updatedRows[0];

      // Ajusta o caixa apenas pela diferença, preservando o lançamento original.
      const deltaPrincipal = Number((newPrincipal - oldPrincipal).toFixed(2));
      const deltaInterest = Number((newInterest - oldInterest).toFixed(2));

      if (Math.abs(deltaPrincipal) > 0.001) {
        await client.query(
          `INSERT INTO cash_movements (direction, category, amount, description, reference_type, reference_id, created_by)
           VALUES ($1,'recebimento_emprestimo',$2,$3,'loan_payment',$4,$5)`,
          [deltaPrincipal > 0 ? 'entrada' : 'saida', Math.abs(deltaPrincipal),
           `Ajuste de recebimento (edição) - ${oldPayment.person_name}`, paymentId, req.user.id]
        );
      }
      if (Math.abs(deltaInterest) > 0.001) {
        await client.query(
          `INSERT INTO cash_movements (direction, category, amount, description, reference_type, reference_id, created_by)
           VALUES ($1,'juros_emprestimo',$2,$3,'loan_payment',$4,$5)`,
          [deltaInterest > 0 ? 'entrada' : 'saida', Math.abs(deltaInterest),
           `Ajuste de juros (edição) - ${oldPayment.person_name}`, paymentId, req.user.id]
        );
      }

      // Recalcula o status geral do empréstimo com base nas parcelas.
      if (!['cancelado'].includes(oldPayment.loan_status)) {
        const { rows: pendingCount } = await client.query(
          `SELECT COUNT(*) FROM loan_installments WHERE loan_id = $1 AND status NOT IN ('pago','cancelado')`,
          [oldPayment.loan_id]
        );
        const { rows: paidSum } = await client.query(
          `SELECT COALESCE(SUM(paid_amount), 0) AS total FROM loan_installments WHERE loan_id = $1`,
          [oldPayment.loan_id]
        );
        let loanStatus;
        if (Number(pendingCount[0].count) === 0) loanStatus = 'pago';
        else if (Number(paidSum[0].total) > 0) loanStatus = 'parcial';
        else loanStatus = 'ativo';
        await client.query('UPDATE loans SET status = $1 WHERE id = $2', [loanStatus, oldPayment.loan_id]);
      }

      return { oldPayment, updatedPayment };
    });

    await logAudit({
      userId: req.user.id, action: 'update', tableName: 'loan_payments', recordId: paymentId,
      oldData: result.oldPayment, newData: result.updatedPayment, req,
    });
    res.json({ payment: result.updatedPayment });
  } catch (err) {
    next(err);
  }
}

/**
 * Lista todos os pagamentos que tiveram alguma parcela de juros — usada pelo
 * botão "Juros recebidos", que mostra o histórico e o total já embolsado.
 */
async function listInterestPayments(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT lp.*, l.person_name FROM loan_payments lp
       JOIN loans l ON l.id = lp.loan_id
       WHERE lp.interest_portion > 0
       ORDER BY lp.payment_date DESC`
    );
    const total = rows.reduce((sum, r) => sum + Number(r.interest_portion), 0);
    res.json({ payments: rows, total });
  } catch (err) {
    next(err);
  }
}

async function cancelLoan(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { rows } = await query(
      "UPDATE loans SET status = 'cancelado' WHERE id = $1 AND deleted_at IS NULL RETURNING *",
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Empréstimo não encontrado.' });
    await query("UPDATE loan_installments SET status = 'cancelado' WHERE loan_id = $1 AND status NOT IN ('pago')", [id]);
    await logAudit({ userId: req.user.id, action: 'cancel', tableName: 'loans', recordId: id, newData: rows[0], req });
    res.json({ loan: rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listLoans, getLoan, createLoan, updateLoan, payLoanInstallment,
  receiveLoanPayment, editLoanPayment, listInterestPayments, cancelLoan,
};

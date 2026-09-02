const { query, withTransaction } = require('../config/db');
const { logAudit } = require('../utils/audit');
const { calculateLoanTotal } = require('../utils/loanMath');

const PAYMENT_METHODS = ['dinheiro', 'pix', 'debito', 'credito', 'transferencia', 'outros'];
const INTEREST_TYPES = ['fixo', 'simples', 'por_parcela'];

/**
 * Módulo "Dívidas" — o espelho de Empréstimos: aqui é registrado o dinheiro
 * que EU peguei emprestado de alguém, só para eu não esquecer quanto devo,
 * para quem e quando vence. A lógica é a mesma de loans.js, com o fluxo de
 * caixa invertido (pegar dívida é entrada; pagar dívida é saída).
 */

async function refreshOverdueDebts() {
  await query(
    `UPDATE debt_installments SET status = 'vencido'
     WHERE due_date < CURRENT_DATE AND status IN ('pendente','parcial')`
  );
  await query(
    `UPDATE debts d SET status = 'vencido'
     WHERE d.status = 'ativo' AND d.deleted_at IS NULL
     AND EXISTS (SELECT 1 FROM debt_installments di WHERE di.debt_id = d.id AND di.status = 'vencido')`
  );
}

async function listDebts(req, res, next) {
  try {
    await refreshOverdueDebts();
    const { status, search } = req.query;
    const conditions = ['deleted_at IS NULL'];
    const params = [];
    if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
    if (search) { params.push(`%${search}%`); conditions.push(`creditor_name ILIKE $${params.length}`); }

    const { rows } = await query(
      `SELECT d.*,
         COALESCE((SELECT SUM(paid_amount) FROM debt_installments WHERE debt_id = d.id), 0) AS paid,
         COALESCE((SELECT SUM(amount - paid_amount) FROM debt_installments WHERE debt_id = d.id AND status NOT IN ('cancelado')), 0) AS remaining,
         -- Saldo do capital da dívida (só o que já foi abatido de principal,
         -- sem contar juros) — é o que o botão "Amortização" mostra e desconta,
         -- no mesmo modelo já usado em Empréstimos.
         GREATEST(d.principal_amount - COALESCE((SELECT SUM(principal_portion) FROM debt_payments WHERE debt_id = d.id), 0), 0) AS principal_remaining
       FROM debts d WHERE ${conditions.join(' AND ')} ORDER BY d.debt_date DESC`,
      params
    );
    res.json({ debts: rows });
  } catch (err) {
    next(err);
  }
}

async function getDebt(req, res, next) {
  try {
    await refreshOverdueDebts();
    const id = Number(req.params.id);
    // Mesmo cálculo de "saldo do capital" usado na listagem, para que o botão
    // de amortização e a tela de detalhe mostrem o saldo já descontado assim
    // que um pagamento é registrado.
    const { rows } = await query(
      `SELECT d.*,
         COALESCE((SELECT SUM(paid_amount) FROM debt_installments WHERE debt_id = d.id), 0) AS paid,
         COALESCE((SELECT SUM(amount - paid_amount) FROM debt_installments WHERE debt_id = d.id AND status NOT IN ('cancelado')), 0) AS remaining,
         GREATEST(d.principal_amount - COALESCE((SELECT SUM(principal_portion) FROM debt_payments WHERE debt_id = d.id), 0), 0) AS principal_remaining
       FROM debts d WHERE d.id = $1 AND d.deleted_at IS NULL`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Dívida não encontrada.' });

    const { rows: installments } = await query(
      'SELECT * FROM debt_installments WHERE debt_id = $1 ORDER BY installment_number', [id]
    );
    const { rows: payments } = await query(
      'SELECT * FROM debt_payments WHERE debt_id = $1 ORDER BY payment_date', [id]
    );
    res.json({ debt: rows[0], installments, payments });
  } catch (err) {
    next(err);
  }
}

async function createDebt(req, res, next) {
  try {
    const {
      creditorName, document, phone, principalAmount, interestType = 'fixo', interestPercentage = 0,
      debtDate, installmentsCount = 1, isOpenEnded = false, notes,
    } = req.body;

    if (!creditorName || !creditorName.trim()) return res.status(400).json({ error: 'Nome do credor é obrigatório.' });
    if (!principalAmount || Number(principalAmount) <= 0) return res.status(400).json({ error: 'Valor da dívida inválido.' });
    if (!INTEREST_TYPES.includes(interestType)) return res.status(400).json({ error: 'Tipo de juros inválido.' });
    if (!debtDate) return res.status(400).json({ error: 'Data da dívida é obrigatória.' });
    if (!isOpenEnded && (!installmentsCount || installmentsCount < 1 || installmentsCount > 48)) {
      return res.status(400).json({ error: 'Número de parcelas deve ser entre 1 e 48 meses (ou marque prazo indeterminado).' });
    }

    const totalAmount = calculateLoanTotal({
      principal: principalAmount, interestType, interestPercentage,
      installmentsCount: isOpenEnded ? null : installmentsCount, isOpenEnded,
    });

    const result = await withTransaction(async (client) => {
      const { rows: debtRows } = await client.query(
        `INSERT INTO debts
          (creditor_name, document, phone, principal_amount, interest_type, interest_percentage,
           total_amount, debt_date, installments_count, is_open_ended, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [creditorName.trim(), document || null, phone || null, principalAmount, interestType,
         interestPercentage, totalAmount, debtDate, isOpenEnded ? null : installmentsCount,
         isOpenEnded, notes || null, req.user.id]
      );
      const debt = debtRows[0];
      const installments = [];

      if (!isOpenEnded) {
        const interestRatio = totalAmount > 0 ? (totalAmount - principalAmount) / totalAmount : 0;
        const perInstallment = Math.floor((totalAmount / installmentsCount) * 100) / 100;
        const baseDate = new Date(debtDate);
        let allocated = 0;

        for (let i = 1; i <= installmentsCount; i += 1) {
          const isLast = i === installmentsCount;
          const amount = isLast ? Number((totalAmount - allocated).toFixed(2)) : perInstallment;
          allocated += amount;
          const due = new Date(baseDate);
          due.setUTCMonth(due.getUTCMonth() + i);
          const interestAmount = Number((amount * interestRatio).toFixed(2));
          const principalPortion = Number((amount - interestAmount).toFixed(2));

          const { rows: instRows } = await client.query(
            `INSERT INTO debt_installments (debt_id, installment_number, due_date, amount, interest_amount, principal_amount)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [debt.id, i, due.toISOString().slice(0, 10), amount, interestAmount, principalPortion]
          );
          installments.push(instRows[0]);
        }
      }

      // Dinheiro que peguei emprestado entra no caixa no momento em que a
      // dívida é contraída.
      await client.query(
        `INSERT INTO cash_movements (direction, category, amount, description, reference_type, reference_id, created_by)
         VALUES ('entrada','divida_recebida',$1,$2,'debt',$3,$4)`,
        [principalAmount, `Dívida contraída com ${creditorName.trim()}`, debt.id, req.user.id]
      );

      return { debt, installments };
    });

    await logAudit({ userId: req.user.id, action: 'create', tableName: 'debts', recordId: result.debt.id, newData: result.debt, req });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function updateDebt(req, res, next) {
  try {
    const id = Number(req.params.id);
    const {
      creditorName, document, phone, notes,
      principalAmount, interestType, interestPercentage, debtDate,
      installmentsCount, isOpenEnded,
    } = req.body;

    const { rows: existing } = await query('SELECT * FROM debts WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Dívida não encontrada.' });
    if (!creditorName || !creditorName.trim()) return res.status(400).json({ error: 'Nome do credor é obrigatório.' });
    const debt = existing[0];

    const wantsScheduleChange = [
      principalAmount, interestType, interestPercentage, debtDate, installmentsCount, isOpenEnded,
    ].some((v) => v !== undefined);

    if (wantsScheduleChange) {
      const nextInterestType = interestType || debt.interest_type;
      if (!INTEREST_TYPES.includes(nextInterestType)) return res.status(400).json({ error: 'Tipo de juros inválido.' });
      const nextPrincipal = principalAmount !== undefined ? Number(principalAmount) : Number(debt.principal_amount);
      if (!nextPrincipal || nextPrincipal <= 0) return res.status(400).json({ error: 'Valor da dívida inválido.' });
      const nextOpenEnded = isOpenEnded !== undefined ? !!isOpenEnded : debt.is_open_ended;
      const nextInstallmentsCount = installmentsCount !== undefined ? Number(installmentsCount) : debt.installments_count;
      if (!nextOpenEnded && (!nextInstallmentsCount || nextInstallmentsCount < 1 || nextInstallmentsCount > 48)) {
        return res.status(400).json({ error: 'Número de parcelas deve ser entre 1 e 48 meses (ou marque prazo indeterminado).' });
      }
      const nextInterestPercentage = interestPercentage !== undefined ? Number(interestPercentage) : Number(debt.interest_percentage);
      const nextDebtDate = debtDate || debt.debt_date;

      const result = await withTransaction(async (client) => {
        const { rows: paymentCountRows } = await client.query(
          'SELECT COUNT(*) FROM debt_payments WHERE debt_id = $1', [id]
        );
        const hasPayments = Number(paymentCountRows[0].count) > 0;

        const nextTotal = calculateLoanTotal({
          principal: nextPrincipal, interestType: nextInterestType, interestPercentage: nextInterestPercentage,
          installmentsCount: nextOpenEnded ? null : nextInstallmentsCount, isOpenEnded: nextOpenEnded,
        });

        const { rows: updatedRows } = await client.query(
          `UPDATE debts SET creditor_name = $1, document = $2, phone = $3, notes = $4,
             principal_amount = $5, interest_type = $6, interest_percentage = $7, total_amount = $8,
             debt_date = $9, installments_count = $10, is_open_ended = $11
           WHERE id = $12 RETURNING *`,
          [creditorName.trim(), document || null, phone || null,
           notes !== undefined ? (notes || null) : debt.notes,
           nextPrincipal, nextInterestType, nextInterestPercentage, nextTotal, nextDebtDate,
           nextOpenEnded ? null : nextInstallmentsCount, nextOpenEnded, id]
        );
        const updatedDebt = updatedRows[0];

        let scheduleRebuilt = false;
        if (!hasPayments) {
          await client.query('DELETE FROM debt_installments WHERE debt_id = $1', [id]);
          if (!nextOpenEnded) {
            const interestRatio = nextTotal > 0 ? (nextTotal - nextPrincipal) / nextTotal : 0;
            const perInstallment = Math.floor((nextTotal / nextInstallmentsCount) * 100) / 100;
            const baseDate = new Date(nextDebtDate);
            let allocated = 0;
            for (let i = 1; i <= nextInstallmentsCount; i += 1) {
              const isLast = i === nextInstallmentsCount;
              const amount = isLast ? Number((nextTotal - allocated).toFixed(2)) : perInstallment;
              allocated += amount;
              const due = new Date(baseDate);
              due.setUTCMonth(due.getUTCMonth() + i);
              const interestAmount = Number((amount * interestRatio).toFixed(2));
              const principalPortion = Number((amount - interestAmount).toFixed(2));
              await client.query(
                `INSERT INTO debt_installments (debt_id, installment_number, due_date, amount, interest_amount, principal_amount)
                 VALUES ($1,$2,$3,$4,$5,$6)`,
                [id, i, due.toISOString().slice(0, 10), amount, interestAmount, principalPortion]
              );
            }
          }
          scheduleRebuilt = true;
        }

        return { updatedDebt, scheduleRebuilt };
      });

      await logAudit({ userId: req.user.id, action: 'update', tableName: 'debts', recordId: id, oldData: debt, newData: result.updatedDebt, req });
      return res.json({ debt: result.updatedDebt, scheduleRebuilt: result.scheduleRebuilt });
    }

    const { rows } = await query(
      `UPDATE debts SET creditor_name = $1, document = $2, phone = $3, notes = $4
       WHERE id = $5 RETURNING *`,
      [creditorName.trim(), document || null, phone || null, notes || null, id]
    );

    await logAudit({ userId: req.user.id, action: 'update', tableName: 'debts', recordId: id, oldData: existing[0], newData: rows[0], req });
    res.json({ debt: rows[0], scheduleRebuilt: false });
  } catch (err) {
    next(err);
  }
}

/**
 * Registra um pagamento feito por mim ao credor: valor de juros + abatimento
 * do capital, aplicado nas parcelas pendentes (mais antiga primeiro).
 */
async function payDebt(req, res, next) {
  try {
    const debtId = Number(req.params.id);
    const { interestAmount = 0, principalAmount = 0, paymentMethod, notes } = req.body;
    const interest = Number(interestAmount) || 0;
    const principal = Number(principalAmount) || 0;
    const total = Number((interest + principal).toFixed(2));

    if (total <= 0) return res.status(400).json({ error: 'Informe o valor de juros e/ou de abatimento do capital.' });
    if (!PAYMENT_METHODS.includes(paymentMethod)) return res.status(400).json({ error: 'Forma de pagamento inválida.' });

    const result = await withTransaction(async (client) => {
      const { rows: debtRows } = await client.query(
        'SELECT * FROM debts WHERE id = $1 AND deleted_at IS NULL FOR UPDATE', [debtId]
      );
      if (debtRows.length === 0) {
        const err = new Error('Dívida não encontrada.');
        err.status = 404;
        throw err;
      }
      const debt = debtRows[0];

      const { rows: installments } = await client.query(
        `SELECT * FROM debt_installments WHERE debt_id = $1 AND status NOT IN ('pago','cancelado')
         ORDER BY installment_number FOR UPDATE`,
        [debtId]
      );

      const interestRatio = total > 0 ? interest / total : 0;
      let remaining = total;
      const paymentsCreated = [];

      async function registerPortion(applied, installmentId) {
        const appliedInterest = Number((applied * interestRatio).toFixed(2));
        const appliedPrincipal = Number((applied - appliedInterest).toFixed(2));

        const { rows: paymentRows } = await client.query(
          `INSERT INTO debt_payments (debt_id, installment_id, amount, principal_portion, interest_portion, payment_method, notes, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
          [debtId, installmentId, applied, appliedPrincipal, appliedInterest, paymentMethod, notes || null, req.user.id]
        );
        paymentsCreated.push(paymentRows[0]);
      }

      for (const inst of installments) {
        if (remaining <= 0) break;
        const owed = Number(inst.amount) - Number(inst.paid_amount);
        if (owed <= 0) continue;
        const applied = Number(Math.min(owed, remaining).toFixed(2));

        const newPaid = Number(inst.paid_amount) + applied;
        const newStatus = newPaid >= Number(inst.amount) - 0.01 ? 'pago' : 'parcial';
        await client.query('UPDATE debt_installments SET paid_amount = $1, status = $2 WHERE id = $3', [newPaid, newStatus, inst.id]);

        await registerPortion(applied, inst.id);
        remaining = Number((remaining - applied).toFixed(2));
      }

      if (remaining > 0.01) {
        await registerPortion(remaining, null);
      }

      // Pagar uma dívida é dinheiro saindo do caixa.
      await client.query(
        `INSERT INTO cash_movements (direction, category, amount, description, reference_type, reference_id, created_by)
         VALUES ('saida','divida_paga',$1,$2,'debt',$3,$4)`,
        [total, `Pagamento de dívida - ${debt.creditor_name}`, debtId, req.user.id]
      );

      const { rows: pendingCount } = await client.query(
        `SELECT COUNT(*) FROM debt_installments WHERE debt_id = $1 AND status NOT IN ('pago','cancelado')`,
        [debtId]
      );
      const debtStatus = Number(pendingCount[0].count) === 0 ? 'pago' : 'parcial';
      await client.query('UPDATE debts SET status = $1 WHERE id = $2', [debtStatus, debtId]);

      return paymentsCreated;
    });

    await logAudit({ userId: req.user.id, action: 'payment', tableName: 'debts', recordId: debtId, newData: { interest, principal }, req });
    res.status(201).json({ payments: result });
  } catch (err) {
    next(err);
  }
}

/**
 * Paga uma parcela específica da dívida (botão "Pagar" na aba "Parcelas" do
 * detalhe) — espelho de payLoanInstallment. O valor é dividido entre juros e
 * principal na mesma proporção da parcela, para diferenciar quanto foi
 * amortização de capital e quanto foi juros pago ao credor.
 */
async function payDebtInstallment(req, res, next) {
  try {
    const installmentId = Number(req.params.id);
    const { amount, paymentMethod, notes } = req.body;

    if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Valor inválido.' });
    if (!PAYMENT_METHODS.includes(paymentMethod)) return res.status(400).json({ error: 'Forma de pagamento inválida.' });

    const result = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT di.*, d.creditor_name, d.principal_amount, d.total_amount
         FROM debt_installments di JOIN debts d ON d.id = di.debt_id
         WHERE di.id = $1 FOR UPDATE`,
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

      const interestRatio = installment.total_amount > 0
        ? (installment.total_amount - installment.principal_amount) / installment.total_amount
        : 0;
      const interestPortion = Number((amount * interestRatio).toFixed(2));
      const principalPortion = Number((amount - interestPortion).toFixed(2));

      const newPaid = Number(installment.paid_amount) + Number(amount);
      const newStatus = newPaid >= Number(installment.amount) - 0.01 ? 'pago' : 'parcial';

      const { rows: updated } = await client.query(
        'UPDATE debt_installments SET paid_amount = $1, status = $2 WHERE id = $3 RETURNING *',
        [newPaid, newStatus, installmentId]
      );

      await client.query(
        `INSERT INTO debt_payments (debt_id, installment_id, amount, principal_portion, interest_portion, payment_method, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [installment.debt_id, installmentId, amount, principalPortion, interestPortion, paymentMethod, notes || null, req.user.id]
      );

      // Pagar a parcela é dinheiro saindo do caixa.
      await client.query(
        `INSERT INTO cash_movements (direction, category, amount, description, reference_type, reference_id, created_by)
         VALUES ('saida','divida_paga',$1,$2,'debt_installment',$3,$4)`,
        [amount, `Pagamento de dívida - ${installment.creditor_name}`, installmentId, req.user.id]
      );

      const { rows: pendingCount } = await client.query(
        `SELECT COUNT(*) FROM debt_installments WHERE debt_id = $1 AND status NOT IN ('pago','cancelado')`,
        [installment.debt_id]
      );
      const debtStatus = Number(pendingCount[0].count) === 0 ? 'pago' : 'parcial';
      await client.query('UPDATE debts SET status = $1 WHERE id = $2', [debtStatus, installment.debt_id]);

      return updated[0];
    });

    await logAudit({ userId: req.user.id, action: 'payment', tableName: 'debt_installments', recordId: installmentId, newData: result, req });
    res.json({ installment: result });
  } catch (err) {
    next(err);
  }
}

/**
 * Edita um pagamento já lançado (valor, divisão juros/principal, data, forma
 * de pagamento, observações) — espelho de editLoanPayment. Em vez de
 * sobrescrever o lançamento de caixa original, lança um ajuste no caixa com a
 * diferença entre o valor antigo e o novo.
 */
async function editDebtPayment(req, res, next) {
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
        `SELECT dp.*, d.creditor_name, d.status AS debt_status FROM debt_payments dp
         JOIN debts d ON d.id = dp.debt_id
         WHERE dp.id = $1 FOR UPDATE`,
        [paymentId]
      );
      if (paymentRows.length === 0) {
        const err = new Error('Pagamento não encontrado.');
        err.status = 404;
        throw err;
      }
      const oldPayment = paymentRows[0];
      const oldTotal = Number(oldPayment.amount);

      // Se o pagamento está ligado a uma parcela específica, ajusta o valor
      // pago dela pela diferença e recalcula o status.
      if (oldPayment.installment_id) {
        const { rows: instRows } = await client.query(
          'SELECT * FROM debt_installments WHERE id = $1 FOR UPDATE', [oldPayment.installment_id]
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
            'UPDATE debt_installments SET paid_amount = $1, status = $2 WHERE id = $3',
            [clampedPaid, newInstallmentStatus, inst.id]
          );
        }
      }

      const { rows: updatedRows } = await client.query(
        `UPDATE debt_payments SET amount = $1, principal_portion = $2, interest_portion = $3,
           payment_method = $4, payment_date = COALESCE($5, payment_date), notes = $6
         WHERE id = $7 RETURNING *`,
        [newTotal, newPrincipal, newInterest, paymentMethod, paymentDate || null,
         notes !== undefined ? (notes || null) : oldPayment.notes, paymentId]
      );
      const updatedPayment = updatedRows[0];

      // Ajusta o caixa apenas pela diferença, preservando o lançamento original.
      const deltaTotal = Number((newTotal - oldTotal).toFixed(2));
      if (Math.abs(deltaTotal) > 0.001) {
        await client.query(
          `INSERT INTO cash_movements (direction, category, amount, description, reference_type, reference_id, created_by)
           VALUES ($1,'divida_paga',$2,$3,'debt_payment',$4,$5)`,
          [deltaTotal > 0 ? 'saida' : 'entrada', Math.abs(deltaTotal),
           `Ajuste de pagamento (edição) - ${oldPayment.creditor_name}`, paymentId, req.user.id]
        );
      }

      // Recalcula o status geral da dívida com base nas parcelas.
      if (!['cancelado'].includes(oldPayment.debt_status)) {
        const { rows: pendingCount } = await client.query(
          `SELECT COUNT(*) FROM debt_installments WHERE debt_id = $1 AND status NOT IN ('pago','cancelado')`,
          [oldPayment.debt_id]
        );
        const { rows: paidSum } = await client.query(
          `SELECT COALESCE(SUM(paid_amount), 0) AS total FROM debt_installments WHERE debt_id = $1`,
          [oldPayment.debt_id]
        );
        let debtStatus;
        if (Number(pendingCount[0].count) === 0) debtStatus = 'pago';
        else if (Number(paidSum[0].total) > 0) debtStatus = 'parcial';
        else debtStatus = 'ativo';
        await client.query('UPDATE debts SET status = $1 WHERE id = $2', [debtStatus, oldPayment.debt_id]);
      }

      return { oldPayment, updatedPayment };
    });

    await logAudit({
      userId: req.user.id, action: 'update', tableName: 'debt_payments', recordId: paymentId,
      oldData: result.oldPayment, newData: result.updatedPayment, req,
    });
    res.json({ payment: result.updatedPayment });
  } catch (err) {
    next(err);
  }
}

/**
 * Lista todos os pagamentos que tiveram alguma parcela de juros — espelho de
 * listInterestPayments, usado pelo botão "Juros pagos" em Dívidas.
 */
async function listInterestPaymentsDebt(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT dp.*, d.creditor_name, di.due_date AS installment_due_date
       FROM debt_payments dp
       JOIN debts d ON d.id = dp.debt_id
       LEFT JOIN debt_installments di ON di.id = dp.installment_id
       WHERE dp.interest_portion > 0
       ORDER BY dp.payment_date DESC`
    );
    const total = rows.reduce((sum, r) => sum + Number(r.interest_portion), 0);
    res.json({ payments: rows, total });
  } catch (err) {
    next(err);
  }
}

/**
 * Aba "Juros por mês" de Dívidas: mostra todas as parcelas de todas as
 * dívidas (pagas ou não) já com a data de vencimento e o juro previsto para
 * aquele mês — espelho de listInstallmentsSchedule.
 */
async function listDebtInstallmentsSchedule(req, res, next) {
  try {
    await refreshOverdueDebts();
    const { rows } = await query(
      `SELECT di.*, d.creditor_name, d.is_open_ended
       FROM debt_installments di
       JOIN debts d ON d.id = di.debt_id
       WHERE d.deleted_at IS NULL AND di.status <> 'cancelado'
       ORDER BY di.due_date ASC`
    );
    const totalInterest = rows.reduce((sum, r) => sum + Number(r.interest_amount), 0);
    res.json({ installments: rows, totalInterest });
  } catch (err) {
    next(err);
  }
}

async function updateDebtInstallment(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { dueDate, amount } = req.body;

    const { rows } = await query(
      `SELECT di.*, d.principal_amount AS debt_principal_amount, d.total_amount AS debt_total_amount
       FROM debt_installments di
       JOIN debts d ON d.id = di.debt_id WHERE di.id = $1`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Parcela não encontrada.' });
    const inst = rows[0];
    if (inst.status === 'cancelado') return res.status(400).json({ error: 'Esta parcela está cancelada.' });

    const nextDueDate = dueDate || inst.due_date;
    let nextAmount = Number(inst.amount);
    let nextInterest = Number(inst.interest_amount);
    let nextPrincipal = Number(inst.principal_amount);

    if (amount !== undefined && amount !== null && amount !== '') {
      if (Number(inst.paid_amount) > 0) {
        return res.status(400).json({ error: 'Esta parcela já tem valor pago; só a data de vencimento pode ser editada.' });
      }
      nextAmount = Number(amount);
      if (!nextAmount || nextAmount <= 0) return res.status(400).json({ error: 'Valor da parcela inválido.' });
      const ratio = Number(inst.debt_total_amount) > 0
        ? (Number(inst.debt_total_amount) - Number(inst.debt_principal_amount)) / Number(inst.debt_total_amount) : 0;
      nextInterest = Number((nextAmount * ratio).toFixed(2));
      nextPrincipal = Number((nextAmount - nextInterest).toFixed(2));
    }

    const { rows: updated } = await query(
      `UPDATE debt_installments SET due_date = $1, amount = $2, interest_amount = $3, principal_amount = $4
       WHERE id = $5 RETURNING *`,
      [nextDueDate, nextAmount, nextInterest, nextPrincipal, id]
    );

    await logAudit({ userId: req.user.id, action: 'update', tableName: 'debt_installments', recordId: id, oldData: inst, newData: updated[0], req });
    res.json({ installment: updated[0] });
  } catch (err) {
    next(err);
  }
}

async function cancelDebt(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { rows } = await query(
      "UPDATE debts SET status = 'cancelado' WHERE id = $1 AND deleted_at IS NULL RETURNING *",
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Dívida não encontrada.' });
    await query("UPDATE debt_installments SET status = 'cancelado' WHERE debt_id = $1 AND status NOT IN ('pago')", [id]);
    await logAudit({ userId: req.user.id, action: 'cancel', tableName: 'debts', recordId: id, newData: rows[0], req });
    res.json({ debt: rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listDebts, getDebt, createDebt, updateDebt, payDebt, payDebtInstallment, editDebtPayment,
  listInterestPaymentsDebt, listDebtInstallmentsSchedule, updateDebtInstallment, cancelDebt,
};

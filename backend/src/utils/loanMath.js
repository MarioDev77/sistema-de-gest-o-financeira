/**
 * Calcula o valor total a receber de um empréstimo, conforme o tipo de juros.
 * Nunca assume juros compostos — apenas as três variações pedidas no escopo:
 *
 * - "fixo": percentual aplicado uma única vez sobre o principal, independente
 *   do número de parcelas. Ex: R$1.000 a 10% fixo = R$1.100 no total.
 *
 * - "simples": juros simples proporcional ao número de parcelas (tratado como
 *   proxy do tempo do empréstimo — 1 parcela ~ 1 "período"). Ex: R$1.000 a 10%
 *   simples em 3 parcelas = 1000 + 1000*0.10*3 = R$1.300.
 *
 * - "por_parcela": o percentual informado já é o total pretendido a cobrar de
 *   juros e é apenas distribuído entre as parcelas (equivalente ao "fixo" no
 *   total, mas comunica que o juros é cobrado parcela a parcela, não de uma vez).
 *   Documentamos aqui a decisão porque o enunciado original não define a
 *   fórmula exata — ajuste esta função se a regra de negócio real for outra.
 */
function calculateLoanTotal({ principal, interestType, interestPercentage, installmentsCount, isOpenEnded }) {
  const p = Number(principal);
  const pct = Number(interestPercentage) / 100;

  // Empréstimo de prazo indeterminado: não existe uma "quantidade de parcelas"
  // para projetar o total de juros de antemão — os juros são cobrados mês a
  // mês, sobre o saldo em aberto, e lançados manualmente a cada recebimento
  // (endpoint /loans/:id/receive). Por isso o total inicial é só o principal;
  // ele cresce/diminui conforme os recebimentos de juros e abatimentos forem
  // registrados.
  if (isOpenEnded) {
    return Number(p.toFixed(2));
  }

  if (interestType === 'simples') {
    return Number((p + p * pct * installmentsCount).toFixed(2));
  }
  // 'fixo' e 'por_parcela' usam a mesma fórmula de total — a diferença entre
  // elas é só comunicada ao usuário sobre como o juros é apresentado, não há
  // hoje um efeito diferente no cálculo do total.
  return Number((p * (1 + pct)).toFixed(2));
}

module.exports = { calculateLoanTotal };

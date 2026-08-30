-- Migration 008: novo tipo de juros "mensal" (único oferecido daqui pra frente)
-- O que muda: "mensal" passa a ser a única opção no formulário de criar/editar
-- empréstimo — juros cobrados mês a mês sobre o capital, sem parcelas fixas e
-- sem abater o capital automaticamente (mesmo motor que já existia para
-- "prazo indeterminado"; só ficou mais simples de escolher no formulário).
-- Os tipos antigos (fixo/simples/por_parcela) continuam válidos no banco
-- apenas para não quebrar empréstimos já cadastrados com eles.
-- Tabelas afetadas: loans.
-- Impacto: nenhuma perda de dado.
-- Como desfazer: 008_loan_interest_mensal_down.sql

ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_interest_type_check;
ALTER TABLE loans ADD CONSTRAINT loans_interest_type_check
  CHECK (interest_type IN ('fixo','simples','por_parcela','mensal'));

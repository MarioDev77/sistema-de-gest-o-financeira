# Backend — Gestão Financeira Perfumaria

API em Node.js + Express + PostgreSQL.

## Setup

```bash
npm install
cp .env.example .env
# edite o .env com a DATABASE_URL do Railway, JWT_SECRET, etc.

npm run migrate       # cria as tabelas (roda 001, 002 e 003 em ordem)
npm run seed:admin    # cria o primeiro usuário administrador

npm run dev           # desenvolvimento (nodemon)
npm start             # produção
```

## Módulos implementados

**Bloco 1 — núcleo operacional**
- Autenticação (JWT + bcrypt), usuários (admin/funcionário)
- Categorias e Produtos (CRUD, cálculo de margem/lucro)
- Estoque (movimentações manuais + automáticas por venda, alerta de estoque baixo)
- Clientes (CRUD + histórico de compras e pendências)
- Vendas (à vista e a prazo, parcelas, baixa de estoque, cancelamento com estorno)
- Despesas (CRUD, marcar como paga → gera saída no caixa)
- Fluxo de Caixa (livro-caixa alimentado automaticamente por vendas/despesas/empréstimos)
- Dashboard (indicadores e gráficos com dados reais)

**Bloco 2 — financeiro avançado**
- Empréstimos (juros fixo/simples/por parcela, parcelas, pagamentos com split principal/juros)
- Balancete mensal (receitas, saídas, resultados)
- Relatórios em PDF: Vendas, Despesas, Fluxo de Caixa, Empréstimos (`pdfkit`)
- Exportação Excel: 10 planilhas num único workbook (`exceljs`) — Vendas, Produtos,
  Estoque, Clientes, Contas a Receber, Despesas, Fluxo de Caixa, Empréstimos,
  Pagamentos de Empréstimos, Balancete
- Analista Financeiro IA: agrega dados reais (produtos mais vendidos/parados, maiores
  despesas, clientes com pendência, empréstimos vencidos); se `ANTHROPIC_API_KEY`
  estiver configurada, também gera uma narrativa/recomendações via API — sempre
  deixando explícito o que é dado real e o que é sugestão da IA
- Fechamento Mensal (snapshot consolidado, nunca apaga histórico)
- Auditoria: toda operação sensível grava em `audit_logs` (quem, o quê, quando,
  valor antes/depois) — tabela somente-inserção, sem rota de update/delete

## Estrutura

```
src/
  config/db.js            conexão com o PostgreSQL (pool + helper de transação)
  migrations/              001 (auth/cadastro), 002 (vendas/estoque/despesas/caixa),
                           003 (empréstimos/fechamento) + runner (npm run migrate)
  middlewares/             auth (JWT + role), tratamento central de erros
  controllers/             regra de negócio de cada módulo
  routes/                  rotas da API, com permissão por papel em cada uma
  utils/                   auditoria, cálculo de juros, geração de PDF
  app.js / server.js
```

## Permissões por papel

- **Admin**: acesso completo a todos os módulos.
- **Funcionário**: pode registrar vendas, consultar produtos e estoque, e
  cadastrar/consultar clientes. Despesas, Fluxo de Caixa, Empréstimos, Balancete,
  Relatórios, IA, Fechamento Mensal e gestão de usuários são restritos a admin —
  alinhado com a regra do escopo original ("funcionário não pode alterar
  registros financeiros sem permissão").

## Decisões de segurança já aplicadas

- Senhas com `bcrypt` (custo 12), nunca texto puro; JWT assinado com segredo do `.env`.
- Middleware `authenticate` revalida o usuário no banco a cada requisição.
- `requireRole` em toda rota administrativa — nunca só no frontend.
- `helmet` + rate limiting (geral e reforçado no login).
- Soft delete (`deleted_at`/`deleted_by`) em `users`, `products`, `customers`, `expenses`, `loans`, `sales` (via status).
- Todo valor monetário em `numeric(12,2)`, nunca `float`.
- FKs com `ON DELETE` explícito, sem `CASCADE` automático não avaliado.
- Transações (`withTransaction`) em toda operação que mexe em mais de uma tabela
  (venda, pagamento de parcela, movimentação de estoque) — tudo ou nada.
- `.env` fora do controle de versão.

## O que foi simplificado em relação ao prompt original (transparência)

- O prompt de auditoria/hardening completo (RLS ao estilo Supabase, revisão linha
  a linha de cada policy) foi endereçado através dos equivalentes em Node/Express +
  PostgreSQL puro: toda query já filtra por autorização na camada de aplicação
  (não há RLS nativo do Postgres configurado, pois a arquitetura escolhida foi
  backend próprio, não Supabase). Se no futuro migrar para Supabase, as políticas
  RLS precisam ser recriadas a partir das regras de autorização já implementadas aqui.
- Os 12 tipos de relatório do escopo foram consolidados em 4 PDFs + 1 Excel completo
  (que cobre a maior parte dos dados) em vez de 9 documentos PDF separados.
- O cálculo de juros "por parcela" foi implementado com a mesma fórmula do "fixo"
  (ver comentário em `utils/loanMath.js`) — ajuste se a regra de negócio real for outra.

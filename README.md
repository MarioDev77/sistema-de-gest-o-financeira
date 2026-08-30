# Gestão Financeira — Loja de Perfumes

Sistema completo de Gestão Financeira, Vendas, Estoque, Clientes, Empréstimos
e Relatórios para loja de perfumes.

- `backend/`  — API Node.js + Express + PostgreSQL (ver backend/README.md)
- `frontend/` — Next.js 14 + Tailwind CSS (ver frontend/README.md)

## Ordem de setup

1. Suba um PostgreSQL (Railway) e configure `backend/.env` (copie de `.env.example`)
2. `cd backend && npm install && npm run migrate && npm run seed:admin && npm run dev`
3. Configure `frontend/.env.local` (copie de `.env.local.example`) apontando pra API
4. `cd frontend && npm install && npm run dev`
5. Acesse http://localhost:3000, faça login com o admin criado no passo 2

## Testado ponta a ponta (backend contra PostgreSQL real)

Login, permissões admin x funcionário, produtos, estoque, vendas (à vista e a
prazo com parcelas), clientes, despesas, fluxo de caixa, empréstimos com
juros, balancete, dashboard, relatórios em PDF e Excel, e fechamento mensal —
todos os fluxos rodaram sem erro e com os cálculos financeiros conferidos.
O build de produção do frontend (`npm run build`) também foi validado, com
as 15 rotas compilando sem erros.

Cada README (backend/frontend) documenta os módulos implementados e o que foi
simplificado em relação ao prompt original, com total transparência.

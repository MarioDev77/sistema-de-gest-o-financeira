# Frontend — Gestão Financeira Perfumaria

Next.js 14 (App Router) + React + Tailwind CSS.

## Setup

```bash
npm install
cp .env.local.example .env.local
# ajuste NEXT_PUBLIC_API_URL se o backend não estiver em localhost:4000

npm run dev      # http://localhost:3000
npm run build && npm start   # produção
```

## Páginas implementadas

- `/login` — autenticação
- `/dashboard` — indicadores reais + gráficos (faturamento 14 dias, formas de pagamento) — **admin**
- `/produtos` — catálogo, categorias, margem/lucro calculados
- `/estoque` — movimentações, alerta de estoque baixo
- `/clientes` — cadastro + histórico de compras/pendências
- `/vendas` — criação (à vista/a prazo), detalhe com parcelas e pagamento
- `/despesas` — cadastro, marcar como paga — **admin**
- `/fluxo-caixa` — livro-caixa com saldo — **admin**
- `/emprestimos` — cadastro, parcelas, pagamento com juros — **admin**
- `/balancete` — resumo mensal por período — **admin**
- `/relatorios` — download de PDF (vendas/despesas/fluxo/empréstimos) e Excel completo — **admin**
- `/ia` — Analista Financeiro IA (dados reais + recomendações opcionais) — **admin**
- `/fechamento` — fechar mês (snapshot consolidado) — **admin**

Funcionário é redirecionado para `/vendas` após o login (não tem acesso às telas
financeiras administrativas, que o menu lateral já esconde automaticamente).

## Como as páginas conversam com a API

- `src/lib/api.js` — `apiFetch` (JSON) e `apiDownload` (PDF/Excel com token, dispara
  o download no navegador)
- `src/lib/useApiClient.js` — hook que já injeta o token da sessão atual
- Todo componente de UI reutilizável está em `src/components/ui/`
  (Button, Field, Modal, Table, Badge, StatCard, PageHeader, ErrorBanner)

## Identidade visual

Paleta "Livro-Caixa" (tinta escura + dourado), tipografia Fraunces (display) +
Inter (corpo, números tabulares), tema claro/escuro com toggle sem flash.

## O que foi simplificado (transparência)

- Os gráficos do dashboard cobrem faturamento diário e formas de pagamento —
  os demais gráficos do escopo original (vendas à vista x prazo, produtos mais
  lucrativos, evolução do lucro, etc.) podem ser adicionados seguindo o mesmo
  padrão em `dashboard/page.js`, usando os dados já disponíveis na API.
- Não há paginação nas tabelas (as rotas da API já limitam a 200–500 registros
  mais recentes) — para um volume muito grande de dados, isso precisará de
  paginação real no backend e no frontend.

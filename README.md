# Starbem · Plataforma de Precificação

Ferramenta web interna para calcular o **preço por vida elegível** de cada
proposta comercial B2B, validando a **margem real** por trás do preço cobrado.
Substitui o cálculo manual em planilhas por uma lógica auditável e testada.

## Como rodar (local)

Precisa de uma connection string PostgreSQL em `DATABASE_URL` (crie um `.env` a
partir do `.env.example`). Para desenvolvimento local você pode subir um Postgres
descartável com `npx prisma dev` e usar a URL que ele imprime.

```bash
npm install
export DATABASE_URL="postgres://..."   # ou coloque no .env
npm run db:push      # cria as tabelas a partir do schema Prisma
npm run db:seed      # popula o cenário de referência (Starbem)
npm run dev          # http://localhost:3000
```

O app também se **auto-inicializa**: no primeiro acesso com o banco vazio, ele
cria o cenário de referência sozinho — então após `db:push` (ou `migrate deploy`)
não é obrigatório rodar o seed manualmente.

Testes da camada de cálculo (o coração da ferramenta):

```bash
npm test
```

## Deploy na Vercel

1. **Importe o repositório** na Vercel (New Project → importe este repo/branch).
2. **Adicione um Postgres** — no projeto Vercel, aba *Storage* → *Create Database*
   → Postgres (ou conecte Neon/Supabase). Isso define `DATABASE_URL`
   automaticamente. Se definir manualmente, use a URL **direta (non-pooling)**,
   pois as migrações rodam no build.
3. **Deploy.** O build já roda `prisma migrate deploy` (cria as tabelas) via
   `vercel.json`, e o app popula o cenário de referência no primeiro acesso.

Nenhum passo manual de banco é necessário — ao abrir o link, o Dashboard já
mostra os pacotes e preços de referência.

## Stack

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind CSS v4**
- **Prisma 7 + PostgreSQL** (driver adapter `pg`) para persistência
- **ExcelJS** para exportação da matriz
- **Vitest** para os testes unitários da precificação

## Arquitetura

Toda a lógica de negócio vive em funções **puras** em `src/lib/pricing/`, isolada
de React e do banco. A mesma função alimenta a matriz, a calculadora reversa e a
análise de margem — e é fixada por testes.

```
src/
  lib/pricing/
    types.ts       # modelo de domínio (tudo em frações: 0.40 = 40%)
    calc.ts        # funções puras de precificação
    reference.ts   # cenário real da Starbem (seed + teste de aceite)
    calc.test.ts   # 23 testes travando os números de referência
  lib/
    db.ts          # Prisma client (adapter better-sqlite3)
    data.ts        # DB -> tipos de precificação
    format.ts      # formatação pt-BR / BRL
  app/
    page.tsx                     # Dashboard
    simulador/                   # Matriz + Margem Real vs. Venda + excedente
    calculadora-reversa/         # Margem desejada -> preço necessário
    configuracoes/               # CRUD especialidades, pacotes, parâmetros
    api/export/matrix/route.ts   # Exportação Excel da matriz
```

## Modelo de cálculo (resumo)

- **Custo de venda** de uma especialidade com sessão dupla assume 100% da
  duração cheia (Psicologia 2 créditos = R$50). **Custo real** usa o mix de
  duração observado (76%×25 + 24%×50 = **R$31**).
- **Preço médio da consulta** = média ponderada pelo mix do pacote
  (venda **R$47,50**, custo real **R$30,40** no cenário de referência).
- **Fator no-show** = `(1 − no_show) + no_show × repasse` = **0,9265**.
- **Divisor** = `1 − margem_alvo − imposto` = **0,4875** (margem líquida).
- **Preço/vida** = `utilização × recorrência × custo_efetivo ÷ divisor`.
- **Consulta excedente** = `preço_médio ÷ divisor` (sem no-show, pois é evento
  já realizado).
- **Excedente populacional**: utilização acima da faixa máxima da matriz é
  cobrada como consulta excedente — é o que reconcilia a margem real de ~58,1%.

## Cenário de referência (teste de aceite)

Reproduzido exatamente por `src/lib/pricing/calc.test.ts`:

| Item | Esperado |
|---|---|
| Custo real Psicologia | R$31,00 |
| Consulta média (venda) | R$47,50 |
| Consulta média (custo real) | R$30,40 |
| Fator no-show | 0,9265 |
| Divisor | 0,4875 |
| Preço/vida TP2/TP3 @10% | R$18,05 |
| Preço/vida TP4+ @10% | R$31,60 |
| Consulta excedente | R$97,44 |
| Margem real (cenário 12,6%) | ~58,1% |

## Roadmap

- **Fase 1 (MVP) — pronto:** CRUD de especialidades/pacotes/parâmetros, matriz de
  preço, excedente, painel Margem Real vs. Venda, exportação Excel.
- **Fase 2 — parcial:** calculadora reversa (pronta); snapshots de propostas com
  histórico de versões modelados no schema (`Proposal`/`ProposalVersion`).
- **Fase 3:** upload de utilização real (CSV/BI), alertas de piso de margem,
  controle de acesso multiusuário.

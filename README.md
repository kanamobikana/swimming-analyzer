# Starbem · Plataforma de Precificação

Ferramenta web interna para calcular o **preço por vida elegível** de cada
proposta comercial B2B, validando a **margem real** por trás do preço cobrado.
Substitui o cálculo manual em planilhas por uma lógica auditável e testada.

## Como rodar

```bash
npm install
npm run db:push      # cria o SQLite (dev.db) a partir do schema Prisma
npm run db:seed      # popula o cenário de referência (Starbem)
npm run dev          # http://localhost:3000
```

Testes da camada de cálculo (o coração da ferramenta):

```bash
npm test
```

## Stack

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind CSS v4**
- **Prisma 7 + SQLite** (driver adapter `better-sqlite3`) para persistência
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

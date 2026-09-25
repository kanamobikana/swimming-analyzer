# Race Performance Intelligence

Dashboard pessoal de performance no triathlon, construído em torno de uma pergunta:

> **Onde estou hoje, quanto falta para a vaga no Mundial e onde exatamente estão os minutos?**

App mobile-first com fundo claro e números grandes. Cruza treinos, provas e o field completo da categoria. O objetivo é transformar dado em decisão em menos de 30 segundos.

## Como rodar

```bash
cd race-intelligence
npm install
npm run dev        # http://localhost:3000
npm test           # testes do motor analítico, parsers e integrações
```

O app roda sem nenhuma configuração, com **dados de exemplo** marcados como tal na interface: perfil, cerca de 20 meses de treinos e 8 provas com fields sintéticos. Para usar dados reais, copie `.env.example` para `.env.local` e preencha:

| Variável | Para quê |
|---|---|
| `APP_PASSWORD`, `AUTH_SECRET` | Login de uso pessoal. Sem senha, o app fica aberto. |
| `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` | Integração com o Strava via OAuth. O callback é `/api/strava/callback`. |
| `ANTHROPIC_API_KEY` | AI Analyst com o Claude. Sem a chave, as perguntas-chave são respondidas pelo analista local. |
| `DATA_DIR` | Pasta do store JSON (padrão `./.data`). |

Em **Perfil → Integrações** dá para conectar o Strava, importar GPX/TCX e desligar os dados de exemplo.

### Deploy (Vercel)

Crie um projeto na Vercel com **Root Directory = `race-intelligence`**. A plataforma de precificação da Starbem na raiz do repositório continua independente. Na Vercel o store JSON fica em `/tmp`, que é **efêmero**. Para produção, o próximo passo é o Postgres (ver Arquitetura).

## O que o MVP 1 entrega

| # | Funcionalidade | Onde |
|---|---|---|
| 1 | Autenticação (senha única + cookie HMAC) | `proxy.ts`, `/login` |
| 2 | Perfil do atleta, histórico fisiológico e linha do tempo de categoria (M45-49 → M50-54) | `/perfil` |
| 3 | Integração Strava (OAuth, refresh, sync incremental, detalhes, zonas, best efforts) | `lib/integrations/strava` |
| 4 | Dashboard de treino: 7/30/90/180/365 dias, volume, zonas, polarização, CTL/ATL/TSB, pace e potência na mesma FC, melhores marcas, consistência, PBs | `/treinos` |
| 5–7 | Cadastro de prova + URL oficial ou tabela colada (HTML, CSV/TSV, JSON), identificação por nome/nº de peito | `/provas/nova` |
| 8 | Tabela da categoria (Pos · Atleta · Swim · T1 · Bike · T2 · Run · Total · Gap), com a sua linha destacada | `/provas/[id]` |
| 9 | Comparação com P1/P3/P5/P10/P20/Top 10%/Top 20%/mediana/última vaga, com seletor que recalcula tudo | `/provas/[id]?vs=P5` |
| 10 | **Where are the minutes?**: decomposição do gap e maior perda identificada automaticamente | Home e prova |
| 11 | Race history com filtros e evolução relativa (percentil por prova e por modalidade) | `/provas` |
| 12 | What-if Simulator (pace, km/h **ou watts** com modelo calibrado pela prova) contra o field real | `/simulador` |
| 13 | Road to Worlds: qualification gap, vagas (oficial × estimativa × resultado esportivo) | `/worlds` |
| 14 | AI Performance Analyst (Claude, com fallback local determinístico) | `/analista` |

Também já estão prontos: Time Gain Opportunities, Race Strength Index (sempre sinalizado como estimativa), relatório pós-prova, treino → resultado (janelas de 30/60/90 dias com aderência, longões, bricks e taper), head-to-head e histórico de competidores (`/atletas`), KPIs atual × anterior e consistency score mensal.

## Princípios de modelagem

- **Fato × estimativa × oficial.** Cada número derivado carrega a proveniência: `official`, `imported`, `manual`, `estimate` ou `mock`. Posição na categoria nunca é tratada como vaga.
- **Benchmarks são linhas reais do field.** P5 é o atleta que chegou em 5º, não uma mediana sintética, então a soma dos splits bate com o total e a decomposição do gap é exata.
- **Métricas relativas antes de tempo absoluto.** Percentil, gap para P5/última vaga e força do field são comparáveis entre edições; o tempo absoluto depende de percurso e clima.
- **Oportunidades realistas.** O potencial de cada modalidade é `min(gap para quem terminou 2–10% à frente, ganho treinável até a prova-alvo × tendência histórica)`. Não é a distância para o P1.

## Arquitetura

```
race-intelligence/
  prisma/schema.prisma        # schema-alvo (Athletes, Activities, Workouts, Races, RaceResults,
                              # RaceSplits, Competitors, Benchmarks, TrainingMetrics,
                              # PerformanceMetrics, Goals)
  src/
    proxy.ts                  # checagem de sessão (Next 16: middleware → proxy)
    lib/
      domain/                 # tipos, tempo/pace, distâncias e categoria por idade
      analytics/              # FUNÇÕES PURAS, testadas
        race.ts               #   field, benchmarks, gap, ranks após cada perna
        simulator.ts          #   what-if + modelo de potência calibrável
        opportunities.ts      #   time gain opportunities
        field-strength.ts     #   Race Strength Index
        head-to-head.ts
        training.ts           #   TSS, PMC, volume, zonas, consistência, PBs, janela pré-prova
        streams.ts            #   NP, melhores médias, desacoplamento, zonas
        insights.ts           #   composição para telas, relatório e analyst
      data/
        store.ts              # persistência (JSON hoje; trocar por Postgres)
        repository.ts         # único ponto de leitura; mescla real + exemplo com sinalização
        mock/                 # gerador determinístico de exemplo
      integrations/
        strava/               # OAuth + API v3 + mapper (testado)
        results/              # parsers HTML/CSV/JSON + fetch por URL
        files/                # GPX/TCX (FIT: interface pronta)
      ai/                     # contexto factual, analista local, Claude
    app/                      # páginas (App Router) e server actions
```

Para trocar mocks por dados reais, nenhuma tela muda: tudo passa por `getDataset()`. Strava, arquivos e resultados importados já gravam no store, e os exemplos saem com um clique.

## Próximos passos sugeridos

1. Persistência em Postgres com o `schema.prisma`, tokens do Strava criptografados e webhook do Strava para sync automático.
2. Decoder FIT e curvas de potência/pace a partir dos streams (hoje os best efforts vêm do Strava ou da média da atividade).
3. Adaptadores específicos de resultados (IRONMAN/Athlinks carregam via JavaScript; hoje o caminho é colar a tabela).
4. Plano de treino (Workouts) para aderência real planejado × executado.

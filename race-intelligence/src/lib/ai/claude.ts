/**
 * AI Performance Analyst com Claude. Recebe o snapshot factual do dashboard
 * e responde em streaming. Sem ANTHROPIC_API_KEY, o app usa o analista local.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { AnalystContext } from './context';

export const claudeConfigured = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

export const ANALYST_MODEL = process.env.ANALYST_MODEL ?? 'claude-opus-5';

const SYSTEM = `Você é o analista de performance de um triatleta amador competitivo (categoria por idade) que busca vaga no Mundial IRONMAN / IRONMAN 70.3.

Como responder:
- Use SOMENTE os dados do snapshot JSON abaixo. Se um número não está lá, diga que não tem o dado — não estime silenciosamente.
- Diferencie sempre: resultado esportivo (fato), estimativa (índice de força do field, gap estimado, modelo de potência) e informação oficial de slot allocation. Nunca trate posição como vaga garantida.
- Se o snapshot indicar dados de EXEMPLO, mencione isso uma vez, curto.
- Responda em português do Brasil, direto, como um treinador/analista de alto nível falando com um executivo-atleta: números primeiro, depois a leitura e a recomendação prática. Sem frases motivacionais genéricas.
- Tempos em h:mm:ss / m:ss, paces em min/km e min/100m, bike em km/h ou W.
- Comparações entre provas diferentes: priorize métricas relativas (percentil, gap para P5/último classificado, força do field) sobre tempo absoluto, e cite clima/percurso quando relevante.
- Quando fizer sentido, feche com "Foco:" em 1–3 linhas acionáveis.
- Use markdown simples (listas, tabelas curtas).`;

export function streamAnalyst(context: AnalystContext, messages: Anthropic.Beta.BetaMessageParam[]) {
  const client = new Anthropic();
  return client.beta.messages.stream({
    model: ANALYST_MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium' },
    // Recuperação no servidor caso o modelo recuse a requisição.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: [
      { type: 'text', text: SYSTEM },
      // Snapshot estável por sessão → cacheável entre perguntas.
      { type: 'text', text: `SNAPSHOT DO DASHBOARD (JSON):\n${JSON.stringify(context)}`, cache_control: { type: 'ephemeral' } },
    ],
    messages,
  });
}

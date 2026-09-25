/**
 * Race Strength Index (RSI) — força do field de uma edição, na categoria.
 *
 * SEMPRE uma estimativa. Componentes (quando os dados permitem):
 * - Velocidade do Top 10 vs um tempo de referência da distância (depende do
 *   percurso/clima — é o componente mais "sujo", por isso tem peso limitado).
 * - Profundidade: quão compacto é o Top 10 em relação ao P1 (fields fortes têm
 *   o Top 10 colado no vencedor).
 * - Tamanho da categoria.
 * - Histórico dos atletas: percentil médio que o Top 10 obteve em OUTRAS provas.
 * 100 = field "típico". >100 = mais forte.
 */
import type { RaceDistance, RaceResult } from '../domain/types';
import { mean, median } from './race';

/** Referência aproximada: mediana do Top 10 de categoria 45-49 masculina numa prova regional típica. */
export const REFERENCE_TOP10_S: Partial<Record<RaceDistance, number>> = {
  sprint: 1 * 3600 + 12 * 60,
  olympic: 2 * 3600 + 20 * 60,
  '70.3': 4 * 3600 + 52 * 60,
  full: 10 * 3600 + 25 * 60,
  half_marathon: 1 * 3600 + 32 * 60,
  marathon: 3 * 3600 + 20 * 60,
  run_10k: 41 * 60,
  run_5k: 20 * 60,
};

export interface FieldStrength {
  index: number;
  components: { label: string; value: number; weight: number; note: string }[];
  isEstimate: true;
  confidence: 'alta' | 'média' | 'baixa';
}

export function raceStrengthIndex(opts: {
  field: RaceResult[];
  distance: RaceDistance;
  /** Percentil médio que cada competidor obteve em outras provas (0 = sempre vence). */
  priorPercentileByCompetitor?: Map<string, number>;
}): FieldStrength | undefined {
  const { field, distance, priorPercentileByCompetitor } = opts;
  const n = field.length;
  if (n < 5) return undefined;
  const top10 = field.slice(0, Math.min(10, n));
  const top10Median = median(top10.map((r) => r.totalS));
  const ref = REFERENCE_TOP10_S[distance];

  const components: FieldStrength['components'] = [];

  if (ref) {
    const speed = 100 * (ref / top10Median);
    components.push({ label: 'Velocidade do Top 10', value: speed, weight: 0.35, note: 'vs referência da distância (sensível a percurso e clima)' });
  }

  const p1 = top10[0].totalS;
  const spread = (top10[top10.length - 1].totalS - p1) / p1; // ex.: 0.08 = 8%
  const depth = 100 * (1 + (0.1 - spread) * 2); // 10% de spread → 100
  components.push({ label: 'Profundidade do Top 10', value: depth, weight: 0.25, note: `P10 a ${(spread * 100).toFixed(1)}% do P1` });

  const size = 100 * (0.8 + 0.2 * (Math.log(n) / Math.log(120)));
  components.push({ label: 'Tamanho da categoria', value: size, weight: 0.15, note: `${n} finishers` });

  let withHistory = 0;
  if (priorPercentileByCompetitor) {
    const prior = top10.map((r) => priorPercentileByCompetitor.get(r.competitorId)).filter((x): x is number => x != null);
    withHistory = prior.length;
    if (prior.length >= 3) {
      const avg = mean(prior);
      components.push({ label: 'Histórico do Top 10', value: 100 * (1 + (0.25 - avg)), weight: 0.25, note: `${prior.length} atletas com provas anteriores (percentil médio ${(avg * 100).toFixed(0)}%)` });
    }
  }

  const wSum = components.reduce((a, c) => a + c.weight, 0);
  const index = components.reduce((a, c) => a + c.value * c.weight, 0) / wSum;
  const confidence: FieldStrength['confidence'] = withHistory >= 5 && n >= 40 ? 'alta' : n >= 20 ? 'média' : 'baixa';
  return { index: Math.round(index), components, isEstimate: true, confidence };
}

/**
 * Performance ajustada pela força do field: percentil "equivalente" num field típico.
 * P12 numa prova RSI 115 pode valer mais que P5 numa RSI 90.
 */
export function strengthAdjustedPercentile(percentile: number, rsi: number): number {
  // Cada 10 pontos de RSI ≈ 3 p.p. de percentil. Limitado para não inventar precisão.
  const adj = percentile - ((rsi - 100) / 10) * 0.03;
  return Math.min(Math.max(adj, 0.005), 1);
}

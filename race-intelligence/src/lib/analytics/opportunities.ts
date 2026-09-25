/**
 * Time Gain Opportunities — onde estão os minutos REALISTAS.
 *
 * Não usa só a distância para o vencedor. Para cada modalidade:
 * 1. Gap para o "próximo nível": mediana dos splits de quem terminou entre 2% e
 *    10% mais rápido que eu no mesmo field (atletas semelhantes, um degrau acima).
 * 2. Capacidade de ganho treinável até a prova-alvo (fração do split por bloco
 *    de 12 semanas, específica por modalidade).
 * 3. Ajuste pela minha tendência histórica naquela modalidade (percentil do
 *    split ao longo das provas): quem já vem evoluindo tende a seguir evoluindo.
 * Potencial = min(gap do próximo nível, capacidade × tendência).
 */
import type { RaceResult } from '../domain/types';
import { GAP_BUCKETS, type GapBucket, median, slope } from './race';

export interface Opportunity {
  bucket: GapBucket;
  potentialS: number;
  peerGapS: number;
  capacityS: number;
  trendFactor: number;
  /** Onde estou no field nessa modalidade (percentil do split). */
  splitPercentile: number;
  confidence: 'alta' | 'média' | 'baixa';
  rationale: string;
}

/** Fração do split que dá para ganhar por bloco de ~12 semanas bem executado. */
export const TRAINABLE_FRACTION_PER_12W: Record<GapBucket, number> = {
  swim: 0.03,
  bike: 0.035,
  run: 0.04,
  transitions: 0.2, // técnica pura: ensaio, equipamento, layout da T1/T2
};

const bucketTime = (r: RaceResult, b: GapBucket) =>
  b === 'transitions' ? r.splits.t1 + r.splits.t2 : r.splits[b];

export interface HistoryPoint {
  date: string;
  /** Percentil do meu split naquela prova (0 = melhor). */
  percentile: Record<GapBucket, number>;
}

/** Percentil do meu split em cada modalidade dentro do field. */
export function splitPercentiles(field: RaceResult[], me: RaceResult): Record<GapBucket, number> {
  const n = field.length;
  return Object.fromEntries(
    GAP_BUCKETS.map((b) => {
      const mine = bucketTime(me, b);
      const faster = field.filter((r) => bucketTime(r, b) < mine).length;
      return [b, n > 0 ? (faster + 1) / n : NaN];
    }),
  ) as Record<GapBucket, number>;
}

export function peerGroup(field: RaceResult[], me: RaceResult, lo = 0.02, hi = 0.1): RaceResult[] {
  let peers = field.filter((r) => !r.isMe && r.totalS <= me.totalS * (1 - lo) && r.totalS >= me.totalS * (1 - hi));
  if (peers.length < 3) {
    // Field pequeno: pega os 5 imediatamente à frente.
    const ahead = field.filter((r) => !r.isMe && r.totalS < me.totalS).sort((a, b) => b.totalS - a.totalS);
    peers = ahead.slice(0, 5);
  }
  return peers;
}

export function timeGainOpportunities(opts: {
  field: RaceResult[];
  me: RaceResult;
  weeksToTarget: number;
  history: HistoryPoint[];
}): { items: Opportunity[]; totalS: number; peerCount: number } {
  const { field, me, weeksToTarget, history } = opts;
  const peers = peerGroup(field, me);
  const pct = splitPercentiles(field, me);
  const blocks = Math.min(Math.max(weeksToTarget / 12, 0.25), 2);

  const items = GAP_BUCKETS.map((b): Opportunity => {
    const mine = bucketTime(me, b);
    const peerMedian = median(peers.map((p) => bucketTime(p, b)));
    const peerGapS = Number.isFinite(peerMedian) ? Math.max(0, mine - peerMedian) : 0;
    const capacityS = mine * TRAINABLE_FRACTION_PER_12W[b] * blocks;

    // Tendência: inclinação do percentil por ano (negativo = melhorando).
    const pts = history
      .filter((h) => Number.isFinite(h.percentile[b]))
      .map((h) => ({ x: new Date(h.date).getTime() / (365 * 86_400_000), y: h.percentile[b] }));
    const s = slope(pts);
    const trendFactor = pts.length >= 3 ? Math.min(Math.max(1 - s, 0.7), 1.3) : 1;

    const potentialS = Math.round(Math.min(peerGapS, capacityS * trendFactor));
    const confidence: Opportunity['confidence'] =
      peers.length >= 5 && pts.length >= 3 ? 'alta' : peers.length >= 3 ? 'média' : 'baixa';

    let rationale: string;
    if (peerGapS === 0) {
      rationale = 'Já no nível de quem terminou um degrau acima — manter, não é aqui que estão os minutos.';
    } else if (potentialS < peerGapS) {
      rationale = `Gap de ${Math.round(peerGapS / 60)} min para o próximo nível, mas o ganho treinável até a prova-alvo é menor — parte disso é projeto de mais de um ciclo.`;
    } else {
      rationale = 'Gap inteiro para o próximo nível cabe no tempo de preparação disponível.';
    }
    if (trendFactor > 1.05) rationale += ' Tendência histórica positiva nessa modalidade.';
    if (trendFactor < 0.95) rationale += ' Atenção: percentil piorando nas últimas provas.';

    return { bucket: b, potentialS, peerGapS, capacityS, trendFactor, splitPercentile: pct[b], confidence, rationale };
  }).sort((a, b) => b.potentialS - a.potentialS);

  return { items, totalS: items.reduce((a, x) => a + x.potentialS, 0), peerCount: peers.length };
}

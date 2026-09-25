/**
 * Análise de uma edição de prova: field da categoria, benchmarks, gaps,
 * percentil e posições após cada modalidade. Funções puras.
 */
import type { Benchmark, BenchmarkKey, RaceResult, SlotAllocation, SplitKey, Splits } from '../domain/types';
import { SPLIT_KEYS } from '../domain/types';

export type GapBucket = 'swim' | 'bike' | 'run' | 'transitions';
export const GAP_BUCKETS: GapBucket[] = ['swim', 'bike', 'run', 'transitions'];
export const BUCKET_LABEL: Record<GapBucket, string> = {
  swim: 'Swim',
  bike: 'Bike',
  run: 'Run',
  transitions: 'Transições',
};

export const BENCHMARK_LABEL: Record<BenchmarkKey, string> = {
  P1: 'P1',
  P3: 'P3',
  P5: 'P5',
  P10: 'P10',
  P20: 'P20',
  TOP10PCT: 'Top 10%',
  TOP20PCT: 'Top 20%',
  MEDIAN: 'Mediana',
  LAST_SLOT: 'Última vaga',
};

export const BENCHMARK_KEYS: BenchmarkKey[] = ['P1', 'P3', 'P5', 'P10', 'P20', 'TOP10PCT', 'TOP20PCT', 'MEDIAN', 'LAST_SLOT'];

export const sumSplits = (s: Splits) => s.swim + s.t1 + s.bike + s.t2 + s.run;

/** Finishers da categoria ordenados por tempo, com categoryRank garantido. */
export function categoryField(results: RaceResult[], category: string): RaceResult[] {
  return results
    .filter((r) => r.category === category && r.status === 'finisher' && Number.isFinite(r.totalS))
    .sort((a, b) => a.totalS - b.totalS)
    .map((r, i) => ({ ...r, categoryRank: i + 1 }));
}

export function findMe(field: RaceResult[]): RaceResult | undefined {
  return field.find((r) => r.isMe);
}

/** "Top 13%" → rank/n. Retorna fração (0.13). */
export const percentileOf = (rank: number, n: number) => (n > 0 ? rank / n : NaN);

function rowAsBenchmark(key: BenchmarkKey, row: RaceResult, label?: string): Benchmark {
  return {
    key,
    label: label ?? BENCHMARK_LABEL[key],
    rank: row.categoryRank,
    splits: row.splits,
    totalS: row.totalS,
    kind: 'actual',
    athleteName: row.athleteName,
  };
}

/**
 * Benchmark de uma chave. Usa sempre uma LINHA REAL do field (assim a soma dos
 * splits bate com o total e a decomposição do gap é exata). Para Top X% usa a
 * posição ceil(n·X). Retorna undefined quando não aplicável (ex.: P20 num field de 12).
 */
export function benchmarkFor(
  field: RaceResult[],
  key: BenchmarkKey,
  slots?: SlotAllocation,
): Benchmark | undefined {
  const n = field.length;
  if (n === 0) return undefined;
  const at = (rank: number) => field[Math.min(Math.max(rank, 1), n) - 1];
  switch (key) {
    case 'P1':
    case 'P3':
    case 'P5':
    case 'P10':
    case 'P20': {
      const rank = Number(key.slice(1));
      if (rank > n) return undefined;
      return rowAsBenchmark(key, at(rank));
    }
    case 'TOP10PCT':
      return rowAsBenchmark(key, at(Math.max(1, Math.ceil(n * 0.1))));
    case 'TOP20PCT':
      return rowAsBenchmark(key, at(Math.max(1, Math.ceil(n * 0.2))));
    case 'MEDIAN':
      return rowAsBenchmark(key, at(Math.ceil(n / 2)));
    case 'LAST_SLOT': {
      if (!slots?.lastQualifierRank) return undefined;
      const row = at(slots.lastQualifierRank);
      const label = slots.provenance === 'official' ? 'Última vaga (oficial)' : 'Última vaga (estimada)';
      return rowAsBenchmark(key, row, label);
    }
  }
}

export function allBenchmarks(field: RaceResult[], slots?: SlotAllocation): Benchmark[] {
  return BENCHMARK_KEYS.map((k) => benchmarkFor(field, k, slots)).filter((b): b is Benchmark => !!b);
}

export interface GapBreakdown {
  totalS: number;
  bySplit: Record<SplitKey, number>;
  byBucket: Record<GapBucket, number>;
  /** Modalidade com maior perda (só gaps positivos contam). */
  biggest?: { bucket: GapBucket; seconds: number; share: number };
  /** Perda relativa (%) por modalidade vs o split do benchmark. */
  relative: Record<GapBucket, number>;
}

/** Gap positivo = eu fui mais lento que o benchmark. */
export function gapBreakdown(mine: Splits, bench: Splits): GapBreakdown {
  const bySplit = Object.fromEntries(SPLIT_KEYS.map((k) => [k, mine[k] - bench[k]])) as Record<SplitKey, number>;
  const byBucket: Record<GapBucket, number> = {
    swim: bySplit.swim,
    bike: bySplit.bike,
    run: bySplit.run,
    transitions: bySplit.t1 + bySplit.t2,
  };
  const benchBucket: Record<GapBucket, number> = {
    swim: bench.swim,
    bike: bench.bike,
    run: bench.run,
    transitions: bench.t1 + bench.t2,
  };
  const relative = Object.fromEntries(
    GAP_BUCKETS.map((b) => [b, benchBucket[b] > 0 ? byBucket[b] / benchBucket[b] : 0]),
  ) as Record<GapBucket, number>;
  const totalS = SPLIT_KEYS.reduce((acc, k) => acc + bySplit[k], 0);
  const losses = GAP_BUCKETS.map((b) => ({ bucket: b, seconds: byBucket[b] })).filter((x) => x.seconds > 0);
  const lossSum = losses.reduce((a, x) => a + x.seconds, 0);
  const top = losses.sort((a, b) => b.seconds - a.seconds)[0];
  return {
    totalS,
    bySplit,
    byBucket,
    relative,
    biggest: top ? { ...top, share: lossSum > 0 ? top.seconds / lossSum : 0 } : undefined,
  };
}

/** Posição na categoria ao fim de cada modalidade (acumulado). */
export function ranksAfterEachLeg(field: RaceResult[], id: string) {
  const cum = (r: RaceResult) => ({
    swim: r.splits.swim,
    bike: r.splits.swim + r.splits.t1 + r.splits.bike,
    run: r.totalS,
  });
  const me = field.find((r) => r.id === id);
  if (!me) return undefined;
  const mine = cum(me);
  const rankFor = (leg: 'swim' | 'bike' | 'run') => 1 + field.filter((r) => cum(r)[leg] < mine[leg]).length;
  return { swim: rankFor('swim'), bike: rankFor('bike'), run: rankFor('run') };
}

/** Rank de cada split isolado (quem nadou mais rápido etc.). */
export function splitRanks(field: RaceResult[], id: string): Record<SplitKey, number> | undefined {
  const me = field.find((r) => r.id === id);
  if (!me) return undefined;
  return Object.fromEntries(
    SPLIT_KEYS.map((k) => [k, 1 + field.filter((r) => r.splits[k] < me.splits[k]).length]),
  ) as Record<SplitKey, number>;
}

export function median(xs: number[]): number {
  const v = xs.filter(Number.isFinite).sort((a, b) => a - b);
  if (v.length === 0) return NaN;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export function mean(xs: number[]): number {
  const v = xs.filter(Number.isFinite);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN;
}

export function stdev(xs: number[]): number {
  const v = xs.filter(Number.isFinite);
  if (v.length < 2) return 0;
  const m = mean(v);
  return Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / (v.length - 1));
}

/** Inclinação da regressão linear simples (y por unidade de x). */
export function slope(points: { x: number; y: number }[]): number {
  const p = points.filter((q) => Number.isFinite(q.x) && Number.isFinite(q.y));
  if (p.length < 2) return 0;
  const mx = mean(p.map((q) => q.x));
  const my = mean(p.map((q) => q.y));
  const num = p.reduce((a, q) => a + (q.x - mx) * (q.y - my), 0);
  const den = p.reduce((a, q) => a + (q.x - mx) ** 2, 0);
  return den === 0 ? 0 : num / den;
}

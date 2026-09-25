import { describe, expect, it } from 'vitest';
import type { RaceResult, Splits } from '../domain/types';
import { benchmarkFor, categoryField, gapBreakdown, percentileOf, ranksAfterEachLeg } from '../analytics/race';
import { calibrateModel, placeInField, powerForSpeed, simulateSplits, speedForPower } from '../analytics/simulator';
import { timeGainOpportunities } from '../analytics/opportunities';
import { raceStrengthIndex } from '../analytics/field-strength';
import { headToHead } from '../analytics/head-to-head';

const sum = (s: Splits) => s.swim + s.t1 + s.bike + s.t2 + s.run;
function row(i: number, s: Splits, extra: Partial<RaceResult> = {}): RaceResult {
  return { id: `r${i}`, raceId: 'race', competitorId: `c${i}`, athleteName: `A${i}`, category: 'M45-49', sex: 'M', splits: s, totalS: sum(s), status: 'finisher', ...extra };
}
// Field de 20: atleta i é 60s mais lento por modalidade que o i-1.
const field: RaceResult[] = Array.from({ length: 20 }, (_, i) =>
  row(i, { swim: 1800 + i * 20, t1: 150 + i * 2, bike: 8000 + i * 30, t2: 100 + i, run: 5000 + i * 40 }),
);
const me = row(99, { swim: 1800 + 12 * 20, t1: 150, bike: 8000 + 5 * 30, t2: 100, run: 5000 + 14 * 40 }, { isMe: true, competitorId: 'me' });

describe('análise da categoria', () => {
  const f = categoryField([...field, me, row(50, field[0].splits, { category: 'M40-44' }), row(51, field[0].splits, { status: 'dnf' })], 'M45-49');

  it('filtra categoria/finishers e atribui ranks', () => {
    expect(f).toHaveLength(21);
    expect(f[0].categoryRank).toBe(1);
    expect(f.find((r) => r.isMe)!.categoryRank).toBeGreaterThan(1);
  });

  it('benchmarks usam linhas reais; P20 some em field pequeno', () => {
    const p5 = benchmarkFor(f, 'P5')!;
    expect(p5.rank).toBe(5);
    expect(p5.totalS).toBe(f[4].totalS);
    expect(benchmarkFor(f.slice(0, 10), 'P20')).toBeUndefined();
    expect(benchmarkFor(f, 'TOP10PCT')!.rank).toBe(3); // ceil(21 × 0,1)
    expect(benchmarkFor(f, 'LAST_SLOT')).toBeUndefined();
    expect(benchmarkFor(f, 'LAST_SLOT', { championship: 'IRONMAN 70.3 World Championship', lastQualifierRank: 4, provenance: 'official' })!.rank).toBe(4);
  });

  it('decomposição do gap soma o total e acha a maior perda', () => {
    const g = gapBreakdown(me.splits, f[0].splits);
    expect(g.totalS).toBe(me.totalS - f[0].totalS);
    expect(g.byBucket.swim + g.byBucket.bike + g.byBucket.run + g.byBucket.transitions).toBe(g.totalS);
    expect(g.biggest?.bucket).toBe('run');
  });

  it('percentil e posição após cada modalidade', () => {
    expect(percentileOf(28, 210)).toBeCloseTo(0.133, 3);
    const meRow = f.find((r) => r.isMe)!;
    const r = ranksAfterEachLeg(f, meRow.id)!;
    expect(r.run).toBe(meRow.categoryRank);
    expect(r.swim).toBeGreaterThanOrEqual(1);
  });

  it('oportunidades são limitadas pelo gap do próximo nível e pela capacidade', () => {
    const meRow = f.find((r) => r.isMe)!;
    const o = timeGainOpportunities({ field: f, me: meRow, weeksToTarget: 12, history: [] });
    for (const it of o.items) expect(it.potentialS).toBeLessThanOrEqual(Math.max(it.peerGapS, 0) + 1e-9);
    expect(o.totalS).toBe(o.items.reduce((a, x) => a + x.potentialS, 0));
    const longer = timeGainOpportunities({ field: f, me: meRow, weeksToTarget: 24, history: [] });
    expect(longer.totalS).toBeGreaterThanOrEqual(o.totalS);
  });

  it('índice de força do field é estimativa e responde a fields mais rápidos', () => {
    const slow = raceStrengthIndex({ field: f, distance: '70.3' })!;
    const fast = raceStrengthIndex({ field: f.map((r) => ({ ...r, totalS: r.totalS * 0.9 })), distance: '70.3' })!;
    expect(slow.isEstimate).toBe(true);
    expect(fast.index).toBeGreaterThan(slow.index);
  });
});

describe('simulador', () => {
  const course = { swimM: 1900, bikeM: 90000, runM: 21097 };

  it('reproduz splits a partir de paces', () => {
    const s = simulateSplits({ swimPaceSecPer100: 112, bikeSpeedKmh: 38, t1S: 180, t2S: 120, runPaceSecPerKm: 265 }, course);
    expect(s.swim).toBeCloseTo(2128, 0);
    expect(s.bike).toBeCloseTo(8526.3, 0);
    expect(s.run).toBeCloseTo(5590.7, 0);
  });

  it('modelo de potência é monotônico e inversível', () => {
    const v = speedForPower(220);
    expect(powerForSpeed(v / 3.6)).toBeCloseTo(220, 0);
    expect(speedForPower(250)).toBeGreaterThan(v);
  });

  it('calibração reproduz a velocidade real com a potência real', () => {
    const m = calibrateModel(36.4, 212);
    expect(speedForPower(212, m)).toBeCloseTo(36.4, 1);
  });

  it('posiciona no field removendo o próprio atleta', () => {
    const f = [...field, me];
    const faster = { ...field[2].splits, run: field[2].splits.run - 10 };
    const p = placeInField(faster, f);
    expect(p.fieldSize).toBe(21);
    expect(p.rank).toBe(3);
    expect(p.ahead?.id).toBe('r1');
  });
});

describe('head-to-head', () => {
  it('conta vitórias e gap médio por modalidade', () => {
    const races = [
      { id: 'a', date: '2025-01-01' },
      { id: 'b', date: '2026-01-01' },
    ] as never[];
    const mk = (raceId: string, s: Splits, isMe: boolean) => ({ ...row(0, s), id: `${raceId}${isMe}`, raceId, competitorId: isMe ? 'me' : 'x', isMe });
    const base = { swim: 2000, t1: 200, bike: 9000, t2: 120, run: 6000 };
    const results = [
      mk('a', base, true),
      mk('a', { ...base, run: 5800 }, false),
      mk('b', { ...base, run: 5700 }, true),
      mk('b', { ...base, run: 5800 }, false),
    ];
    const h = headToHead(races, results, 'x');
    expect(h.races).toHaveLength(2);
    expect(h.wins).toBe(1);
    expect(h.losses).toBe(1);
    expect(h.avgGap.run).toBe(50);
    expect(h.gapTrendSPerYear).toBeLessThan(0);
  });
});

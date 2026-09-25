/** Confrontos diretos entre o atleta e um competidor, em todas as provas em comum. */
import type { Race, RaceResult } from '../domain/types';
import { GAP_BUCKETS, type GapBucket, gapBreakdown, mean, slope } from './race';

export interface H2HRace {
  race: Race;
  me: RaceResult;
  them: RaceResult;
  /** Positivo = eu fui mais lento. */
  gap: Record<GapBucket | 'total', number>;
}

export interface H2HSummary {
  races: H2HRace[];
  wins: number;
  losses: number;
  avgGap: Record<GapBucket | 'total', number>;
  /** Variação do gap total por ano (negativo = estou fechando o gap). */
  gapTrendSPerYear: number;
  whereIWin: GapBucket[];
  whereILose: GapBucket[];
}

export function headToHead(races: Race[], results: RaceResult[], competitorId: string): H2HSummary {
  const byRace = new Map<string, RaceResult[]>();
  for (const r of results) {
    const list = byRace.get(r.raceId) ?? [];
    list.push(r);
    byRace.set(r.raceId, list);
  }
  const out: H2HRace[] = [];
  for (const race of [...races].sort((a, b) => a.date.localeCompare(b.date))) {
    const rows = byRace.get(race.id) ?? [];
    const me = rows.find((r) => r.isMe && r.status === 'finisher');
    const them = rows.find((r) => r.competitorId === competitorId && r.status === 'finisher');
    if (!me || !them) continue;
    const g = gapBreakdown(me.splits, them.splits);
    out.push({ race, me, them, gap: { ...g.byBucket, total: me.totalS - them.totalS } });
  }
  const keys = [...GAP_BUCKETS, 'total'] as const;
  const avgGap = Object.fromEntries(keys.map((k) => [k, mean(out.map((x) => x.gap[k]))])) as H2HSummary['avgGap'];
  const trend = slope(out.map((x) => ({ x: new Date(x.race.date).getTime() / (365 * 86_400_000), y: x.gap.total })));
  return {
    races: out,
    wins: out.filter((x) => x.gap.total < 0).length,
    losses: out.filter((x) => x.gap.total > 0).length,
    avgGap,
    gapTrendSPerYear: trend,
    whereIWin: GAP_BUCKETS.filter((b) => avgGap[b] < -5),
    whereILose: GAP_BUCKETS.filter((b) => avgGap[b] > 5),
  };
}

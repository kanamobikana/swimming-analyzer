/**
 * Insights: combina dados + analytics em respostas prontas para as telas,
 * o relatório pós-prova e o AI Analyst. Tudo aqui é determinístico.
 */
import type { Benchmark, BenchmarkKey, Race, RaceResult } from '../domain/types';
import type { Dataset } from '../data/repository';
import { resultsForRace } from '../data/repository';
import { addDays, daysBetween, paceSecPer100m, paceSecPerKm, speedKmh } from '../domain/time';
import { ageGroupFor, isTriathlon } from '../domain/race-meta';
import {
  BUCKET_LABEL,
  GAP_BUCKETS,
  type GapBreakdown,
  type GapBucket,
  allBenchmarks,
  benchmarkFor,
  categoryField,
  gapBreakdown,
  mean,
  percentileOf,
  ranksAfterEachLeg,
  splitRanks,
} from './race';
import { type FieldStrength, raceStrengthIndex, strengthAdjustedPercentile } from './field-strength';
import { type HistoryPoint, splitPercentiles, timeGainOpportunities } from './opportunities';
import {
  bestPower,
  bestRun,
  bestSwim,
  consistencyScore,
  inRange,
  intensityDistribution,
  performanceManagement,
  preRaceWindow,
  type PreRaceWindow,
  volumeSummary,
} from './training';

// ───────────────────────── Carga (PMC) com cache por dataset ─────────────────────────

const pmcCache = new WeakMap<Dataset, ReturnType<typeof performanceManagement>>();
export function pmcFor(ds: Dataset) {
  let p = pmcCache.get(ds);
  if (!p) {
    const first = ds.activities[0]?.date.slice(0, 10) ?? addDays(ds.today, -365);
    // Semente ~CTL de quem já treinava antes do início dos dados.
    p = performanceManagement(ds.activities, ds.athlete, first, ds.today, { ctl: 55, atl: 55 });
    pmcCache.set(ds, p);
  }
  return p;
}

// ───────────────────────── Análise de uma prova ─────────────────────────

export interface RaceAnalysis {
  race: Race;
  field: RaceResult[];
  me?: RaceResult;
  n: number;
  rank?: number;
  percentile?: number;
  benchmarks: Benchmark[];
  selected?: Benchmark;
  gap?: GapBreakdown;
  gapsByKey: Partial<Record<BenchmarkKey, GapBreakdown>>;
  splitRanks?: ReturnType<typeof splitRanks>;
  ranksAfter?: ReturnType<typeof ranksAfterEachLeg>;
  strength?: FieldStrength;
  adjustedPercentile?: number;
  opportunities?: ReturnType<typeof timeGainOpportunities>;
  windows?: PreRaceWindow[];
  pace?: { swim100: number; bikeKmh: number; runKm: number };
}

/** Percentil médio de cada competidor em provas OTHER que a atual (para o RSI). */
function priorPercentiles(ds: Dataset, exceptRaceId: string): Map<string, number> {
  const acc = new Map<string, number[]>();
  for (const race of ds.races) {
    if (race.id === exceptRaceId) continue;
    const field = categoryField(resultsForRace(ds, race.id), race.category);
    field.forEach((r) => {
      const list = acc.get(r.competitorId) ?? [];
      list.push(percentileOf(r.categoryRank!, field.length));
      acc.set(r.competitorId, list);
    });
  }
  return new Map([...acc.entries()].map(([k, v]) => [k, mean(v)]));
}

export function analyzeRace(ds: Dataset, raceId: string, benchmarkKey: BenchmarkKey = 'P5', opts: { deep?: boolean } = {}): RaceAnalysis | undefined {
  const race = ds.races.find((r) => r.id === raceId);
  if (!race) return undefined;
  const field = categoryField(resultsForRace(ds, raceId), race.category);
  const me = field.find((r) => r.isMe);
  const benchmarks = allBenchmarks(field, race.slots);
  const selected = benchmarkFor(field, benchmarkKey, race.slots) ?? benchmarkFor(field, 'P5', race.slots) ?? benchmarks[0];
  const gapsByKey: RaceAnalysis['gapsByKey'] = {};
  if (me) for (const b of benchmarks) gapsByKey[b.key] = gapBreakdown(me.splits, b.splits);
  const strength = raceStrengthIndex({ field, distance: race.distance, priorPercentileByCompetitor: priorPercentiles(ds, raceId) });
  const percentile = me ? percentileOf(me.categoryRank!, field.length) : undefined;

  const analysis: RaceAnalysis = {
    race,
    field,
    me,
    n: field.length,
    rank: me?.categoryRank,
    percentile,
    benchmarks,
    selected,
    gap: me && selected ? gapBreakdown(me.splits, selected.splits) : undefined,
    gapsByKey,
    splitRanks: me ? splitRanks(field, me.id) : undefined,
    ranksAfter: me ? ranksAfterEachLeg(field, me.id) : undefined,
    strength,
    adjustedPercentile: percentile != null && strength ? strengthAdjustedPercentile(percentile, strength.index) : undefined,
    pace: me
      ? {
          swim100: paceSecPer100m(me.splits.swim, race.course.swimM),
          bikeKmh: speedKmh(me.splits.bike, race.course.bikeM),
          runKm: paceSecPerKm(me.splits.run, race.course.runM),
        }
      : undefined,
  };

  if (opts.deep && me) {
    if (isTriathlon(race.distance)) {
      analysis.opportunities = timeGainOpportunities({
        field,
        me,
        weeksToTarget: Math.max(daysBetween(ds.today, ds.athlete.targetRaceDate) / 7, 0),
        history: disciplineHistory(ds).filter((h) => h.date <= race.date),
      });
    }
    const pmc = pmcFor(ds);
    analysis.windows = [30, 60, 90].map((d) => preRaceWindow(ds.activities, ds.athlete, race.date, d, pmc));
  }
  return analysis;
}

/** Percentil dos meus splits em cada triathlon (para tendência por modalidade). */
export function disciplineHistory(ds: Dataset): HistoryPoint[] {
  const out: HistoryPoint[] = [];
  for (const race of ds.races) {
    if (!isTriathlon(race.distance) || race.date > ds.today) continue;
    const field = categoryField(resultsForRace(ds, race.id), race.category);
    const me = field.find((r) => r.isMe);
    if (!me) continue;
    out.push({ date: race.date, percentile: splitPercentiles(field, me) });
  }
  return out;
}

// ───────────────────────── Road to Worlds ─────────────────────────

export interface QualificationStatus {
  /** Prova usada como referência de classificação. */
  referenceRace?: Race;
  me?: RaceResult;
  benchmark?: Benchmark;
  gap?: GapBreakdown;
  provenance: 'official' | 'estimate' | 'none';
  explanation: string;
  /** Todas as provas com informação de vagas. */
  rows: {
    race: Race;
    myRank?: number;
    n: number;
    categorySlots?: number;
    lastQualifierRank?: number;
    lastQualifierTimeS?: number;
    gapS?: number;
    provenance: 'official' | 'estimate';
    sportingResult: string;
  }[];
}

export function qualificationStatus(ds: Dataset): QualificationStatus {
  const target = ds.athlete.targetRaceDistance;
  const rows: QualificationStatus['rows'] = [];
  for (const race of ds.races) {
    if (!race.slots || race.date > ds.today) continue;
    const field = categoryField(resultsForRace(ds, race.id), race.category);
    const me = field.find((r) => r.isMe);
    const q = race.slots.lastQualifierRank ? field[race.slots.lastQualifierRank - 1] : undefined;
    rows.push({
      race,
      myRank: me?.categoryRank,
      n: field.length,
      categorySlots: race.slots.categorySlots,
      lastQualifierRank: race.slots.lastQualifierRank,
      lastQualifierTimeS: q?.totalS,
      gapS: me && q ? me.totalS - q.totalS : undefined,
      provenance: race.slots.provenance,
      sportingResult: me ? `P${me.categoryRank}/${field.length}` : '—',
    });
  }
  rows.sort((a, b) => b.race.date.localeCompare(a.race.date));
  // Referência: prova mais recente da distância-alvo, preferindo dado oficial.
  const sameDistance = rows.filter((r) => r.race.distance === target && r.gapS != null);
  const ref = sameDistance.find((r) => r.provenance === 'official') ?? sameDistance[0];
  if (!ref) {
    return { provenance: 'none', explanation: 'Nenhuma prova da distância-alvo com informação de vagas ainda. Cadastre as vagas da prova para calcular o gap.', rows };
  }
  const a = analyzeRace(ds, ref.race.id, 'LAST_SLOT')!;
  return {
    referenceRace: ref.race,
    me: a.me,
    benchmark: a.selected,
    gap: a.gap,
    provenance: ref.provenance,
    explanation:
      ref.provenance === 'official'
        ? `Benchmark = tempo do último atleta que recebeu vaga (incluindo rolldown) na ${ref.race.name}, segundo a lista oficial.`
        : `Benchmark ESTIMADO: posição provável da última vaga na ${ref.race.name}. Não é informação oficial de slot allocation.`,
    rows,
  };
}

// ───────────────────────── Home / KPIs ─────────────────────────

export interface Kpi {
  key: string;
  label: string;
  value: number;
  previous?: number;
  format: 'watts' | 'wkg' | 'number' | 'pace_km' | 'pace_100' | 'hours' | 'score' | 'percent' | 'duration' | 'gap';
  /** true = número menor é melhor (paces, tempos, gaps, percentil). */
  lowerIsBetter?: boolean;
  note?: string;
  estimate?: boolean;
}

function prevSnapshot<K extends keyof Dataset['athlete']['history'][number]>(ds: Dataset, key: K) {
  const h = ds.athlete.history.filter((x) => x[key] != null);
  return h.length >= 2 ? (h[h.length - 2][key] as number) : undefined;
}

export function triathlonResults(ds: Dataset, distance?: Race['distance']) {
  return ds.races
    .filter((r) => r.date <= ds.today && isTriathlon(r.distance) && (!distance || r.distance === distance))
    .map((race) => ({ race, a: analyzeRace(ds, race.id)! }))
    .filter((x) => x.a.me);
}

export function kpis(ds: Dataset): Kpi[] {
  const { athlete } = ds;
  const last28 = volumeSummary(inRange(ds.activities, addDays(ds.today, -27), ds.today), athlete).hours / 4;
  const prev28 = volumeSummary(inRange(ds.activities, addDays(ds.today, -55), addDays(ds.today, -28)), athlete).hours / 4;
  const monthStart = addDays(ds.today, -29);
  const cons = consistencyScore(ds.activities, athlete, monthStart, ds.today).score;
  const consPrev = consistencyScore(ds.activities, athlete, addDays(monthStart, -30), addDays(monthStart, -1)).score;
  const tri = triathlonResults(ds);
  const last = tri[tri.length - 1];
  const prev = tri[tri.length - 2];
  const halfs = triathlonResults(ds, '70.3');
  const best703 = [...halfs].sort((x, y) => x.a.me!.totalS - y.a.me!.totalS)[0];
  const secondBest703 = [...halfs].sort((x, y) => x.a.me!.totalS - y.a.me!.totalS)[1];
  const bestSplit = (k: 'swim' | 'bike' | 'run') => {
    const sorted = [...halfs].sort((x, y) => x.a.me!.splits[k] - y.a.me!.splits[k]);
    return { best: sorted[0]?.a.me!.splits[k], second: sorted[1]?.a.me!.splits[k] };
  };
  const q = qualificationStatus(ds);
  const qRows = q.rows.filter((r) => r.race.distance === athlete.targetRaceDistance && r.gapS != null);
  const wkg = athlete.ftpW / athlete.weightKg;
  const prevFtp = prevSnapshot(ds, 'ftpW');
  const prevW = prevSnapshot(ds, 'weightKg');

  const out: Kpi[] = [
    { key: 'ftp', label: 'FTP', value: athlete.ftpW, previous: prevFtp, format: 'watts' },
    { key: 'wkg', label: 'W/kg', value: wkg, previous: prevFtp && prevW ? prevFtp / prevW : undefined, format: 'wkg' },
    { key: 'vo2', label: 'VO₂ Max', value: athlete.vo2max, previous: prevSnapshot(ds, 'vo2max'), format: 'number' },
    { key: 'thr', label: 'Limiar corrida', value: athlete.thresholdPaceSecPerKm, previous: prevSnapshot(ds, 'thresholdPaceSecPerKm'), format: 'pace_km', lowerIsBetter: true },
    { key: 'css', label: 'CSS', value: athlete.cssSecPer100m, previous: prevSnapshot(ds, 'cssSecPer100m'), format: 'pace_100', lowerIsBetter: true },
    { key: 'hours', label: 'Horas/semana', value: last28 * 3600, previous: prev28 * 3600, format: 'hours', note: 'média últimas 4 semanas' },
    { key: 'consistency', label: 'Consistência', value: cons, previous: consPrev, format: 'score', note: 'últimos 30 dias' },
  ];
  if (last) out.push({ key: 'pct', label: 'Percentil (última prova)', value: last.a.percentile!, previous: prev?.a.percentile, format: 'percent', lowerIsBetter: true, note: last.race.name });
  if (best703) out.push({ key: 'best703', label: 'Melhor 70.3', value: best703.a.me!.totalS, previous: secondBest703?.a.me!.totalS, format: 'duration', lowerIsBetter: true, note: best703.race.name });
  const bs = bestSplit('swim');
  const bb = bestSplit('bike');
  const br = bestSplit('run');
  if (bs.best) out.push({ key: 'bestSwim', label: 'Melhor swim (70.3)', value: bs.best, previous: bs.second, format: 'duration', lowerIsBetter: true });
  if (bb.best) out.push({ key: 'bestBike', label: 'Melhor bike (70.3)', value: bb.best, previous: bb.second, format: 'duration', lowerIsBetter: true });
  if (br.best) out.push({ key: 'bestRun', label: 'Melhor run (70.3)', value: br.best, previous: br.second, format: 'duration', lowerIsBetter: true });
  if (qRows[0]) out.push({ key: 'qgap', label: 'Qualification Gap', value: qRows[0].gapS!, previous: qRows[1]?.gapS, format: 'gap', lowerIsBetter: true, estimate: qRows[0].provenance === 'estimate', note: qRows[0].race.name });
  return out;
}

export interface Strongest {
  bucket: GapBucket;
  avgPercentile: number;
  all: Record<GapBucket, number>;
}

/** Modalidade mais forte = menor percentil médio do split nas últimas 3 provas de triathlon. */
export function strongestDiscipline(ds: Dataset): Strongest | undefined {
  const hist = disciplineHistory(ds).slice(-3);
  if (!hist.length) return undefined;
  const all = Object.fromEntries(GAP_BUCKETS.map((b) => [b, mean(hist.map((h) => h.percentile[b]))])) as Record<GapBucket, number>;
  const ranked = (['swim', 'bike', 'run'] as GapBucket[]).sort((a, b) => all[a] - all[b]);
  return { bucket: ranked[0], avgPercentile: all[ranked[0]], all };
}

export function latestKeyRace(ds: Dataset) {
  const halfs = triathlonResults(ds, ds.athlete.targetRaceDistance);
  const any = triathlonResults(ds);
  return halfs[halfs.length - 1] ?? any[any.length - 1];
}

export function trainingStatus(ds: Dataset) {
  const pmc = pmcFor(ds);
  const today = pmc[pmc.length - 1];
  return [7, 30, 90].map((days) => {
    const acts = inRange(ds.activities, addDays(ds.today, -(days - 1)), ds.today);
    const v = volumeSummary(acts, ds.athlete);
    return { days, ...v, weeklyHours: v.hours / (days / 7), intensity: intensityDistribution(acts) };
  }).map((x) => ({ ...x, ctl: today?.ctl, atl: today?.atl, tsb: today?.tsb }));
}

export interface PersonalBests {
  swim: { label: string; key: '400' | '1000' | '1900'; best?: ReturnType<typeof bestSwim> }[];
  run: { label: string; key: '5k' | '10k' | '21k' | '42k'; best?: ReturnType<typeof bestRun> }[];
  power: { label: string; key: '20m' | '60m'; best?: ReturnType<typeof bestPower> }[];
  ftp: number;
  races: { label: string; distance: Race['distance']; best?: { totalS: number; race: Race } }[];
}

export function personalBests(ds: Dataset): PersonalBests {
  const acts = ds.activities.filter((a) => a.completed !== false);
  const raceBest = (distance: Race['distance']) => {
    const list = triathlonResults(ds, distance);
    const b = [...list].sort((x, y) => x.a.me!.totalS - y.a.me!.totalS)[0];
    return b ? { totalS: b.a.me!.totalS, race: b.race } : undefined;
  };
  return {
    swim: [
      { label: '400 m', key: '400', best: bestSwim(acts, '400') },
      { label: '1.000 m', key: '1000', best: bestSwim(acts, '1000') },
      { label: '1.900 m', key: '1900', best: bestSwim(acts, '1900') },
    ],
    run: [
      { label: '5 km', key: '5k', best: bestRun(acts, '5k') },
      { label: '10 km', key: '10k', best: bestRun(acts, '10k') },
      { label: '21 km', key: '21k', best: bestRun(acts, '21k') },
      { label: '42 km', key: '42k', best: bestRun(acts, '42k') },
    ],
    power: [
      { label: '20 min', key: '20m', best: bestPower(acts, '20m') },
      { label: '60 min', key: '60m', best: bestPower(acts, '60m') },
    ],
    ftp: ds.athlete.ftpW,
    races: [
      { label: 'Sprint', distance: 'sprint', best: raceBest('sprint') },
      { label: 'Olímpico', distance: 'olympic', best: raceBest('olympic') },
      { label: '70.3', distance: '70.3', best: raceBest('70.3') },
      { label: 'Full IRONMAN', distance: 'full', best: raceBest('full') },
    ],
  };
}

/** Série mensal de 12 meses: CTL no fim do mês + percentil das provas no mês. */
export function performanceTrend(ds: Dataset) {
  const pmc = pmcFor(ds);
  const tri = triathlonResults(ds);
  const out: { month: string; ctl: number; racePercentile?: number; raceName?: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(ds.today + 'T12:00:00Z');
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - i);
    const month = d.toISOString().slice(0, 7);
    const points = pmc.filter((p) => p.date.startsWith(month));
    const race = tri.find((x) => x.race.date.startsWith(month));
    out.push({ month, ctl: points[points.length - 1]?.ctl ?? NaN, racePercentile: race?.a.percentile, raceName: race?.race.name });
  }
  return out;
}

export function monthlyConsistency(ds: Dataset, months = 12) {
  const out: { month: string; score: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(ds.today + 'T12:00:00Z');
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - i);
    const from = d.toISOString().slice(0, 10);
    const end = new Date(d);
    end.setUTCMonth(end.getUTCMonth() + 1);
    end.setUTCDate(0);
    const to = end.toISOString().slice(0, 10) > ds.today ? ds.today : end.toISOString().slice(0, 10);
    out.push({ month: from.slice(0, 7), score: consistencyScore(ds.activities, ds.athlete, from, to).score });
  }
  return out;
}

export function currentCategory(ds: Dataset) {
  const a = ds.athlete;
  const now = ageGroupFor(a.birthDate, ds.today, a.sex);
  let next = now;
  let year = Number(ds.today.slice(0, 4));
  while (next === now) {
    year++;
    next = ageGroupFor(a.birthDate, `${year}-06-30`, a.sex);
  }
  return { now, next, changesInYear: year, atTarget: ageGroupFor(a.birthDate, a.targetRaceDate, a.sex) };
}

// ───────────────────────── Relatório pós-prova ─────────────────────────

export interface RaceReport {
  headline: string;
  lostTime: string[];
  gainedTime: string[];
  biggestOpportunity?: string;
  trainingImplications: string[];
  nextRaceFocus: string[];
}

const fmtMin = (s: number) => {
  const m = Math.floor(Math.abs(s) / 60);
  const sec = Math.round(Math.abs(s) % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
};

export function raceReport(a: RaceAnalysis): RaceReport | undefined {
  if (!a.me) return undefined;
  const p5 = a.gapsByKey.P5 ?? a.gapsByKey.P3 ?? a.gapsByKey.P1;
  const med = a.gapsByKey.MEDIAN;
  const lost: string[] = [];
  const gained: string[] = [];
  if (p5) {
    for (const b of GAP_BUCKETS) {
      const g = p5.byBucket[b];
      if (g > 20) lost.push(`${BUCKET_LABEL[b]}: ${fmtMin(g)} atrás do ${a.gapsByKey.P5 ? 'P5' : 'benchmark'} (${(p5.relative[b] * 100).toFixed(1)}% mais lento)`);
      else if (g < -5) gained.push(`${BUCKET_LABEL[b]}: ${fmtMin(g)} mais rápido que o P5`);
    }
  }
  if (med) {
    for (const b of GAP_BUCKETS) {
      if (med.byBucket[b] < -60) gained.push(`${BUCKET_LABEL[b]}: ${fmtMin(med.byBucket[b])} à frente da mediana da categoria`);
    }
  }
  const sr = a.splitRanks;
  const ra = a.ranksAfter;
  if (ra) {
    if (ra.swim > ra.run + 10) gained.push(`Recuperou ${ra.swim - ra.run} posições entre a saída da água (P${ra.swim}) e a chegada (P${ra.run}).`);
    if (ra.bike < ra.run) lost.push(`Perdeu ${ra.run - ra.bike} posições na corrida (P${ra.bike} → P${ra.run}).`);
  }
  const opp = a.opportunities?.items[0];
  const implications: string[] = [];
  const focus: string[] = [];
  const w = a.windows?.find((x) => x.days === 60);
  if (w) {
    implications.push(`Preparação (8 semanas): ${w.avgWeeklyHours.toFixed(1).replace('.', ',')} h/semana, ${w.longRuns} longões, ${w.longRides} pedais longos, ${w.bricks} bricks${w.plannedCompliance != null ? `, ${Math.round(w.plannedCompliance * 100)}% das sessões planejadas` : ''}.`);
    if (w.intensity.moderate > 0.25) implications.push(`Muito volume em Z3 (${Math.round(w.intensity.moderate * 100)}%) — zona cinzenta. Polarizar mais: fácil mais fácil, duro mais duro.`);
    if (Number.isFinite(w.tsbAtRace)) implications.push(`Forma no dia (TSB): ${w.tsbAtRace > 0 ? '+' : ''}${w.tsbAtRace.toFixed(0)} — ${w.tsbAtRace < -5 ? 'chegou cansado; taper curto demais.' : w.tsbAtRace > 25 ? 'descansado demais; pode ter perdido fitness no taper.' : 'taper na faixa adequada.'}`);
  }
  if (opp && opp.potentialS > 0) {
    focus.push(`${BUCKET_LABEL[opp.bucket]}: buscar ${fmtMin(opp.potentialS)} até a prova-alvo.`);
    if (opp.bucket === 'run') focus.push('Durabilidade: longões com final em ritmo de prova e bricks longos após pedal forte.');
    if (opp.bucket === 'bike') focus.push('Bike: blocos de sweet spot/limiar e revisão de posição/aero (CdA) — é onde watts viram minutos mais barato.');
    if (opp.bucket === 'swim') focus.push('Natação: 3–4 sessões/semana com foco em CSS e técnica; águas abertas com navegação e drafting.');
    if (opp.bucket === 'transitions') focus.push('Transições: ensaiar T1/T2 com equipamento de prova; elástico nas sapatilhas, layout fixo.');
  }
  const headline = `P${a.rank}/${a.n} na categoria — Top ${Math.round((a.percentile ?? 0) * 100)}%${a.strength ? ` · field RSI ${a.strength.index} (estimativa)` : ''}.`;
  if (sr && sr.swim > sr.bike * 2) lost.push(`Natação ${sr.swim}ª da categoria vs bike ${sr.bike}ª — o desequilíbrio te obriga a correr atrás.`);
  return {
    headline,
    lostTime: lost,
    gainedTime: gained,
    biggestOpportunity: opp ? `${BUCKET_LABEL[opp.bucket]} — potencial realista de ${fmtMin(opp.potentialS)} (${opp.rationale})` : undefined,
    trainingImplications: implications,
    nextRaceFocus: focus,
  };
}

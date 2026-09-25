/**
 * Analytics de treino: TSS por atividade, PMC (CTL/ATL/TSB), volume, zonas,
 * polarização, consistência, melhores marcas e janela pré-prova.
 */
import type { Activity, ActivityMetrics, Athlete, TrainingLoadPoint } from '../domain/types';
import { addDays, daysBetween } from '../domain/time';
import { mean, stdev } from './race';

export type Sport = 'swim' | 'bike' | 'run' | 'strength' | 'other';

export function sportOf(a: Activity): Sport {
  switch (a.type) {
    case 'swim':
    case 'open_water_swim':
      return 'swim';
    case 'ride':
    case 'virtual_ride':
      return 'bike';
    case 'run':
      return 'run';
    case 'strength':
      return 'strength';
    case 'brick':
      return 'bike';
    default:
      return 'other';
  }
}

/**
 * TSS pela melhor informação disponível:
 * potência (bike) > pace (corrida) > pace (natação, sTSS cúbico) > FC (hrTSS) > duração.
 */
export function activityMetrics(a: Activity, athlete: Pick<Athlete, 'ftpW' | 'lthr' | 'thresholdPaceSecPerKm' | 'cssSecPer100m' | 'weightKg'>): ActivityMetrics {
  const hours = a.movingTimeS / 3600;
  const sport = sportOf(a);

  if (sport === 'bike' && (a.normalizedPowerW || a.avgPowerW) && athlete.ftpW > 0) {
    const np = a.normalizedPowerW ?? a.avgPowerW!;
    const IF = np / athlete.ftpW;
    return {
      tss: Math.round(hours * IF * IF * 100),
      tssMethod: 'power',
      intensityFactor: IF,
      variabilityIndex: a.avgPowerW ? np / a.avgPowerW : undefined,
      efficiencyFactor: a.avgHr ? np / a.avgHr : undefined,
      wPerKg: a.avgPowerW ? a.avgPowerW / athlete.weightKg : undefined,
    };
  }
  if (sport === 'run' && a.distanceM > 0 && athlete.thresholdPaceSecPerKm > 0) {
    const pace = a.movingTimeS / (a.distanceM / 1000);
    const IF = athlete.thresholdPaceSecPerKm / pace;
    const speedMMin = a.distanceM / (a.movingTimeS / 60);
    return {
      tss: Math.round(hours * IF * IF * 100),
      tssMethod: 'pace',
      intensityFactor: IF,
      efficiencyFactor: a.avgHr ? speedMMin / a.avgHr : undefined,
    };
  }
  if (sport === 'swim' && a.distanceM > 0 && athlete.cssSecPer100m > 0) {
    const pace = a.movingTimeS / (a.distanceM / 100);
    const IF = athlete.cssSecPer100m / pace;
    return { tss: Math.round(hours * IF ** 3 * 100), tssMethod: 'swim_pace', intensityFactor: IF };
  }
  if (a.avgHr && athlete.lthr > 0) {
    const IF = a.avgHr / athlete.lthr;
    return { tss: Math.round(hours * IF * IF * 100), tssMethod: 'hr', intensityFactor: IF };
  }
  return { tss: Math.round(hours * (sport === 'strength' ? 35 : 45)), tssMethod: 'duration_estimate' };
}

/** PMC clássico: CTL (42d) e ATL (7d) por média exponencial. */
export function performanceManagement(
  activities: Activity[],
  athlete: Parameters<typeof activityMetrics>[1],
  fromIso: string,
  toIso: string,
  seed: { ctl: number; atl: number } = { ctl: 0, atl: 0 },
): TrainingLoadPoint[] {
  const tssByDay = new Map<string, number>();
  for (const a of activities) {
    if (a.completed === false) continue;
    const d = a.date.slice(0, 10);
    tssByDay.set(d, (tssByDay.get(d) ?? 0) + activityMetrics(a, athlete).tss);
  }
  const out: TrainingLoadPoint[] = [];
  let { ctl, atl } = seed;
  const days = daysBetween(fromIso, toIso);
  for (let i = 0; i <= days; i++) {
    const date = addDays(fromIso, i);
    const tss = tssByDay.get(date) ?? 0;
    const tsb = ctl - atl; // forma do dia = antes do treino do dia
    ctl = ctl + (tss - ctl) / 42;
    atl = atl + (tss - atl) / 7;
    out.push({ date, tss, ctl: round1(ctl), atl: round1(atl), tsb: round1(tsb) });
  }
  return out;
}

const round1 = (x: number) => Math.round(x * 10) / 10;

export interface VolumeSummary {
  hours: number;
  sessions: number;
  runKm: number;
  bikeKm: number;
  swimM: number;
  sessionsBySport: Record<Sport, number>;
  hoursBySport: Record<Sport, number>;
  tss: number;
}

export function volumeSummary(activities: Activity[], athlete: Parameters<typeof activityMetrics>[1]): VolumeSummary {
  const sessionsBySport: Record<Sport, number> = { swim: 0, bike: 0, run: 0, strength: 0, other: 0 };
  const hoursBySport: Record<Sport, number> = { swim: 0, bike: 0, run: 0, strength: 0, other: 0 };
  let runKm = 0;
  let bikeKm = 0;
  let swimM = 0;
  let tss = 0;
  for (const a of activities) {
    if (a.completed === false) continue;
    const s = sportOf(a);
    sessionsBySport[s]++;
    hoursBySport[s] += a.movingTimeS / 3600;
    if (s === 'run') runKm += a.distanceM / 1000;
    if (s === 'bike') bikeKm += a.distanceM / 1000;
    if (s === 'swim') swimM += a.distanceM;
    tss += activityMetrics(a, athlete).tss;
  }
  const hours = Object.values(hoursBySport).reduce((x, y) => x + y, 0);
  return { hours, sessions: Object.values(sessionsBySport).reduce((x, y) => x + y, 0), runKm, bikeKm, swimM, sessionsBySport, hoursBySport, tss };
}

/** Atividades no intervalo. Sessões planejadas e não feitas ficam de fora, salvo includeMissed. */
export function inRange(activities: Activity[], fromIso: string, toIso: string, includeMissed = false): Activity[] {
  return activities.filter(
    (a) => a.date.slice(0, 10) >= fromIso && a.date.slice(0, 10) <= toIso && (includeMissed || a.completed !== false),
  );
}

/** Semanas (segunda a domingo) com volume agregado. */
export function weeklyBuckets(activities: Activity[], athlete: Parameters<typeof activityMetrics>[1], fromIso: string, toIso: string) {
  const start = mondayOf(fromIso);
  const weeks: { weekStart: string; summary: VolumeSummary }[] = [];
  for (let w = start; w <= toIso; w = addDays(w, 7)) {
    weeks.push({ weekStart: w, summary: volumeSummary(inRange(activities, w, addDays(w, 6)), athlete) });
  }
  return weeks;
}

export function mondayOf(iso: string): string {
  const d = new Date(iso.slice(0, 10) + 'T00:00:00Z');
  const dow = (d.getUTCDay() + 6) % 7; // 0 = segunda
  return addDays(iso, -dow);
}

export interface IntensityDistribution {
  zones: [number, number, number, number, number]; // frações Z1..Z5
  easy: number; // Z1+Z2
  moderate: number; // Z3
  hard: number; // Z4+Z5
  /** Índice de polarização (Treff et al.). > 2 = polarizado. */
  polarizationIndex: number;
  model: 'polarizado' | 'piramidal' | 'limiar' | 'indefinido';
  totalS: number;
}

export function intensityDistribution(activities: Activity[]): IntensityDistribution {
  const z = [0, 0, 0, 0, 0];
  for (const a of activities) {
    const src = a.hrZones?.seconds;
    if (!src) continue;
    src.forEach((s, i) => (z[i] += s));
  }
  const total = z.reduce((a, b) => a + b, 0);
  const f = z.map((x) => (total > 0 ? x / total : 0)) as IntensityDistribution['zones'];
  const easy = f[0] + f[1];
  const moderate = f[2];
  const hard = f[3] + f[4];
  const pi = moderate > 0 && hard > 0 ? Math.log10((easy / moderate) * hard * 100) : NaN;
  let model: IntensityDistribution['model'] = 'indefinido';
  if (total > 0) {
    if (easy >= 0.7 && hard > moderate) model = 'polarizado';
    else if (easy >= 0.6 && moderate >= hard) model = 'piramidal';
    else model = 'limiar';
  }
  return { zones: f, easy, moderate, hard, polarizationIndex: pi, model, totalS: total };
}

// ───────────────────────── Consistência ─────────────────────────

export interface ConsistencyScore {
  score: number;
  components: { label: string; score: number; weight: number; detail: string }[];
}

/**
 * Score 0–100 para um período (normalmente um mês):
 * frequência (30), semanas completas (25), estabilidade de volume (20),
 * sessões-chave (15), períodos sem treino (10).
 */
export function consistencyScore(
  activities: Activity[],
  athlete: Parameters<typeof activityMetrics>[1] & Pick<Athlete, 'avgWeeklyHours'>,
  fromIso: string,
  toIso: string,
  targetSessionsPerWeek = 9,
): ConsistencyScore {
  const acts = inRange(activities, fromIso, toIso);
  const weeks = weeklyBuckets(acts, athlete, fromIso, toIso).filter((w) => w.weekStart >= mondayOf(fromIso));
  const nWeeks = Math.max(1, daysBetween(fromIso, toIso) / 7);

  const freq = Math.min(1, acts.length / nWeeks / targetSessionsPerWeek);
  const complete = weeks.length ? weeks.filter((w) => w.summary.hours >= athlete.avgWeeklyHours * 0.8).length / weeks.length : 0;
  const hours = weeks.map((w) => w.summary.hours);
  const cv = mean(hours) > 0 ? stdev(hours) / mean(hours) : 1;
  const stability = Math.max(0, 1 - cv);
  const keyPerWeek = acts.filter((a) => a.keySession && a.keySession !== 'race').length / nWeeks;
  const key = Math.min(1, keyPerWeek / 3);

  // Buracos: sequências de 3+ dias sem nenhuma atividade.
  const days = new Set(acts.map((a) => a.date.slice(0, 10)));
  let gapDays = 0;
  let run = 0;
  const total = daysBetween(fromIso, toIso) + 1;
  for (let i = 0; i < total; i++) {
    if (days.has(addDays(fromIso, i))) {
      if (run >= 3) gapDays += run;
      run = 0;
    } else run++;
  }
  if (run >= 3) gapDays += run;
  const gaps = Math.max(0, 1 - gapDays / Math.max(total, 1) / 0.3);

  const components = [
    { label: 'Frequência', score: freq, weight: 30, detail: `${(acts.length / nWeeks).toFixed(1)} sessões/semana` },
    { label: 'Semanas completas', score: complete, weight: 25, detail: `${Math.round(complete * 100)}% das semanas ≥ 80% do volume-alvo` },
    { label: 'Estabilidade de volume', score: stability, weight: 20, detail: `variação semanal ${Math.round(cv * 100)}%` },
    { label: 'Sessões-chave', score: key, weight: 15, detail: `${keyPerWeek.toFixed(1)} por semana (meta 3)` },
    { label: 'Sem buracos', score: gaps, weight: 10, detail: gapDays ? `${gapDays} dias em blocos de 3+ dias parados` : 'nenhum bloco de 3+ dias parado' },
  ];
  const score = Math.round(components.reduce((a, c) => a + c.score * c.weight, 0));
  return { score, components };
}

// ───────────────────────── Melhores marcas ─────────────────────────

export type RunBestKey = '1k' | '5k' | '10k' | '21k' | '42k';
export type BikeBestKey = '5m' | '20m' | '60m';
export type SwimBestKey = '400' | '750' | '1000' | '1500' | '1900';

export const RUN_BEST_M: Record<RunBestKey, number> = { '1k': 1000, '5k': 5000, '10k': 10000, '21k': 21097, '42k': 42195 };
export const SWIM_BEST_M: Record<SwimBestKey, number> = { '400': 400, '750': 750, '1000': 1000, '1500': 1500, '1900': 1900 };

export interface BestEffort {
  value: number; // segundos (corrida/natação) ou watts (bike)
  date: string;
  activityId: string;
  /** 'stream' = medido na série (Strava best_efforts/curva de potência); 'average' = estimado pela média da atividade. */
  method: 'stream' | 'average';
}

export function bestRun(activities: Activity[], key: RunBestKey): BestEffort | undefined {
  let best: BestEffort | undefined;
  const dist = RUN_BEST_M[key];
  for (const a of activities) {
    if (sportOf(a) !== 'run') continue;
    const measured = a.bestEfforts?.run?.[key];
    const candidate =
      measured != null
        ? { value: measured, method: 'stream' as const }
        : a.distanceM >= dist
          ? { value: (a.movingTimeS / a.distanceM) * dist, method: 'average' as const }
          : undefined;
    if (candidate && (!best || candidate.value < best.value)) best = { ...candidate, date: a.date, activityId: a.id };
  }
  return best;
}

export function bestSwim(activities: Activity[], key: SwimBestKey): BestEffort | undefined {
  let best: BestEffort | undefined;
  const dist = SWIM_BEST_M[key];
  for (const a of activities) {
    if (sportOf(a) !== 'swim') continue;
    const measured = a.bestEfforts?.swim?.[key];
    const candidate =
      measured != null
        ? { value: measured, method: 'stream' as const }
        : a.distanceM >= dist
          ? { value: (a.movingTimeS / a.distanceM) * dist, method: 'average' as const }
          : undefined;
    if (candidate && (!best || candidate.value < best.value)) best = { ...candidate, date: a.date, activityId: a.id };
  }
  return best;
}

export function bestPower(activities: Activity[], key: BikeBestKey): BestEffort | undefined {
  let best: BestEffort | undefined;
  const minutes = Number(key.replace('m', ''));
  for (const a of activities) {
    if (sportOf(a) !== 'bike') continue;
    const measured = a.bestEfforts?.power?.[key];
    const candidate =
      measured != null
        ? { value: measured, method: 'stream' as const }
        : a.avgPowerW && a.movingTimeS >= minutes * 60
          ? { value: a.avgPowerW, method: 'average' as const }
          : undefined;
    if (candidate && (!best || candidate.value > best.value)) best = { ...candidate, date: a.date, activityId: a.id };
  }
  return best;
}

// ───────────────────────── Eficiência aeróbica ─────────────────────────

/**
 * Pace em corridas fáceis (FC média dentro de uma faixa) ao longo do tempo.
 * Pace caindo com a mesma FC = motor aeróbico melhorando.
 */
export function paceAtHeartRate(activities: Activity[], hrLo: number, hrHi: number) {
  return activities
    .filter((a) => sportOf(a) === 'run' && a.avgHr && a.avgHr >= hrLo && a.avgHr <= hrHi && a.distanceM >= 5000)
    .map((a) => ({ date: a.date.slice(0, 10), paceSecPerKm: a.movingTimeS / (a.distanceM / 1000), hr: a.avgHr! }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function powerAtHeartRate(activities: Activity[], hrLo: number, hrHi: number) {
  return activities
    .filter((a) => sportOf(a) === 'bike' && a.avgHr && a.avgPowerW && a.avgHr >= hrLo && a.avgHr <= hrHi && a.movingTimeS >= 3600)
    .map((a) => ({ date: a.date.slice(0, 10), watts: a.normalizedPowerW ?? a.avgPowerW!, hr: a.avgHr! }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ───────────────────────── Treino → Resultado ─────────────────────────

export interface PreRaceWindow {
  days: number;
  avgWeeklyHours: number;
  sessions: number;
  plannedCompliance?: number;
  missedSessions: number;
  longRuns: number;
  longRides: number;
  bricks: number;
  runKmPerWeek: number;
  bikeKmPerWeek: number;
  swimMPerWeek: number;
  intensity: IntensityDistribution;
  ctlAtRace: number;
  tsbAtRace: number;
  /** Queda de volume nos últimos 14 dias vs média do bloco (taper). */
  taperDrop: number;
}

export function preRaceWindow(
  activities: Activity[],
  athlete: Parameters<typeof activityMetrics>[1],
  raceDate: string,
  days: number,
  pmc: TrainingLoadPoint[],
): PreRaceWindow {
  const from = addDays(raceDate, -days);
  const to = addDays(raceDate, -1);
  const acts = inRange(activities, from, to);
  const v = volumeSummary(acts, athlete);
  const weeks = days / 7;
  const planned = inRange(activities, from, to, true).filter((a) => a.planned);
  const done = planned.filter((a) => a.completed !== false);
  const last14 = volumeSummary(inRange(activities, addDays(raceDate, -14), to), athlete).hours / 2;
  const blockAvg = v.hours / weeks;
  const point = pmc.find((p) => p.date === raceDate);
  return {
    days,
    avgWeeklyHours: v.hours / weeks,
    sessions: v.sessions,
    plannedCompliance: planned.length ? done.length / planned.length : undefined,
    missedSessions: planned.length - done.length,
    longRuns: acts.filter((a) => a.keySession === 'long_run').length,
    longRides: acts.filter((a) => a.keySession === 'long_ride').length,
    bricks: acts.filter((a) => a.keySession === 'brick').length,
    runKmPerWeek: v.runKm / weeks,
    bikeKmPerWeek: v.bikeKm / weeks,
    swimMPerWeek: v.swimM / weeks,
    intensity: intensityDistribution(acts),
    ctlAtRace: point?.ctl ?? NaN,
    tsbAtRace: point?.tsb ?? NaN,
    taperDrop: blockAvg > 0 ? 1 - last14 / blockAvg : 0,
  };
}

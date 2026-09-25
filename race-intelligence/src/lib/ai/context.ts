/**
 * Snapshot compacto e factual do dashboard para o AI Analyst.
 * Tudo que o modelo "sabe" sobre o atleta vem daqui — nada é inventado.
 */
import type { Dataset } from '../data/repository';
import { DISTANCE_LABEL, isTriathlon } from '../domain/race-meta';
import { daysBetween, formatDuration, formatGap, formatPace100, formatPaceKm, formatSpeed } from '../domain/time';
import {
  analyzeRace,
  currentCategory,
  kpis,
  latestKeyRace,
  monthlyConsistency,
  personalBests,
  qualificationStatus,
  strongestDiscipline,
  trainingStatus,
} from '../analytics/insights';
import { BUCKET_LABEL, GAP_BUCKETS } from '../analytics/race';
import { paceAtHeartRate, powerAtHeartRate } from '../analytics/training';

const pct = (x?: number) => (x == null || !Number.isFinite(x) ? '—' : `${Math.round(x * 100)}%`);

export function buildAnalystContext(ds: Dataset) {
  const a = ds.athlete;
  const cat = currentCategory(ds);
  const q = qualificationStatus(ds);
  const key = latestKeyRace(ds);
  const deep = key ? analyzeRace(ds, key.race.id, 'P5', { deep: true }) : undefined;

  const races = ds.races
    .filter((r) => r.date <= ds.today)
    .map((race) => {
      const an = analyzeRace(ds, race.id)!;
      if (!an.me) return { name: race.name, date: race.date, note: 'sem meu resultado' };
      const gaps = Object.fromEntries(
        (['P1', 'P5', 'P10', 'TOP10PCT', 'MEDIAN', 'LAST_SLOT'] as const)
          .filter((k) => an.gapsByKey[k])
          .map((k) => [k, Object.fromEntries([['total', formatGap(an.gapsByKey[k]!.totalS)], ...GAP_BUCKETS.map((b) => [b, formatGap(an.gapsByKey[k]!.byBucket[b])])])]),
      );
      return {
        id: race.id,
        name: race.name,
        date: race.date,
        distance: DISTANCE_LABEL[race.distance],
        dataSource: race.provenance === 'mock' ? 'EXEMPLO (dados fictícios)' : race.provenance,
        conditions: race.conditions,
        result: formatDuration(an.me.totalS),
        categoryRank: `${an.rank}/${an.n}`,
        percentile: pct(an.percentile),
        splits: isTriathlon(race.distance)
          ? { swim: formatDuration(an.me.splits.swim), t1: formatDuration(an.me.splits.t1), bike: formatDuration(an.me.splits.bike), t2: formatDuration(an.me.splits.t2), run: formatDuration(an.me.splits.run) }
          : { run: formatDuration(an.me.splits.run) },
        paces: an.pace ? { swim: formatPace100(an.pace.swim100), bike: formatSpeed(an.pace.bikeKmh), run: formatPaceKm(an.pace.runKm) } : undefined,
        splitRankInCategory: an.splitRanks,
        positionAfterEachLeg: an.ranksAfter,
        gapsToBenchmarks: gaps,
        fieldStrengthIndex_estimate: an.strength ? { index: an.strength.index, confidence: an.strength.confidence } : undefined,
        strengthAdjustedPercentile_estimate: pct(an.adjustedPercentile),
        slots: race.slots ? { ...race.slots, lastQualifierTime: race.slots.lastQualifierTimeS ? formatDuration(race.slots.lastQualifierTimeS) : undefined } : undefined,
      };
    });

  const easyRuns = paceAtHeartRate(ds.activities, a.lthr * 0.8, a.lthr * 0.89);
  const easyRides = powerAtHeartRate(ds.activities, a.lthr * 0.78, a.lthr * 0.9);
  const firstLast = <T,>(xs: T[]) => (xs.length ? { first: xs[0], last: xs[xs.length - 1], n: xs.length } : undefined);

  return {
    today: ds.today,
    dataNotes: {
      activities: ds.meta.activitiesSource === 'mock' ? 'Treinos são EXEMPLO (Strava não conectado).' : 'Treinos sincronizados do Strava.',
      races: ds.meta.sampleRaces ? `${ds.meta.sampleRaces} provas de EXEMPLO incluídas.` : 'Somente provas reais.',
      profile: ds.meta.profileIsSample ? 'Perfil fisiológico ainda com valores de exemplo.' : 'Perfil editado pelo atleta.',
    },
    athlete: {
      name: a.name,
      category: cat.now,
      nextCategory: `${cat.next} a partir de ${cat.changesInYear}`,
      categoryAtTargetRace: cat.atTarget,
      weightKg: a.weightKg,
      ftpW: a.ftpW,
      wPerKg: +(a.ftpW / a.weightKg).toFixed(2),
      vo2max: a.vo2max,
      lthr: a.lthr,
      thresholdPace: formatPaceKm(a.thresholdPaceSecPerKm),
      css: formatPace100(a.cssSecPer100m),
      avgWeeklyHours: a.avgWeeklyHours,
      mainGoal: a.mainGoal,
      targetRace: `${a.targetRaceName} (${a.targetRaceDate}, em ${daysBetween(ds.today, a.targetRaceDate)} dias)`,
      goals: a.goals.map((g) => `${g.label}: ${g.context ?? g.target}`),
      physioHistory: a.history,
    },
    kpis: kpis(ds).map((k) => ({ label: k.label, value: k.value, previous: k.previous, format: k.format, note: k.note, estimate: k.estimate })),
    qualification: {
      provenance: q.provenance,
      explanation: q.explanation,
      referenceRace: q.referenceRace?.name,
      myTime: q.me ? formatDuration(q.me.totalS) : undefined,
      benchmarkTime: q.benchmark ? formatDuration(q.benchmark.totalS) : undefined,
      gap: q.gap ? { total: formatGap(q.gap.totalS), ...Object.fromEntries(GAP_BUCKETS.map((b) => [b, formatGap(q.gap!.byBucket[b])])) } : undefined,
    },
    strongestDiscipline: strongestDiscipline(ds),
    latestKeyRaceOpportunities: deep?.opportunities
      ? {
          race: deep.race.name,
          total: formatDuration(deep.opportunities.totalS),
          items: deep.opportunities.items.map((o) => ({ discipline: BUCKET_LABEL[o.bucket], potential: formatDuration(o.potentialS), gapToNextLevel: formatDuration(o.peerGapS), confidence: o.confidence, rationale: o.rationale })),
        }
      : undefined,
    preparationBeforeLatestKeyRace: deep?.windows?.map((w) => ({ days: w.days, weeklyHours: +w.avgWeeklyHours.toFixed(1), longRuns: w.longRuns, longRides: w.longRides, bricks: w.bricks, compliance: pct(w.plannedCompliance), easyShare: pct(w.intensity.easy), z3Share: pct(w.intensity.moderate), hardShare: pct(w.intensity.hard), ctlAtRace: w.ctlAtRace, tsbAtRace: w.tsbAtRace })),
    trainingStatus: trainingStatus(ds).map((t) => ({ lastDays: t.days, weeklyHours: +t.weeklyHours.toFixed(1), runKm: Math.round(t.runKm), bikeKm: Math.round(t.bikeKm), swimM: Math.round(t.swimM), sessions: t.sessions, intensityModel: t.intensity.model, ctl: t.ctl, atl: t.atl, tsb: t.tsb })),
    consistencyByMonth: monthlyConsistency(ds, 6),
    aerobicEfficiency: {
      easyRunPaceAtSameHr: firstLast(easyRuns.map((x) => ({ date: x.date, pace: formatPaceKm(x.paceSecPerKm), hr: x.hr }))),
      bikePowerAtSameHr: firstLast(easyRides.map((x) => ({ date: x.date, watts: x.watts, hr: x.hr }))),
    },
    personalBests: personalBests(ds),
    races,
  };
}

export type AnalystContext = ReturnType<typeof buildAnalystContext>;

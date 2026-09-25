import { getDataset } from '@/lib/data/repository';
import { monthlyConsistency, personalBests, pmcFor } from '@/lib/analytics/insights';
import {
  activityMetrics,
  bestPower,
  bestRun,
  bestSwim,
  consistencyScore,
  inRange,
  intensityDistribution,
  mondayOf,
  paceAtHeartRate,
  powerAtHeartRate,
  sportOf,
  volumeSummary,
  weeklyBuckets,
} from '@/lib/analytics/training';
import { addDays, formatDate, formatDuration, formatHours, formatNumber, formatPace100, formatPaceKm } from '@/lib/domain/time';
import { Badge, Card, Chip, PageHeader, Stat } from '@/components/ui';
import { LineChart, StackedBars } from '@/components/charts';
import { ZoneBar } from '@/components/race-viz';
import { DataBanner } from '@/components/data-banner';

const RANGES = [7, 30, 90, 180, 365];

/** Média móvel simples para séries ruidosas (treinos individuais). */
function smooth<T extends { x: string; y: number }>(pts: T[], k = 5): T[] {
  return pts.map((p, i) => {
    const w = pts.slice(Math.max(0, i - k + 1), i + 1);
    return { ...p, y: w.reduce((a, q) => a + q.y, 0) / w.length };
  });
}
const SPORT_COLORS = { swim: 'var(--swim)', bike: 'var(--bike)', run: 'var(--run)', strength: '#8a91a0' };
const SPORT_NAMES = { swim: 'Natação', bike: 'Bike', run: 'Corrida', strength: 'Força/outros' };

export default async function TrainingPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const sp = await searchParams;
  const days = RANGES.includes(Number(sp.d)) ? Number(sp.d) : 90;
  const ds = await getDataset();
  const { athlete } = ds;
  const from = addDays(ds.today, -(days - 1));
  const acts = inRange(ds.activities, from, ds.today);
  const v = volumeSummary(acts, athlete);
  const intensity = intensityDistribution(acts);
  const pmc = pmcFor(ds).filter((p) => p.date >= from);
  const cons = consistencyScore(ds.activities, athlete, from, ds.today);
  const monthly = monthlyConsistency(ds, 12);
  const pbs = personalBests(ds);

  // Barras: por dia (7d) ou por semana.
  const bars =
    days <= 7
      ? Array.from({ length: 7 }, (_, i) => {
          const d = addDays(from, i);
          const s = volumeSummary(inRange(ds.activities, d, d), athlete);
          return { x: d, parts: [{ key: 'swim', value: s.hoursBySport.swim }, { key: 'bike', value: s.hoursBySport.bike }, { key: 'run', value: s.hoursBySport.run }, { key: 'strength', value: s.hoursBySport.strength + s.hoursBySport.other }] };
        })
      : weeklyBuckets(ds.activities, athlete, mondayOf(from), ds.today).map((w) => ({
          x: w.weekStart,
          label: `Semana de ${formatDate(w.weekStart, { day: '2-digit', month: 'short' })}`,
          parts: [{ key: 'swim', value: w.summary.hoursBySport.swim }, { key: 'bike', value: w.summary.hoursBySport.bike }, { key: 'run', value: w.summary.hoursBySport.run }, { key: 'strength', value: w.summary.hoursBySport.strength + w.summary.hoursBySport.other }],
        }));

  const lookback = addDays(ds.today, -Math.max(days, 180));
  const trendActs = inRange(ds.activities, lookback, ds.today);
  const runHr = paceAtHeartRate(trendActs, athlete.lthr * 0.8, athlete.lthr * 0.89);
  const bikeHr = powerAtHeartRate(trendActs, athlete.lthr * 0.78, athlete.lthr * 0.9);
  const swims = trendActs.filter((a) => sportOf(a) === 'swim' && a.distanceM >= 1500 && a.keySession !== 'race').map((a) => ({ x: a.date.slice(0, 10), y: a.movingTimeS / (a.distanceM / 100) }));

  const runBests = (['1k', '5k', '10k', '21k'] as const).map((k) => ({ k, b: bestRun(acts, k) }));
  const bikeBests = (['5m', '20m', '60m'] as const).map((k) => ({ k, b: bestPower(acts, k) }));
  const swimBests = (['400', '750', '1500', '1900'] as const).map((k) => ({ k, b: bestSwim(acts, k) }));
  const weeks = days / 7;
  const recent = [...acts].reverse().slice(0, 12);

  return (
    <div className="space-y-4">
      <DataBanner ds={ds} />
      <PageHeader eyebrow="Evolução dos treinos" title="Treinos"
        action={<div className="flex flex-wrap gap-2">{RANGES.map((r) => <Chip key={r} href={`/treinos?d=${r}`} active={r === days}>{r} dias</Chip>)}</div>} />

      <Card eyebrow="Volume" title={`Últimos ${days} dias`}>
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-5">
          <Stat label="Horas/semana" value={formatHours((v.hours / weeks) * 3600)} sub={`${formatHours(v.hours * 3600)} no período`} />
          <Stat label="Sessões" value={v.sessions} sub={`${v.sessionsBySport.swim} swim · ${v.sessionsBySport.bike} bike · ${v.sessionsBySport.run} run`} />
          <Stat label="Natação" value={`${formatNumber(v.swimM / 1000, 1)} km`} sub={`${formatNumber(v.swimM / weeks)} m/sem`} />
          <Stat label="Bike" value={`${formatNumber(v.bikeKm)} km`} sub={`${formatNumber(v.bikeKm / weeks)} km/sem`} />
          <Stat label="Corrida" value={`${formatNumber(v.runKm)} km`} sub={`${formatNumber(v.runKm / weeks, 1)} km/sem`} />
        </div>
        <div className="mt-5">
          <StackedBars bars={bars} colors={SPORT_COLORS} names={SPORT_NAMES} yFormat="hours" xFormat="day" height={190} />
        </div>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card eyebrow="Intensidade" title={`Distribuição por zona de FC · modelo ${intensity.model}`}>
          <ZoneBar zones={intensity.zones} />
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Stat size="sm" label="Fácil (Z1–Z2)" value={`${Math.round(intensity.easy * 100)}%`} />
            <Stat size="sm" label="Moderado (Z3)" value={`${Math.round(intensity.moderate * 100)}%`} />
            <Stat size="sm" label="Intenso (Z4–Z5)" value={`${Math.round(intensity.hard * 100)}%`} />
          </div>
          <p className="mt-3 text-xs text-ink-2">
            Índice de polarização {Number.isFinite(intensity.polarizationIndex) ? formatNumber(intensity.polarizationIndex, 2) : '—'} (&gt; 2,0 = polarizado).
            {intensity.moderate > 0.2 && ' Z3 acima de 20% — zona cinzenta que cansa sem estimular tanto quanto limiar ou fácil de verdade.'}
          </p>
        </Card>
        <Card eyebrow="Readiness" title="Fitness · Fatigue · Form" action={ds.meta.activitiesSource === 'mock' ? <Badge kind="mock" /> : <Badge kind="estimate">TSS estimado</Badge>}>
          <LineChart height={170} xFormat="day" yFormat="int" showDots={false}
            series={[
              { name: 'Fitness (CTL)', color: 'var(--accent)', points: pmc.map((p) => ({ x: p.date, y: p.ctl })) },
              { name: 'Fatigue (ATL)', color: 'var(--bike)', points: pmc.map((p) => ({ x: p.date, y: p.atl })) },
              { name: 'Form (TSB)', color: 'var(--ink-2)', dashed: true, points: pmc.map((p) => ({ x: p.date, y: p.tsb })) },
            ]} />
          <p className="mt-2 text-[11px] text-muted">TSS por potência (bike), pace (corrida/natação) ou FC quando não há sensor — sem potência/pace o valor é estimativa.</p>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card eyebrow="Corrida" title={`Limiar ${formatPaceKm(athlete.thresholdPaceSecPerKm)}`}>
          <div className="eyebrow mb-1">Pace em Z2 (mesma FC) · média móvel</div>
          <LineChart height={130} invert xFormat="year_month" yFormat="pace_km" showDots={false} series={[{ name: 'Pace', color: 'var(--run)', points: smooth(runHr.map((r) => ({ x: r.date, y: r.paceSecPerKm, label: `${r.hr} bpm` }))) }]} />
          <div className="mt-3 grid grid-cols-4 gap-2 border-t border-line pt-3">
            {runBests.map(({ k, b }) => <Stat key={k} size="sm" label={k.replace('k', ' km')} value={b ? formatDuration(b.value) : '—'} sub={b?.method === 'average' ? 'pela média' : undefined} />)}
          </div>
        </Card>
        <Card eyebrow="Bike" title={`FTP ${athlete.ftpW} W · ${formatNumber(athlete.ftpW / athlete.weightKg, 2)} W/kg`}>
          <div className="eyebrow mb-1">Potência em Z2 (mesma FC) · média móvel</div>
          <LineChart height={130} xFormat="year_month" yFormat="watts" showDots={false} series={[{ name: 'Potência', color: 'var(--bike)', points: smooth(bikeHr.map((r) => ({ x: r.date, y: r.watts, label: `${r.hr} bpm` }))) }]} />
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3">
            {bikeBests.map(({ k, b }) => <Stat key={k} size="sm" label={k.replace('m', ' min')} value={b ? `${b.value} W` : '—'} sub={b ? `${formatNumber(b.value / athlete.weightKg, 2)} W/kg` : undefined} />)}
          </div>
        </Card>
        <Card eyebrow="Natação" title={`CSS ${formatPace100(athlete.cssSecPer100m)}`}>
          <div className="eyebrow mb-1">Pace médio /100m (sessões ≥ 1.500 m)</div>
          <LineChart height={130} invert xFormat="year_month" yFormat="pace_100" showDots={false} series={[{ name: 'Pace', color: 'var(--swim)', points: smooth(swims) }]} />
          <div className="mt-3 grid grid-cols-4 gap-2 border-t border-line pt-3">
            {swimBests.map(({ k, b }) => <Stat key={k} size="sm" label={`${k} m`} value={b ? formatDuration(b.value) : '—'} />)}
          </div>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Card className="lg:col-span-2" eyebrow="Consistency score" title={`${cons.score}/100 · últimos ${days} dias`}>
          <ul className="space-y-2.5">
            {cons.components.map((c) => (
              <li key={c.label}>
                <div className="flex justify-between text-xs"><span className="font-medium">{c.label}</span><span className="num text-ink-2">{Math.round(c.score * c.weight)}/{c.weight}</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-surface-2"><div className="h-full rounded-full bg-ink" style={{ width: `${c.score * 100}%` }} /></div>
                <div className="mt-0.5 text-[11px] text-muted">{c.detail}</div>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="lg:col-span-3" eyebrow="Consistência" title="Evolução mensal">
          <LineChart height={200} xFormat="month" yFormat="int" yDomain={[0, 100]} series={[{ name: 'Score', color: 'var(--ink)', points: monthly.map((m) => ({ x: m.month, y: m.score })) }]} />
        </Card>
      </div>

      <Card eyebrow="Personal bests" title="Recordes pessoais">
        <div className="grid gap-5 md:grid-cols-4">
          <div>
            <div className="eyebrow mb-2">Natação</div>
            {pbs.swim.map((p) => <div key={p.key} className="flex justify-between border-b border-line py-1.5 text-sm"><span>{p.label}</span><span className="num font-semibold">{p.best ? formatDuration(p.best.value) : '—'}</span></div>)}
          </div>
          <div>
            <div className="eyebrow mb-2">Corrida</div>
            {pbs.run.map((p) => <div key={p.key} className="flex justify-between border-b border-line py-1.5 text-sm"><span>{p.label}</span><span className="num font-semibold">{p.best ? formatDuration(p.best.value) : '—'}</span></div>)}
          </div>
          <div>
            <div className="eyebrow mb-2">Bike</div>
            {pbs.power.map((p) => <div key={p.key} className="flex justify-between border-b border-line py-1.5 text-sm"><span>{p.label}</span><span className="num font-semibold">{p.best ? `${p.best.value} W` : '—'}</span></div>)}
            <div className="flex justify-between border-b border-line py-1.5 text-sm"><span>FTP</span><span className="num font-semibold">{pbs.ftp} W</span></div>
          </div>
          <div>
            <div className="eyebrow mb-2">Provas</div>
            {pbs.races.map((p) => <div key={p.label} className="flex justify-between border-b border-line py-1.5 text-sm"><span>{p.label}</span><span className="num font-semibold" title={p.best?.race.name}>{p.best ? formatDuration(p.best.totalS) : '—'}</span></div>)}
          </div>
        </div>
      </Card>

      <Card eyebrow="Atividades recentes" title="Últimos treinos">
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="py-2 font-medium">Data</th><th className="py-2 font-medium">Treino</th><th className="py-2 text-right font-medium">Duração</th><th className="py-2 text-right font-medium">Distância</th><th className="py-2 text-right font-medium">FC</th><th className="py-2 text-right font-medium">NP / Pace</th><th className="py-2 text-right font-medium">IF</th><th className="py-2 text-right font-medium">TSS</th>
              </tr>
            </thead>
            <tbody className="num">
              {recent.map((a) => {
                const m = activityMetrics(a, athlete);
                const s = sportOf(a);
                return (
                  <tr key={a.id} className="border-t border-line">
                    <td className="py-2 text-ink-2">{formatDate(a.date, { day: '2-digit', month: '2-digit' })}</td>
                    <td className="py-2 font-sans"><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: SPORT_COLORS[s as keyof typeof SPORT_COLORS] ?? '#8a91a0' }} />{a.name}</td>
                    <td className="py-2 text-right">{formatDuration(a.movingTimeS)}</td>
                    <td className="py-2 text-right">{a.distanceM ? (s === 'swim' ? `${formatNumber(a.distanceM)} m` : `${formatNumber(a.distanceM / 1000, 1)} km`) : '—'}</td>
                    <td className="py-2 text-right">{a.avgHr ?? '—'}</td>
                    <td className="py-2 text-right">{s === 'bike' && a.normalizedPowerW ? `${a.normalizedPowerW} W` : s === 'run' && a.distanceM ? formatPaceKm(a.movingTimeS / (a.distanceM / 1000)) : s === 'swim' && a.distanceM ? formatPace100(a.movingTimeS / (a.distanceM / 100)) : '—'}</td>
                    <td className="py-2 text-right">{m.intensityFactor ? formatNumber(m.intensityFactor, 2) : '—'}</td>
                    <td className="py-2 text-right font-semibold">{m.tss}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

import Link from 'next/link';
import { getDataset } from '@/lib/data/repository';
import {
  analyzeRace,
  currentCategory,
  kpis,
  latestKeyRace,
  performanceTrend,
  qualificationStatus,
  strongestDiscipline,
  trainingStatus,
} from '@/lib/analytics/insights';
import { BUCKET_LABEL } from '@/lib/analytics/race';
import { daysBetween, formatDate, formatDuration, formatGap, formatHours, formatNumber, formatPace100, formatPaceKm, formatSpeed } from '@/lib/domain/time';
import { DISTANCE_LABEL } from '@/lib/domain/race-meta';
import { Badge, Card, DisciplineDot, Stat } from '@/components/ui';
import { LineChart } from '@/components/charts';
import { SplitStrip, WhereAreTheMinutes, ZoneBar } from '@/components/race-viz';
import { KpiCard } from '@/components/kpi';
import { DataBanner } from '@/components/data-banner';

export default async function Home() {
  const ds = await getDataset();
  const { athlete } = ds;
  const daysLeft = daysBetween(ds.today, athlete.targetRaceDate);
  const cat = currentCategory(ds);
  const q = qualificationStatus(ds);
  const key = latestKeyRace(ds);
  const deep = key ? analyzeRace(ds, key.race.id, 'P5', { deep: true }) : undefined;
  const strongest = strongestDiscipline(ds);
  const opp = deep?.opportunities?.items[0];
  const trend = performanceTrend(ds);
  const status = trainingStatus(ds);
  const allKpis = kpis(ds);
  const latestAny = [...ds.races].filter((r) => r.date <= ds.today).reverse().find((r) => ds.results.some((x) => x.raceId === r.id && x.isMe));
  const latest = latestAny ? analyzeRace(ds, latestAny.id) : undefined;

  return (
    <div className="space-y-4">
      <DataBanner ds={ds} />

      {/* ROAD TO WORLDS */}
      <section className="overflow-hidden rounded-2xl bg-ink p-5 text-white sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">Road to Worlds</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{athlete.targetRaceName}</h1>
            <div className="mt-1 text-sm text-white/65">
              {formatDate(athlete.targetRaceDate, { day: '2-digit', month: 'long', year: 'numeric' })} · {DISTANCE_LABEL[athlete.targetRaceDistance]} · categoria {cat.atTarget}
            </div>
          </div>
          <div className="flex items-end gap-6">
            <div>
              <div className="num text-5xl font-semibold leading-none tracking-tight sm:text-6xl">{daysLeft >= 0 ? daysLeft : '—'}</div>
              <div className="mt-1 text-xs text-white/60">dias · {Math.max(0, Math.floor(daysLeft / 7))} semanas</div>
            </div>
            {q.gap && (
              <div className="border-l border-white/15 pl-6">
                <div className="num text-3xl font-semibold leading-none tracking-tight">{formatGap(q.gap.totalS)}</div>
                <div className="mt-1 text-xs text-white/60">para a vaga · {q.provenance === 'official' ? 'benchmark oficial' : 'estimativa'}</div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4 cards principais */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card eyebrow="Current level">
          {key ? (
            <>
              <div className="num text-3xl font-semibold tracking-tight">
                P{key.a.rank}
                <span className="text-base font-normal text-muted">/{key.a.n}</span>
              </div>
              <div className="mt-1 text-xs text-ink-2">
                Top {Math.round(key.a.percentile! * 100)}% · {key.race.name.replace('IRONMAN ', '')}
              </div>
              {key.a.adjustedPercentile != null && <div className="mt-1 text-[11px] text-muted">Ajustado ao field: Top {Math.round(key.a.adjustedPercentile * 100)}% (est.)</div>}
            </>
          ) : (
            <div className="text-sm text-muted">Sem prova-chave</div>
          )}
        </Card>
        <Card eyebrow={<span className="flex items-center gap-2">Qualification gap {q.provenance !== 'none' && <Badge kind={q.provenance} />}</span>}>
          {q.gap ? (
            <>
              <div className="num text-3xl font-semibold tracking-tight">{formatDuration(q.gap.totalS)}</div>
              <div className="mt-1 text-xs text-ink-2">
                {formatDuration(q.me!.totalS)} vs {formatDuration(q.benchmark!.totalS)} (P{q.benchmark!.rank})
              </div>
              <div className="mt-1 truncate text-[11px] text-muted">{q.referenceRace?.name}</div>
            </>
          ) : (
            <div className="text-sm text-muted">Cadastre vagas de uma prova-alvo</div>
          )}
        </Card>
        <Card eyebrow="Strongest discipline">
          {strongest ? (
            <>
              <div className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
                <DisciplineDot bucket={strongest.bucket} />
                {BUCKET_LABEL[strongest.bucket]}
              </div>
              <div className="mt-1 text-xs text-ink-2">Split médio no Top {Math.round(strongest.avgPercentile * 100)}% da categoria</div>
              <div className="mt-1 text-[11px] text-muted">últimas 3 provas de triathlon</div>
            </>
          ) : (
            <div className="text-sm text-muted">Sem dados</div>
          )}
        </Card>
        <Card eyebrow="Biggest opportunity">
          {opp ? (
            <>
              <div className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
                <DisciplineDot bucket={opp.bucket} />
                <span className="num">{formatDuration(opp.potentialS)}</span>
              </div>
              <div className="mt-1 text-xs text-ink-2">{BUCKET_LABEL[opp.bucket]} · ganho realista até a prova-alvo</div>
              <div className="mt-1 text-[11px] text-muted">total potencial {formatDuration(deep!.opportunities!.totalS)}</div>
            </>
          ) : (
            <div className="text-sm text-muted">Sem dados</div>
          )}
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        {/* Where are the minutes */}
        <Card className="lg:col-span-3" eyebrow="Where are the minutes?" title={q.referenceRace ? `${q.referenceRace.name} vs ${q.benchmark?.label}` : 'vs P5'}
          action={q.referenceRace && <Link href={`/provas/${q.referenceRace.id}?vs=LAST_SLOT`} className="text-xs font-medium text-accent">Detalhar →</Link>}>
          {q.gap && q.benchmark ? (
            <WhereAreTheMinutes gap={q.gap} benchLabel={q.benchmark.label} />
          ) : deep?.gap && deep.selected ? (
            <WhereAreTheMinutes gap={deep.gap} benchLabel={deep.selected.label} />
          ) : (
            <div className="text-sm text-muted">Importe uma prova para ver a decomposição do gap.</div>
          )}
        </Card>

        {/* Latest race */}
        <Card className="lg:col-span-2" eyebrow="Latest race" title={latestAny?.name} action={latestAny && <Link href={`/provas/${latestAny.id}`} className="text-xs font-medium text-accent">Relatório →</Link>}>
          {latest?.me ? (
            <div className="space-y-4">
              <div className="flex items-end justify-between">
                <Stat label={formatDate(latestAny!.date)} value={formatDuration(latest.me.totalS)} size="lg" />
                <div className="text-right">
                  <div className="num text-2xl font-semibold">P{latest.rank}<span className="text-sm font-normal text-muted">/{latest.n}</span></div>
                  <div className="text-xs text-ink-2">Top {Math.round(latest.percentile! * 100)}%</div>
                </div>
              </div>
              {latest.me.splits.bike > 0 && <SplitStrip splits={latest.me.splits} />}
              <div className="grid grid-cols-3 gap-2 text-xs">
                {latest.me.splits.swim > 0 && (
                  <div><div className="text-muted">Swim</div><div className="num font-medium">{formatDuration(latest.me.splits.swim)}</div><div className="num text-muted">{formatPace100(latest.pace!.swim100)}</div></div>
                )}
                {latest.me.splits.bike > 0 && (
                  <div><div className="text-muted">Bike</div><div className="num font-medium">{formatDuration(latest.me.splits.bike)}</div><div className="num text-muted">{formatSpeed(latest.pace!.bikeKmh)}</div></div>
                )}
                <div><div className="text-muted">Run</div><div className="num font-medium">{formatDuration(latest.me.splits.run)}</div><div className="num text-muted">{formatPaceKm(latest.pace!.runKm)}</div></div>
              </div>
              {latest.gapsByKey.P1 && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-ink-2">
                  {(['P1', 'P3', 'P5', 'P10'] as const).map((k) => latest.gapsByKey[k] && (
                    <span key={k}>vs {k} <span className="num font-medium text-ink">{formatGap(latest.gapsByKey[k]!.totalS)}</span></span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted">Nenhuma prova ainda.</div>
          )}
        </Card>
      </div>

      {/* Performance trend */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card eyebrow="Performance trend · 12 meses" title="Fitness (CTL)" action={ds.meta.activitiesSource === 'mock' ? <Badge kind="mock" /> : undefined}>
          <LineChart height={170} series={[{ name: 'CTL', color: 'var(--accent)', points: trend.map((t) => ({ x: t.month, y: t.ctl })) }]} xFormat="month" yFormat="int" />
        </Card>
        <Card eyebrow="Performance trend · 12 meses" title="Percentil na categoria (triathlon)">
          <LineChart height={170} invert showDots
            series={[{ name: 'Percentil', color: 'var(--ink)', points: trend.filter((t) => t.racePercentile != null).map((t) => ({ x: t.month, y: t.racePercentile! * 100, label: t.raceName })) }]}
            xFormat="month" yFormat="top_pct" />
          <p className="mt-1 text-[11px] text-muted">Menor é melhor. Métrica relativa ao field de cada edição — comparável entre provas.</p>
        </Card>
      </div>

      {/* Training status */}
      <Card eyebrow="Training status" title="Últimos 7 / 30 / 90 dias" action={<Link href="/treinos" className="text-xs font-medium text-accent">Treinos →</Link>}>
        <div className="grid gap-4 sm:grid-cols-3">
          {status.map((s) => (
            <div key={s.days} className="rounded-xl bg-surface-2 p-3.5">
              <div className="eyebrow">{s.days} dias</div>
              <div className="num mt-1 text-2xl font-semibold">{formatHours(s.weeklyHours * 3600)}<span className="text-xs font-normal text-muted"> /sem</span></div>
              <div className="num mt-1 text-xs text-ink-2">
                {formatNumber(s.swimM / 1000, 1)} km swim · {formatNumber(s.bikeKm)} km bike · {formatNumber(s.runKm)} km run
              </div>
              <div className="mt-3"><ZoneBar zones={s.intensity.zones} height={6} /></div>
              <div className="mt-1 text-[11px] text-muted">Modelo: {s.intensity.model}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4">
          <Stat label="Fitness (CTL)" value={formatNumber(status[0].ctl ?? NaN)} size="sm" />
          <Stat label="Fatigue (ATL)" value={formatNumber(status[0].atl ?? NaN)} size="sm" />
          <Stat label="Form (TSB)" value={`${(status[0].tsb ?? 0) > 0 ? '+' : ''}${formatNumber(status[0].tsb ?? NaN)}`} size="sm" />
        </div>
      </Card>

      {/* KPIs */}
      <div>
        <div className="eyebrow mb-2 mt-2">KPIs · atual vs anterior</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {allKpis.map((k) => <KpiCard key={k.key} k={k} />)}
        </div>
      </div>
    </div>
  );
}

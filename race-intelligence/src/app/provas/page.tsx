import Link from 'next/link';
import { getDataset } from '@/lib/data/repository';
import { analyzeRace } from '@/lib/analytics/insights';
import { DISTANCE_LABEL, isTriathlon } from '@/lib/domain/race-meta';
import { formatDate, formatDuration, formatPace100, formatPaceKm, formatSpeed } from '@/lib/domain/time';
import type { RaceDistance } from '@/lib/domain/types';
import { Badge, Card, Chip, Empty, PageHeader } from '@/components/ui';
import { LineChart } from '@/components/charts';
import { SplitStrip } from '@/components/race-viz';
import { DataBanner } from '@/components/data-banner';

const FILTERS: { key: string; label: string; match: (d: RaceDistance) => boolean }[] = [
  { key: 'all', label: 'Todas', match: () => true },
  { key: '70.3', label: '70.3', match: (d) => d === '70.3' },
  { key: 'full', label: 'Full', match: (d) => d === 'full' },
  { key: 'olympic', label: 'Olímpico', match: (d) => d === 'olympic' },
  { key: 'sprint', label: 'Sprint', match: (d) => d === 'sprint' },
  { key: 'run', label: 'Corrida', match: (d) => !isTriathlon(d) },
];

export default async function RacesPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f = 'all' } = await searchParams;
  const ds = await getDataset();
  const filter = FILTERS.find((x) => x.key === f) ?? FILTERS[0];
  const rows = ds.races
    .filter((r) => filter.match(r.distance))
    .map((race) => ({ race, a: analyzeRace(ds, race.id)! }))
    .sort((x, y) => y.race.date.localeCompare(x.race.date));
  const done = rows.filter((r) => r.a.me).reverse();

  // Provas detectadas no Strava ainda não cadastradas (agrupadas por dia).
  const raceDates = new Set(ds.races.map((r) => r.date));
  const detected = new Map<string, typeof ds.activities>();
  for (const a of ds.activities) {
    if (a.keySession !== 'race' || a.source === 'mock') continue;
    const d = a.date.slice(0, 10);
    if (raceDates.has(d)) continue;
    detected.set(d, [...(detected.get(d) ?? []), a]);
  }
  const suggestions = [...detected.entries()].sort((x, y) => y[0].localeCompare(x[0])).map(([date, acts]) => {
    const pick = (t: string[]) => acts.find((a) => t.includes(a.type));
    const swim = pick(['swim', 'open_water_swim']);
    const bike = pick(['ride', 'virtual_ride']);
    const run = pick(['run']);
    const q = new URLSearchParams({ date, name: (run ?? bike ?? swim ?? acts[0]).name.split('\n')[0].slice(0, 80) });
    if (swim) q.set('swim', formatDuration(swim.movingTimeS));
    if (bike) q.set('bike', formatDuration(bike.movingTimeS));
    if (run) q.set('run', formatDuration(run.movingTimeS));
    return { date, acts, href: `/provas/nova?${q}` };
  });

  return (
    <div>
      <DataBanner ds={ds} />
      <PageHeader eyebrow="Race history" title="Provas" subtitle="Todas as provas, com posição e percentil relativos ao field de cada edição."
        action={<Link href="/provas/nova" className="rounded-xl bg-ink px-4 py-2 text-sm font-medium text-white">+ Cadastrar prova</Link>} />

      {suggestions.length > 0 && (
        <Card className="mb-4" eyebrow="Detectadas no Strava" title="Provas para cadastrar com o resultado oficial">
          <ul className="divide-y divide-line">
            {suggestions.map((s) => (
              <li key={s.date} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="text-xs text-muted">{formatDate(s.date)}</div>
                  <div className="truncate font-medium">{s.acts.map((a) => a.name.split('\n')[0]).join(' · ')}</div>
                  <div className="num text-xs text-ink-2">{s.acts.map((a) => `${a.type === 'run' ? 'Run' : a.type.includes('swim') ? 'Swim' : 'Bike'} ${formatDuration(a.movingTimeS)}`).join(' · ')}</div>
                </div>
                <Link href={s.href} className="rounded-xl border border-line px-3 py-1.5 text-xs font-medium hover:border-ink">Cadastrar →</Link>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted">Sem o field da categoria não há posição, percentil nem gap — cole a tabela oficial ao cadastrar.</p>
        </Card>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((x) => <Chip key={x.key} href={`/provas?f=${x.key}`} active={x.key === filter.key}>{x.label}</Chip>)}
      </div>

      {done.length >= 2 && (
        <div className="mb-4 grid gap-3 lg:grid-cols-2">
          <Card eyebrow="Evolução relativa" title="Percentil na categoria">
            <LineChart height={160} invert showDots xFormat="year_month" yFormat="top_pct"
              series={[{ name: 'Percentil', color: 'var(--ink)', points: done.map((r) => ({ x: r.race.date, y: r.a.percentile! * 100, label: r.race.name })) }]} />
          </Card>
          <Card eyebrow="Evolução relativa" title="Percentil do split por modalidade">
            <LineChart height={160} invert showDots xFormat="year_month" yFormat="top_pct"
              series={(['swim', 'bike', 'run'] as const).map((k) => ({
                name: k === 'swim' ? 'Swim' : k === 'bike' ? 'Bike' : 'Run',
                color: `var(--${k})`,
                points: done.filter((r) => isTriathlon(r.race.distance) && r.a.splitRanks).map((r) => ({ x: r.race.date, y: (r.a.splitRanks![k] / r.a.n) * 100, label: r.race.name })),
              }))} />
          </Card>
        </div>
      )}

      {rows.length === 0 ? (
        <Empty>Nenhuma prova neste filtro.</Empty>
      ) : (
        <ol className="relative space-y-3 border-l border-line pl-4 sm:pl-6">
          {rows.map(({ race, a }) => (
            <li key={race.id} className="relative">
              <span className="absolute -left-[21px] top-5 h-2.5 w-2.5 rounded-full border-2 border-bg bg-ink sm:-left-[29px]" />
              <Link href={`/provas/${race.id}`} className="block rounded-2xl border border-line bg-surface p-4 transition hover:border-ink-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span>{formatDate(race.date)}</span>
                      <span>·</span>
                      <span className="font-medium text-ink-2">{DISTANCE_LABEL[race.distance]}</span>
                      {race.provenance === 'mock' && <Badge kind="mock" />}
                      {race.slots && <Badge kind={race.slots.provenance}>{race.slots.provenance === 'official' ? 'Vagas oficiais' : 'Vagas estimadas'}</Badge>}
                    </div>
                    <div className="mt-0.5 truncate text-base font-semibold">{race.name}</div>
                  </div>
                  {a.me ? (
                    <div className="flex items-end gap-5 text-right">
                      <div>
                        <div className="num text-xl font-semibold">{formatDuration(a.me.totalS)}</div>
                        <div className="text-[11px] text-muted">tempo</div>
                      </div>
                      <div>
                        <div className="num text-xl font-semibold">P{a.rank}<span className="text-xs font-normal text-muted">/{a.n}</span></div>
                        <div className="text-[11px] text-muted">Top {Math.round(a.percentile! * 100)}%</div>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-muted">{race.date > ds.today ? 'Futura' : 'Sem meu resultado'}</span>
                  )}
                </div>
                {a.me && isTriathlon(race.distance) && (
                  <div className="mt-3">
                    <SplitStrip splits={a.me.splits} />
                    <div className="num mt-2 grid grid-cols-3 gap-2 text-xs text-ink-2">
                      <span>Swim <b className="text-ink">{formatDuration(a.me.splits.swim)}</b> · {formatPace100(a.pace!.swim100)}</span>
                      <span>Bike <b className="text-ink">{formatDuration(a.me.splits.bike)}</b> · {formatSpeed(a.pace!.bikeKmh)}</span>
                      <span>Run <b className="text-ink">{formatDuration(a.me.splits.run)}</b> · {formatPaceKm(a.pace!.runKm)}</span>
                    </div>
                  </div>
                )}
                {a.me && !isTriathlon(race.distance) && (
                  <div className="num mt-2 text-xs text-ink-2">Pace {formatPaceKm(a.pace!.runKm)}</div>
                )}
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

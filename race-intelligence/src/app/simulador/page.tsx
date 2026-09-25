import { getDataset } from '@/lib/data/repository';
import { analyzeRace, latestKeyRace } from '@/lib/analytics/insights';
import { isTriathlon } from '@/lib/domain/race-meta';
import { Chip, Empty, PageHeader } from '@/components/ui';
import { DataBanner } from '@/components/data-banner';
import { Simulator } from './simulator';

export default async function SimulatorPage({ searchParams }: { searchParams: Promise<{ race?: string }> }) {
  const sp = await searchParams;
  const ds = await getDataset();
  const options = ds.races.filter((r) => isTriathlon(r.distance) && r.date <= ds.today && ds.results.some((x) => x.raceId === r.id && x.isMe)).reverse();
  const selectedId = options.find((r) => r.id === sp.race)?.id ?? latestKeyRace(ds)?.race.id ?? options[0]?.id;
  const a = selectedId ? analyzeRace(ds, selectedId) : undefined;
  const goals = Object.fromEntries(ds.athlete.goals.map((g) => [g.metric, g.target]));

  return (
    <div>
      <DataBanner ds={ds} />
      <PageHeader eyebrow="What if?" title="Simulador de prova" subtitle="Mude paces, velocidade ou watts e veja onde você teria terminado — contra o field REAL daquela edição." />
      <div className="mb-4 flex flex-wrap gap-2">
        {options.map((r) => <Chip key={r.id} href={`/simulador?race=${r.id}`} active={r.id === selectedId}>{r.name.replace('IRONMAN ', '')} {r.date.slice(0, 4)}</Chip>)}
      </div>
      {a?.me && a.pace ? (
        <Simulator
          key={a.race.id}
          race={{ id: a.race.id, name: a.race.name, course: a.race.course, myBikePowerW: a.race.myBikePowerW }}
          me={{ splits: a.me.splits, totalS: a.me.totalS, rank: a.rank!, pace: a.pace }}
          field={a.field.map((r) => ({ id: r.id, athleteName: r.athleteName, splits: r.splits, totalS: r.totalS, isMe: r.isMe, competitorId: r.competitorId, raceId: r.raceId, category: r.category, sex: r.sex, status: r.status }))}
          p5={a.benchmarks.find((b) => b.key === 'P5')?.splits}
          lastSlot={a.benchmarks.find((b) => b.key === 'LAST_SLOT')}
          goals={{ swim: goals.swim_pace_100m, bike: goals.bike_speed_kmh, run: goals.run_pace_km }}
          weightKg={ds.athlete.weightKg}
        />
      ) : (
        <Empty>Cadastre uma prova de triathlon com seu resultado para simular.</Empty>
      )}
    </div>
  );
}

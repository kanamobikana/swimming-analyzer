import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDataset } from '@/lib/data/repository';
import { headToHead } from '@/lib/analytics/head-to-head';
import { categoryField, BUCKET_LABEL, GAP_BUCKETS } from '@/lib/analytics/race';
import { DISTANCE_LABEL } from '@/lib/domain/race-meta';
import { formatDate, formatDuration, formatGap } from '@/lib/domain/time';
import { toggleTracked } from '@/app/actions';
import { Button, Card, cx, DisciplineDot, PageHeader, Stat } from '@/components/ui';
import { LineChart } from '@/components/charts';

export default async function CompetitorPage({ params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id);
  const ds = await getDataset();
  const rows = ds.results.filter((r) => r.competitorId === id);
  if (!rows.length) notFound();
  const c = ds.competitors.find((x) => x.id === id);
  const name = c?.name ?? rows[0].athleteName;
  const tracked = ds.trackedCompetitorIds.includes(id);
  const h = headToHead(ds.races, ds.results, id);
  const history = rows
    .map((r) => {
      const race = ds.races.find((x) => x.id === r.raceId)!;
      const field = categoryField(ds.results.filter((x) => x.raceId === r.raceId), race.category);
      const rank = field.findIndex((x) => x.id === r.id) + 1;
      return { race, r, rank, n: field.length };
    })
    .sort((a, b) => b.race.date.localeCompare(a.race.date));
  const action = toggleTracked.bind(null, id);

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted"><Link href="/atletas" className="hover:text-ink">← Rivais</Link></div>
      <PageHeader eyebrow={`Competitor history · ${c?.category ?? rows[0].category}${c?.country ? ` · ${c.country}` : ''}`} title={`Você vs ${name}`}
        action={<form action={action}><Button variant="ghost">{tracked ? '★ Acompanhando' : '☆ Acompanhar'}</Button></form>} />

      {h.races.length > 0 && (
        <>
          <Card eyebrow="Head-to-head">
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
              <Stat label="Confrontos" value={h.races.length} size="lg" />
              <Stat label="Vitórias – derrotas" value={`${h.wins}–${h.losses}`} size="lg" />
              <Stat label="Gap médio" value={formatGap(h.avgGap.total)} size="lg" tone={h.avgGap.total > 0 ? 'bad' : 'good'} />
              <Stat label="Evolução do gap" value={h.races.length >= 2 ? `${formatGap(h.gapTrendSPerYear)}/ano` : '—'} size="lg" sub={h.gapTrendSPerYear < 0 ? 'fechando o gap' : h.gapTrendSPerYear > 0 ? 'abrindo o gap' : undefined} />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-4">
              {GAP_BUCKETS.map((b) => (
                <div key={b}>
                  <div className="flex items-center gap-1.5 text-xs text-ink-2"><DisciplineDot bucket={b} />{BUCKET_LABEL[b]}</div>
                  <div className={cx('num mt-1 text-lg font-semibold', h.avgGap[b] > 0 ? 'text-bad' : 'text-good')}>{formatGap(h.avgGap[b])}</div>
                  <div className="text-[11px] text-muted">{h.avgGap[b] > 5 ? 'você perde aqui' : h.avgGap[b] < -5 ? 'você ganha aqui' : 'empate técnico'}</div>
                </div>
              ))}
            </div>
          </Card>
          {h.races.length >= 2 && (
            <Card eyebrow="Evolução do gap" title="Gap total por confronto (positivo = você atrás)">
              <LineChart height={160} xFormat="year_month" yFormat="duration" series={[{ name: 'Gap', color: 'var(--accent)', points: h.races.map((x) => ({ x: x.race.date, y: x.gap.total, label: x.race.name })) }]} />
            </Card>
          )}
          <Card eyebrow="Confrontos">
            <div className="-mx-4 overflow-x-auto px-4">
              <table className="w-full min-w-[620px] text-sm">
                <thead><tr className="text-left text-[11px] uppercase tracking-wide text-muted"><th className="py-2 font-medium">Prova</th><th className="py-2 text-right font-medium">Você</th><th className="py-2 text-right font-medium">{name}</th>{GAP_BUCKETS.map((b) => <th key={b} className="py-2 text-right font-medium">{BUCKET_LABEL[b]}</th>)}<th className="py-2 text-right font-medium">Total</th></tr></thead>
                <tbody className="num">
                  {h.races.map((x) => (
                    <tr key={x.race.id} className="border-t border-line">
                      <td className="py-2 font-sans"><Link href={`/provas/${x.race.id}`} className="hover:text-accent">{x.race.name}</Link><div className="text-[11px] text-muted">{formatDate(x.race.date)}</div></td>
                      <td className="py-2 text-right">{formatDuration(x.me.totalS)}</td>
                      <td className="py-2 text-right">{formatDuration(x.them.totalS)}</td>
                      {GAP_BUCKETS.map((b) => <td key={b} className={cx('py-2 text-right', x.gap[b] > 0 ? 'text-ink' : 'text-good')}>{formatGap(x.gap[b])}</td>)}
                      <td className={cx('py-2 text-right font-semibold', x.gap.total > 0 ? 'text-bad' : 'text-good')}>{formatGap(x.gap.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <Card eyebrow="Provas públicas" title={`Resultados de ${name}`}>
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[480px] text-sm">
            <thead><tr className="text-left text-[11px] uppercase tracking-wide text-muted"><th className="py-2 font-medium">Prova</th><th className="py-2 font-medium">Distância</th><th className="py-2 text-right font-medium">Tempo</th><th className="py-2 text-right font-medium">Categoria</th></tr></thead>
            <tbody className="num">
              {history.map((x) => (
                <tr key={x.r.id} className="border-t border-line">
                  <td className="py-2 font-sans">{x.race.name}<div className="text-[11px] text-muted">{formatDate(x.race.date)}</div></td>
                  <td className="py-2 font-sans">{DISTANCE_LABEL[x.race.distance]}</td>
                  <td className="py-2 text-right">{x.r.status === 'finisher' ? formatDuration(x.r.totalS) : x.r.status.toUpperCase()}</td>
                  <td className="py-2 text-right">{x.rank > 0 ? `P${x.rank}/${x.n}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-muted">Somente informações publicadas em resultados oficiais. Nada é inferido sobre a pessoa além disso.</p>
      </Card>
    </div>
  );
}

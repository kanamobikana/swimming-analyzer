import Link from 'next/link';
import { getDataset } from '@/lib/data/repository';
import { headToHead } from '@/lib/analytics/head-to-head';
import { formatGap } from '@/lib/domain/time';
import { Card, cx, Empty, PageHeader } from '@/components/ui';
import { DataBanner } from '@/components/data-banner';

export default async function AthletesPage() {
  const ds = await getDataset();
  // Rivais frequentes: quem esteve em ≥ 2 provas comigo.
  const counts = new Map<string, number>();
  const myRaces = new Set(ds.results.filter((r) => r.isMe).map((r) => r.raceId));
  for (const r of ds.results) if (!r.isMe && myRaces.has(r.raceId) && r.status === 'finisher') counts.set(r.competitorId, (counts.get(r.competitorId) ?? 0) + 1);
  const ids = [...new Set([...ds.trackedCompetitorIds, ...[...counts.entries()].filter(([, n]) => n >= 2).map(([id]) => id)])];
  const rows = ids
    .map((id) => {
      const c = ds.competitors.find((x) => x.id === id);
      const h = headToHead(ds.races, ds.results, id);
      return { id, name: c?.name ?? ds.results.find((r) => r.competitorId === id)?.athleteName ?? id, tracked: ds.trackedCompetitorIds.includes(id), h };
    })
    .filter((r) => r.h.races.length > 0)
    .sort((a, b) => Number(b.tracked) - Number(a.tracked) || b.h.races.length - a.h.races.length);

  return (
    <div>
      <DataBanner ds={ds} />
      <PageHeader eyebrow="Athlete benchmarking" title="Rivais da categoria" subtitle="Atletas acompanhados e adversários recorrentes, com histórico de confrontos. Só dados públicos de resultados." />
      {rows.length === 0 ? (
        <Empty>Nenhum confronto ainda — importe resultados completos das provas.</Empty>
      ) : (
        <Card>
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wide text-muted"><th className="py-2 font-medium">Atleta</th><th className="py-2 text-right font-medium">Confrontos</th><th className="py-2 text-right font-medium">V–D</th><th className="py-2 text-right font-medium">Gap médio</th><th className="py-2 text-right font-medium">Tendência/ano</th></tr></thead>
              <tbody className="num">
                {rows.slice(0, 40).map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className="py-2 font-sans"><Link href={`/atletas/${encodeURIComponent(r.id)}`} className="font-medium hover:text-accent">{r.name}</Link>{r.tracked && <span className="ml-2 text-[10px] font-semibold uppercase text-accent">acompanhado</span>}</td>
                    <td className="py-2 text-right">{r.h.races.length}</td>
                    <td className="py-2 text-right">{r.h.wins}–{r.h.losses}</td>
                    <td className={cx('py-2 text-right', r.h.avgGap.total > 0 ? 'text-bad' : 'text-good')}>{formatGap(r.h.avgGap.total)}</td>
                    <td className="py-2 text-right text-ink-2">{r.h.races.length >= 2 ? formatGap(r.h.gapTrendSPerYear) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-muted">Gap positivo = você chegou atrás. Tendência negativa = você está fechando o gap.</p>
        </Card>
      )}
    </div>
  );
}

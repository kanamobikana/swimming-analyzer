import Link from 'next/link';
import { getDataset } from '@/lib/data/repository';
import { currentCategory, qualificationStatus } from '@/lib/analytics/insights';
import { BUCKET_LABEL, GAP_BUCKETS } from '@/lib/analytics/race';
import { daysBetween, formatDate, formatDuration, formatGap } from '@/lib/domain/time';
import { categoryTimeline } from '@/lib/domain/race-meta';
import { Badge, Card, cx, DisciplineDot, PageHeader, Stat } from '@/components/ui';
import { LineChart } from '@/components/charts';
import { WhereAreTheMinutes } from '@/components/race-viz';
import { DataBanner } from '@/components/data-banner';

export default async function WorldsPage() {
  const ds = await getDataset();
  const q = qualificationStatus(ds);
  const cat = currentCategory(ds);
  const a = ds.athlete;
  const timeline = categoryTimeline(a.birthDate, a.sex, Number(ds.today.slice(0, 4)) - 1, 6);
  const trendRows = [...q.rows].filter((r) => r.gapS != null).reverse();
  const daysLeft = daysBetween(ds.today, a.targetRaceDate);

  return (
    <div className="space-y-4">
      <DataBanner ds={ds} />
      <PageHeader eyebrow="Road to Worlds" title="Qualificação para o Mundial"
        subtitle="Resultado esportivo, estimativa e informação oficial de slot allocation aparecem sempre separados. Posição na categoria não é vaga garantida." />

      <div className="grid gap-3 lg:grid-cols-3">
        <Card eyebrow="Prova-alvo" title={a.targetRaceName}>
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Dias restantes" value={daysLeft} size="lg" sub={formatDate(a.targetRaceDate)} />
            <Stat label="Categoria na prova" value={cat.atTarget} size="lg" sub={`hoje ${cat.now}`} />
          </div>
          <p className="mt-3 text-xs text-ink-2">{a.mainGoal}</p>
        </Card>
        <Card className="lg:col-span-2" eyebrow={<span className="flex items-center gap-2">Qualification gap {q.provenance !== 'none' && <Badge kind={q.provenance} />}</span>} title={q.referenceRace?.name}>
          {q.gap && q.me && q.benchmark ? (
            <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
              <div className="space-y-3">
                <Stat label="Meu resultado" value={formatDuration(q.me.totalS)} sub={`P${q.me.categoryRank}`} />
                <Stat label="Benchmark de classificação" value={formatDuration(q.benchmark.totalS)} sub={`${q.benchmark.label} · P${q.benchmark.rank}`} />
              </div>
              <WhereAreTheMinutes gap={q.gap} benchLabel="a vaga" compact />
            </div>
          ) : (
            <p className="text-sm text-muted">{q.explanation}</p>
          )}
          <p className="mt-3 text-[11px] text-muted">{q.explanation}</p>
        </Card>
      </div>

      {trendRows.length >= 2 && (
        <Card eyebrow="Tendência" title="Gap para a última vaga, prova a prova">
          <LineChart height={170} xFormat="year_month" yFormat="duration" yDomain={[0, Math.max(...trendRows.map((r) => r.gapS!)) * 1.2]}
            series={[{ name: 'Gap', color: 'var(--accent)', points: trendRows.map((r) => ({ x: r.race.date, y: r.gapS!, label: `${r.race.name} (${r.provenance === 'official' ? 'oficial' : 'estimado'})` })) }]} />
          <p className="mt-1 text-[11px] text-muted">Zero = no nível da vaga. Cada ponto usa o field e as vagas daquela edição.</p>
        </Card>
      )}

      <Card eyebrow="Provas com vagas" title="Histórico de classificação">
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="py-2 font-medium">Prova</th>
                <th className="py-2 font-medium">Resultado esportivo</th>
                <th className="py-2 text-right font-medium">Vagas cat.</th>
                <th className="py-2 text-right font-medium">Última vaga</th>
                <th className="py-2 text-right font-medium">Tempo últ. vaga</th>
                <th className="py-2 text-right font-medium">Meu gap</th>
                <th className="py-2 pl-4 font-medium">Fonte</th>
              </tr>
            </thead>
            <tbody className="num">
              {q.rows.map((r) => (
                <tr key={r.race.id} className="border-t border-line">
                  <td className="py-2 font-sans"><Link href={`/provas/${r.race.id}?vs=LAST_SLOT`} className="font-medium hover:text-accent">{r.race.name}</Link><div className="text-[11px] text-muted">{formatDate(r.race.date)}</div></td>
                  <td className="py-2">{r.sportingResult}</td>
                  <td className="py-2 text-right">{r.categorySlots ?? '—'}</td>
                  <td className="py-2 text-right">{r.lastQualifierRank ? `P${r.lastQualifierRank}` : '—'}</td>
                  <td className="py-2 text-right">{r.lastQualifierTimeS ? formatDuration(r.lastQualifierTimeS) : '—'}</td>
                  <td className={cx('py-2 text-right font-semibold', (r.gapS ?? 0) > 0 ? 'text-bad' : 'text-good')}>{r.gapS != null ? formatGap(r.gapS) : '—'}</td>
                  <td className="py-2 pl-4"><Badge kind={r.provenance} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 grid gap-2 text-[11px] text-muted sm:grid-cols-3">
          <div><b className="text-ink-2">Resultado esportivo</b> — posição real na categoria (fato).</div>
          <div><b className="text-ink-2">Oficial</b> — vagas e último classificado pela lista publicada (inclui rolldown).</div>
          <div><b className="text-ink-2">Estimativa</b> — vagas prováveis sem lista oficial. Não confirmar vaga com base nisso.</div>
        </div>
      </Card>

      {q.gap && (
        <Card eyebrow="Plano de fechamento" title="O que precisa mudar por modalidade">
          <div className="grid gap-3 sm:grid-cols-4">
            {GAP_BUCKETS.map((b) => {
              const g = q.gap!.byBucket[b];
              return (
                <div key={b} className="rounded-xl bg-surface-2 p-3.5">
                  <div className="flex items-center gap-1.5 text-xs text-ink-2"><DisciplineDot bucket={b} />{BUCKET_LABEL[b]}</div>
                  <div className={cx('num mt-1 text-xl font-semibold', g > 0 ? 'text-bad' : 'text-good')}>{formatGap(g)}</div>
                  <div className="mt-1 text-[11px] text-muted">{g > 0 ? `${formatDuration(g / Math.max(1, Math.floor(daysLeft / 7)))} por semana até a prova` : 'já no nível da vaga'}</div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-ink-2">Simule combinações de pace/watts contra o field real no <Link href="/simulador" className="font-medium text-accent">What-if Simulator →</Link></p>
        </Card>
      )}

      <Card eyebrow="Categoria por idade" title={`${cat.now} → ${cat.next} em ${cat.changesInYear}`}>
        <div className="flex flex-wrap gap-2">
          {timeline.map((t) => (
            <div key={t.year} className={cx('rounded-xl border px-3 py-2 text-center', t.changed ? 'border-accent bg-accent-soft' : 'border-line')}>
              <div className="num text-xs text-muted">{t.year}</div>
              <div className="text-sm font-semibold">{t.category}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted">Regra IRONMAN: vale a idade em 31/12 do ano da prova. Mudar de faixa costuma aliviar o benchmark de classificação — vale planejar o calendário em função disso.</p>
      </Card>
    </div>
  );
}

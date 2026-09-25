import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDataset } from '@/lib/data/repository';
import { analyzeRace, raceReport } from '@/lib/analytics/insights';
import { BENCHMARK_KEYS, BENCHMARK_LABEL, BUCKET_LABEL, GAP_BUCKETS } from '@/lib/analytics/race';
import { DISTANCE_LABEL, isTriathlon } from '@/lib/domain/race-meta';
import type { BenchmarkKey } from '@/lib/domain/types';
import { formatDate, formatDuration, formatGap, formatNumber, formatPace100, formatPaceKm, formatSpeed } from '@/lib/domain/time';
import { Badge, Card, Chip, cx, DisciplineDot, PageHeader, Stat } from '@/components/ui';
import { PositionFlow, WhereAreTheMinutes, ZoneBar } from '@/components/race-viz';
import { SlotsForm } from './slots-form';

export default async function RacePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ vs?: string; all?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ds = await getDataset();
  const vs = (BENCHMARK_KEYS.includes(sp.vs as BenchmarkKey) ? sp.vs : 'P5') as BenchmarkKey;
  const a = analyzeRace(ds, id, vs, { deep: true });
  if (!a) notFound();
  const { race, me, field } = a;
  const tri = isTriathlon(race.distance);
  const report = raceReport(a);
  const isUserRace = race.provenance !== 'mock';

  // Tabela: top 25 + vizinhança do atleta (ou tudo com ?all=1).
  const showAll = sp.all === '1';
  const myIdx = me ? field.findIndex((r) => r.isMe) : -1;
  const visible = showAll ? field : field.filter((_, i) => i < 25 || Math.abs(i - myIdx) <= 3);

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted"><Link href="/provas" className="hover:text-ink">← Provas</Link></div>
      <PageHeader
        eyebrow={`${formatDate(race.date)} · ${race.location} · ${DISTANCE_LABEL[race.distance]} · ${race.category}`}
        title={race.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge kind={race.provenance} />
            {[race.conditions.weather, race.conditions.airTempC != null && `${race.conditions.airTempC}°C`, race.conditions.windKmh != null && `vento ${race.conditions.windKmh} km/h`, race.conditions.waterTempC != null && `água ${race.conditions.waterTempC}°C`, race.conditions.wetsuitAllowed != null && (race.conditions.wetsuitAllowed ? 'com wetsuit' : 'sem wetsuit')].filter(Boolean).join(' · ')}
            {race.resultsUrl && <a href={race.resultsUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">resultados oficiais ↗</a>}
          </span>
        }
      />

      {!me ? (
        <Card><p className="text-sm text-ink-2">Seu resultado não foi encontrado nesta prova. Confira nome/nº de peito ou cadastre o resultado manualmente.</p></Card>
      ) : (
        <>
          {/* Resultado */}
          <Card eyebrow="Resultado">
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
              <Stat label="Tempo" value={formatDuration(me.totalS)} size="lg" />
              <Stat label="Categoria" value={<>P{a.rank}<span className="text-base font-normal text-muted">/{a.n}</span></>} size="lg" sub={me.overallRank ? `Geral P${me.overallRank}` : undefined} />
              <Stat label="Percentil" value={`Top ${Math.round(a.percentile! * 100)}%`} size="lg" sub={a.adjustedPercentile != null ? `Ajustado ao field: Top ${Math.round(a.adjustedPercentile * 100)}% (est.)` : undefined} />
              <Stat label={<span className="flex items-center gap-1.5">Força do field <Badge kind="estimate" /></span>} value={a.strength ? a.strength.index : '—'} size="lg" sub={a.strength ? `confiança ${a.strength.confidence} · 100 = típico` : 'field pequeno'} />
            </div>
            {tri && (
              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-5">
                {[
                  { k: 'swim' as const, l: 'Swim', v: me.splits.swim, p: formatPace100(a.pace!.swim100) },
                  { k: 't1' as const, l: 'T1', v: me.splits.t1 },
                  { k: 'bike' as const, l: 'Bike', v: me.splits.bike, p: formatSpeed(a.pace!.bikeKmh) },
                  { k: 't2' as const, l: 'T2', v: me.splits.t2 },
                  { k: 'run' as const, l: 'Run', v: me.splits.run, p: formatPaceKm(a.pace!.runKm) },
                ].map((s) => (
                  <div key={s.k}>
                    <div className="eyebrow">{s.l}</div>
                    <div className="num mt-1 text-lg font-semibold">{formatDuration(s.v)}</div>
                    <div className="num text-xs text-ink-2">{s.p ?? ' '}{a.splitRanks && <span className="text-muted"> · {a.splitRanks[s.k]}º</span>}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Benchmark */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-2">Compare com:</span>
            {a.benchmarks.map((b) => <Chip key={b.key} href={`/provas/${id}?vs=${b.key}`} active={b.key === a.selected?.key}>{b.key === 'LAST_SLOT' ? b.label : BENCHMARK_LABEL[b.key]}</Chip>)}
          </div>

          <div className="grid gap-3 lg:grid-cols-5">
            <Card className="lg:col-span-3" eyebrow="Where are the minutes?" title={a.gap && a.selected ? `Você terminou ${formatDuration(Math.abs(a.gap.totalS))} ${a.gap.totalS >= 0 ? 'atrás do' : 'à frente do'} ${a.selected.label}` : undefined}>
              {a.gap && a.selected && <WhereAreTheMinutes gap={a.gap} benchLabel={`${a.selected.label} (${a.selected.athleteName}, ${formatDuration(a.selected.totalS)})`} />}
            </Card>
            <Card className="lg:col-span-2" eyebrow="Posição após cada modalidade">
              {a.ranksAfter && tri ? <PositionFlow ranks={a.ranksAfter} n={a.n} /> : <p className="text-sm text-muted">Só para triathlon.</p>}
              {a.opportunities && (
                <div className="mt-5 border-t border-line pt-4">
                  <div className="eyebrow mb-2">Time gain opportunities</div>
                  <div className="space-y-2">
                    {a.opportunities.items.map((o) => (
                      <div key={o.bucket} className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex items-center gap-1.5"><DisciplineDot bucket={o.bucket} />{BUCKET_LABEL[o.bucket]}</span>
                        <span className="text-[11px] text-muted">confiança {o.confidence}</span>
                        <span className="num w-14 text-right font-semibold">{formatDuration(o.potentialS)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t border-line pt-2 text-sm font-semibold"><span>Total potencial</span><span className="num">{formatDuration(a.opportunities.totalS)}</span></div>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted">Base: mediana de quem terminou 2–10% à frente ({a.opportunities.peerCount} atletas), limitada pelo ganho treinável até a prova-alvo e ajustada pela sua tendência histórica.</p>
                </div>
              )}
            </Card>
          </div>

          {/* Benchmarks table */}
          <Card eyebrow="Análise da categoria" title="Você vs benchmarks">
            <div className="-mx-4 overflow-x-auto px-4">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                    <th className="py-2 font-medium">Benchmark</th>
                    <th className="py-2 text-right font-medium">Tempo</th>
                    <th className="py-2 text-right font-medium">Gap</th>
                    {tri && GAP_BUCKETS.map((b) => <th key={b} className="py-2 text-right font-medium">{BUCKET_LABEL[b]}</th>)}
                  </tr>
                </thead>
                <tbody className="num">
                  {a.benchmarks.map((b) => {
                    const g = a.gapsByKey[b.key]!;
                    return (
                      <tr key={b.key} className={cx('border-t border-line', b.key === a.selected?.key && 'bg-surface-2')}>
                        <td className="py-2 font-medium">{b.label} <span className="text-xs font-normal text-muted">{b.rank ? `P${b.rank}` : ''}</span></td>
                        <td className="py-2 text-right">{formatDuration(b.totalS)}</td>
                        <td className={cx('py-2 text-right font-semibold', g.totalS > 0 ? 'text-bad' : 'text-good')}>{formatGap(g.totalS)}</td>
                        {tri && GAP_BUCKETS.map((k) => <td key={k} className={cx('py-2 text-right', g.byBucket[k] > 0 ? 'text-ink' : 'text-good')}>{formatGap(g.byBucket[k])}</td>)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Relatório */}
          {report && (
            <Card eyebrow="Race Performance Report" title={report.headline}>
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <div className="eyebrow mb-2">Where I lost time</div>
                  <ul className="space-y-1.5 text-sm">{report.lostTime.length ? report.lostTime.map((x) => <li key={x} className="flex gap-2"><span className="text-bad">▲</span>{x}</li>) : <li className="text-muted">Sem perdas relevantes vs P5.</li>}</ul>
                </div>
                <div>
                  <div className="eyebrow mb-2">Where I gained time</div>
                  <ul className="space-y-1.5 text-sm">{report.gainedTime.length ? report.gainedTime.map((x) => <li key={x} className="flex gap-2"><span className="text-good">▼</span>{x}</li>) : <li className="text-muted">—</li>}</ul>
                </div>
                {report.biggestOpportunity && (
                  <div className="md:col-span-2 rounded-xl bg-accent-soft p-3.5 text-sm">
                    <div className="eyebrow mb-1 text-accent">Biggest opportunity</div>
                    {report.biggestOpportunity}
                  </div>
                )}
                <div>
                  <div className="eyebrow mb-2">Training implications</div>
                  <ul className="list-disc space-y-1.5 pl-4 text-sm">{report.trainingImplications.map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
                <div>
                  <div className="eyebrow mb-2">Next race focus</div>
                  <ul className="list-disc space-y-1.5 pl-4 text-sm">{report.nextRaceFocus.length ? report.nextRaceFocus.map((x) => <li key={x}>{x}</li>) : <li className="text-muted">Manter o que funcionou.</li>}</ul>
                </div>
              </div>
            </Card>
          )}

          {/* Treino → resultado */}
          {a.windows && (
            <Card eyebrow="Treino → resultado" title="Preparação antes da prova" action={ds.meta.activitiesSource === 'mock' ? <Badge kind="mock" /> : undefined}>
              <div className="grid gap-3 md:grid-cols-3">
                {a.windows.map((w) => (
                  <div key={w.days} className="rounded-xl bg-surface-2 p-3.5 text-sm">
                    <div className="eyebrow">{w.days} dias antes</div>
                    <div className="num mt-1 text-2xl font-semibold">{formatNumber(w.avgWeeklyHours, 1)} h<span className="text-xs font-normal text-muted">/sem</span></div>
                    <div className="num mt-2 space-y-0.5 text-xs text-ink-2">
                      <div>{formatNumber(w.swimMPerWeek)} m swim · {formatNumber(w.bikeKmPerWeek)} km bike · {formatNumber(w.runKmPerWeek)} km run /sem</div>
                      <div>{w.longRuns} longões · {w.longRides} pedais longos · {w.bricks} bricks</div>
                      {w.plannedCompliance != null && <div>{Math.round(w.plannedCompliance * 100)}% das sessões planejadas ({w.missedSessions} perdidas)</div>}
                      <div>CTL no dia {formatNumber(w.ctlAtRace)} · TSB {w.tsbAtRace > 0 ? '+' : ''}{formatNumber(w.tsbAtRace)}</div>
                      <div>Taper: volume das 2 últimas semanas {Math.round(w.taperDrop * 100)}% abaixo do bloco</div>
                    </div>
                    <div className="mt-3"><ZoneBar zones={w.intensity.zones} height={6} /></div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {/* Tabela da categoria */}
      <Card eyebrow={`Categoria ${race.category} · ${a.n} finishers`} title="Resultados"
        action={<Link href={`/provas/${id}?vs=${vs}${showAll ? '' : '&all=1'}`} scroll={false} className="text-xs font-medium text-accent">{showAll ? 'Resumir' : 'Ver todos'}</Link>}>
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="py-2 font-medium">Pos</th>
                <th className="py-2 font-medium">Atleta</th>
                {tri && <><th className="py-2 text-right font-medium">Swim</th><th className="py-2 text-right font-medium">T1</th><th className="py-2 text-right font-medium">Bike</th><th className="py-2 text-right font-medium">T2</th></>}
                <th className="py-2 text-right font-medium">Run</th>
                <th className="py-2 text-right font-medium">Total</th>
                <th className="py-2 text-right font-medium">Gap vs você</th>
              </tr>
            </thead>
            <tbody className="num">
              {visible.map((r, i) => {
                const prev = visible[i - 1];
                const skipped = prev && (r.categoryRank! - prev.categoryRank!) > 1;
                const gap = me ? r.totalS - me.totalS : NaN;
                const linkable = !r.isMe && ds.results.filter((x) => x.competitorId === r.competitorId).length > 1;
                return (
                  <tr key={r.id} className={cx('border-t border-line', r.isMe && 'bg-accent-soft font-semibold', skipped && 'border-t-2 border-dashed')}>
                    <td className={cx('py-2', r.isMe && 'border-l-2 border-accent pl-2')}>{r.categoryRank}</td>
                    <td className="max-w-[180px] truncate py-2 font-sans">
                      {linkable ? <Link href={`/atletas/${encodeURIComponent(r.competitorId)}`} className="hover:text-accent hover:underline">{r.athleteName}</Link> : r.isMe ? `${r.athleteName} (você)` : r.athleteName}
                      {race.slots?.lastQualifierRank && r.categoryRank! <= race.slots.lastQualifierRank && <span className="ml-1.5 text-[10px] font-semibold uppercase text-accent" title={race.slots.provenance === 'official' ? 'Vaga (oficial)' : 'Vaga (estimada)'}>{race.slots.provenance === 'official' ? 'slot' : 'slot?'}</span>}
                    </td>
                    {tri && <><td className="py-2 text-right">{formatDuration(r.splits.swim)}</td><td className="py-2 text-right text-ink-2">{formatDuration(r.splits.t1)}</td><td className="py-2 text-right">{formatDuration(r.splits.bike)}</td><td className="py-2 text-right text-ink-2">{formatDuration(r.splits.t2)}</td></>}
                    <td className="py-2 text-right">{formatDuration(r.splits.run)}</td>
                    <td className="py-2 text-right font-semibold">{formatDuration(r.totalS)}</td>
                    <td className={cx('py-2 text-right', gap < 0 ? 'text-ink' : 'text-ink-2')}>{r.isMe ? '—' : formatGap(gap)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Vagas + força do field */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card eyebrow="Road to Worlds" title="Vagas desta prova" action={race.slots && <Badge kind={race.slots.provenance} />}>
          {race.slots ? (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-muted">Campeonato</dt><dd>{race.slots.championship}</dd></div>
              <div><dt className="text-xs text-muted">Vagas na categoria</dt><dd className="num">{race.slots.categorySlots ?? '—'}{race.slots.totalSlots ? ` de ${race.slots.totalSlots}` : ''}</dd></div>
              <div><dt className="text-xs text-muted">Última posição com vaga</dt><dd className="num">{race.slots.lastQualifierRank ? `P${race.slots.lastQualifierRank}` : '—'}</dd></div>
              <div><dt className="text-xs text-muted">Tempo do último classificado</dt><dd className="num">{race.slots.lastQualifierTimeS ? formatDuration(race.slots.lastQualifierTimeS) : '—'}</dd></div>
              {race.slots.allocationRule && <div className="col-span-2"><dt className="text-xs text-muted">Critério</dt><dd>{race.slots.allocationRule}</dd></div>}
              {race.slots.sourceNote && <div className="col-span-2 text-xs text-muted">{race.slots.sourceNote}</div>}
              <div className="col-span-2 text-xs text-muted">Posição na categoria não é vaga garantida: vagas dependem de aceitação e rolldown.</div>
            </dl>
          ) : (
            <p className="text-sm text-muted">Sem informação de vagas.</p>
          )}
          {isUserRace && <SlotsForm raceId={race.id} slots={race.slots} />}
        </Card>
        <Card eyebrow="Race Strength Index" title={a.strength ? `${a.strength.index} — ${a.strength.index >= 105 ? 'field forte' : a.strength.index <= 95 ? 'field mais fraco' : 'field típico'}` : 'Field pequeno demais'} action={<Badge kind="estimate" />}>
          {a.strength && (
            <ul className="space-y-2 text-sm">
              {a.strength.components.map((c) => (
                <li key={c.label} className="flex items-baseline justify-between gap-3">
                  <span>{c.label}<span className="block text-[11px] text-muted">{c.note}</span></span>
                  <span className="num font-semibold">{Math.round(c.value)}<span className="text-xs font-normal text-muted"> ×{c.weight}</span></span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-muted">Índice estimado. Separa “P12 numa prova forte” de “P5 numa prova fraca”. Velocidade depende de percurso e clima.</p>
        </Card>
      </div>
    </div>
  );
}

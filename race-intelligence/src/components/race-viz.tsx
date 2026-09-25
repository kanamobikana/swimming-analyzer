/** Visualizações de prova renderizadas no servidor (sem estado). */
import { BUCKET_LABEL, GAP_BUCKETS, type GapBreakdown, type GapBucket } from '@/lib/analytics/race';
import { formatDuration, formatGap } from '@/lib/domain/time';
import { BUCKET_COLOR, cx, DisciplineDot } from './ui';

/**
 * WHERE ARE THE MINUTES? — uma barra empilhada com a composição do gap
 * + linhas por modalidade. A maior perda é destacada automaticamente.
 */
export function WhereAreTheMinutes({ gap, benchLabel, compact }: { gap: GapBreakdown; benchLabel: string; compact?: boolean }) {
  const losses = GAP_BUCKETS.map((b) => ({ b, s: Math.max(0, gap.byBucket[b]) }));
  const lossTotal = losses.reduce((a, x) => a + x.s, 0);
  const maxAbs = Math.max(...GAP_BUCKETS.map((b) => Math.abs(gap.byBucket[b])), 1);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <div className="eyebrow">Gap para {benchLabel}</div>
          <div className={cx('num mt-1 text-4xl font-semibold tracking-tight', gap.totalS > 0 ? 'text-ink' : 'text-good')}>{formatGap(gap.totalS)}</div>
        </div>
        {gap.biggest && (
          <div className="text-right text-xs text-ink-2">
            Maior perda
            <div className="mt-0.5 flex items-center justify-end gap-1.5 text-sm font-semibold text-ink">
              <DisciplineDot bucket={gap.biggest.bucket} />
              {BUCKET_LABEL[gap.biggest.bucket]} · {Math.round(gap.biggest.share * 100)}%
            </div>
          </div>
        )}
      </div>

      {lossTotal > 0 && (
        <div className="mt-4 flex h-3 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label="Composição da perda de tempo">
          {losses.filter((x) => x.s > 0).map((x) => (
            <div key={x.b} title={`${BUCKET_LABEL[x.b]}: ${formatGap(x.s)}`} style={{ width: `${(x.s / lossTotal) * 100}%`, background: BUCKET_COLOR[x.b] }} />
          ))}
        </div>
      )}

      <div className={cx('mt-4 grid gap-2.5', compact ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1')}>
        {GAP_BUCKETS.map((b) => {
          const g = gap.byBucket[b];
          const isBiggest = gap.biggest?.bucket === b;
          return compact ? (
            <div key={b} className={cx('rounded-xl border p-3', isBiggest ? 'border-ink' : 'border-line')}>
              <div className="flex items-center gap-1.5 text-xs text-ink-2">
                <DisciplineDot bucket={b} /> {BUCKET_LABEL[b]}
              </div>
              <div className={cx('num mt-1 text-xl font-semibold', g > 0 ? 'text-bad' : 'text-good')}>{formatGap(g)}</div>
            </div>
          ) : (
            <div key={b} className="grid grid-cols-[92px_1fr_64px] items-center gap-3 text-sm" title={`${BUCKET_LABEL[b]}: ${formatGap(g)} (${(gap.relative[b] * 100).toFixed(1)}%)`}>
              <span className={cx('flex items-center gap-1.5', isBiggest && 'font-semibold')}>
                <DisciplineDot bucket={b} /> {BUCKET_LABEL[b]}
              </span>
              <div className="relative h-2.5 rounded-full bg-surface-2">
                <div className="absolute inset-y-0 left-1/2 w-px bg-line" />
                <div
                  className="absolute inset-y-0 rounded-full"
                  style={{
                    // Ganho = cinza neutro (não confundir com a cor da corrida); o sinal no rótulo diz o resto.
                    background: g > 0 ? BUCKET_COLOR[b] : '#b8bdc7',
                    left: g >= 0 ? '50%' : `${50 - (Math.abs(g) / maxAbs) * 50}%`,
                    width: `${(Math.abs(g) / maxAbs) * 50}%`,
                  }}
                />
              </div>
              <span className={cx('num text-right font-medium', g > 0 ? 'text-bad' : 'text-good')}>{formatGap(g)}</span>
            </div>
          );
        })}
      </div>
      {!compact && <div className="mt-2 flex justify-between text-[11px] text-muted"><span>← ganhei tempo</span><span>perdi tempo →</span></div>}
    </div>
  );
}

export function ZoneBar({ zones, height = 10 }: { zones: number[]; height?: number }) {
  const colors = ['#cde2fb', '#86b6ef', '#3987e5', '#1c5cab', '#0d366b'];
  return (
    <div>
      <div className="flex w-full gap-[2px] overflow-hidden rounded-full" style={{ height }}>
        {zones.map((z, i) => z > 0 && <div key={i} title={`Z${i + 1}: ${Math.round(z * 100)}%`} style={{ width: `${z * 100}%`, background: colors[i] }} />)}
      </div>
      <div className="mt-1.5 grid grid-cols-5 text-[11px] text-ink-2">
        {zones.map((z, i) => (
          <span key={i} className="num">
            Z{i + 1} <span className="font-medium text-ink">{Math.round(z * 100)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Posição na categoria ao fim de cada modalidade. */
export function PositionFlow({ ranks, n }: { ranks: { swim: number; bike: number; run: number }; n: number }) {
  const steps: { k: GapBucket; label: string; r: number }[] = [
    { k: 'swim', label: 'Após swim', r: ranks.swim },
    { k: 'bike', label: 'Após bike', r: ranks.bike },
    { k: 'run', label: 'Chegada', r: ranks.run },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].r : undefined;
        const moved = prev != null ? prev - s.r : 0;
        return (
          <div key={s.k} className="rounded-xl bg-surface-2 p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-ink-2">
              <DisciplineDot bucket={s.k} /> {s.label}
            </div>
            <div className="num mt-1 text-xl font-semibold">P{s.r}<span className="text-xs font-normal text-muted">/{n}</span></div>
            {prev != null && (
              <div className={cx('num mt-0.5 text-xs font-medium', moved > 0 ? 'text-good' : moved < 0 ? 'text-bad' : 'text-muted')}>
                {moved > 0 ? `▲ ganhou ${moved}` : moved < 0 ? `▼ perdeu ${-moved}` : '= manteve'}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Barra de splits proporcional (composição do tempo de prova). */
export function SplitStrip({ splits }: { splits: { swim: number; t1: number; bike: number; t2: number; run: number } }) {
  const total = splits.swim + splits.t1 + splits.bike + splits.t2 + splits.run;
  const parts: { b: GapBucket; v: number; l: string }[] = [
    { b: 'swim', v: splits.swim, l: 'Swim' },
    { b: 'transitions', v: splits.t1, l: 'T1' },
    { b: 'bike', v: splits.bike, l: 'Bike' },
    { b: 'transitions', v: splits.t2, l: 'T2' },
    { b: 'run', v: splits.run, l: 'Run' },
  ];
  return (
    <div className="flex h-2 w-full gap-[2px] overflow-hidden rounded-full">
      {parts.filter((p) => p.v > 0).map((p) => (
        <div key={p.l} title={`${p.l} ${formatDuration(p.v)}`} style={{ width: `${(p.v / total) * 100}%`, background: BUCKET_COLOR[p.b] }} />
      ))}
    </div>
  );
}

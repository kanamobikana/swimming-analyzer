import type { Kpi } from '@/lib/analytics/insights';
import { formatDuration, formatGap, formatHours, formatNumber, formatPace100, formatPaceKm } from '@/lib/domain/time';
import { Badge, Delta } from './ui';

export function formatKpi(format: Kpi['format'], v: number): string {
  switch (format) {
    case 'watts':
      return `${Math.round(v)} W`;
    case 'wkg':
      return formatNumber(v, 2);
    case 'number':
      return formatNumber(v, 0);
    case 'pace_km':
      return formatPaceKm(v);
    case 'pace_100':
      return formatPace100(v);
    case 'hours':
      return formatHours(v);
    case 'score':
      return `${Math.round(v)}`;
    case 'percent':
      return `Top ${Math.round(v * 100)}%`;
    case 'duration':
      return formatDuration(v);
    case 'gap':
      return formatGap(v);
  }
}

function formatDelta(format: Kpi['format'], v: number): string {
  switch (format) {
    case 'percent':
      return `${Math.round(v * 100)} p.p.`;
    case 'wkg':
      return formatNumber(v, 2);
    case 'watts':
      return `${Math.round(v)} W`;
    case 'pace_km':
    case 'pace_100':
    case 'duration':
    case 'gap':
      return formatDuration(v);
    case 'hours':
      return formatHours(v);
    default:
      return formatNumber(v, 0);
  }
}

export function KpiCard({ k }: { k: Kpi }) {
  const delta = k.previous != null ? k.value - k.previous : NaN;
  return (
    <div className="rounded-2xl border border-line bg-surface p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow truncate">{k.label}</span>
        {k.estimate && <Badge kind="estimate" />}
      </div>
      <div className="num mt-1.5 text-xl font-semibold tracking-tight">{formatKpi(k.format, k.value)}</div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
        {Number.isFinite(delta) ? <Delta value={delta} lowerIsBetter={k.lowerIsBetter} format={(v) => formatDelta(k.format, v)} /> : <span>—</span>}
        {k.previous != null && <span>ant. {formatKpi(k.format, k.previous)}</span>}
      </div>
      {k.note && <div className="mt-0.5 truncate text-[11px] text-muted">{k.note}</div>}
    </div>
  );
}

'use client';

/**
 * Gráficos SVG minimalistas (sem dependências). Linhas de 2px, marcadores ≥ 8px,
 * grade recessiva, eixo único, tooltip no hover por padrão.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { fmtX, fmtY, type XFormat, type YFormat } from './viz-format';

/** Largura real do container: texto sempre em 11px, sem escalar o SVG. */
function useWidth(initial = 640) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export interface Series {
  name: string;
  color: string;
  points: { x: string; y: number; label?: string }[];
  dashed?: boolean;
}

function niceTicks(min: number, max: number, count = 4) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) return [min];
  const span = max - min;
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? step0;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(v);
  return out;
}

export function LineChart({
  series,
  height = 200,
  yFormat: yKind = 'int',
  xFormat: xKind = 'raw',
  invert = false,
  yDomain,
  showDots,
}: {
  series: Series[];
  height?: number;
  yFormat?: YFormat;
  xFormat?: XFormat;
  /** true = valores menores ficam em cima (paces, percentis). */
  invert?: boolean;
  yDomain?: [number, number];
  showDots?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [boxRef, W] = useWidth();
  const clipId = useId();
  const yFormat = (v: number) => fmtY(yKind, v);
  const xFormat = (x: string) => fmtX(xKind, x);
  const xs = useMemo(() => [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort(), [series]);
  const ys = series.flatMap((s) => s.points.map((p) => p.y)).filter(Number.isFinite);
  if (!xs.length || !ys.length) return <div ref={boxRef} className="flex h-24 items-center justify-center text-xs text-muted">Sem dados no período</div>;
  let [lo, hi] = yDomain ?? [Math.min(...ys), Math.max(...ys)];
  if (!yDomain) {
    const pad = (hi - lo) * 0.12 || Math.abs(hi) * 0.05 || 1;
    lo -= pad;
    hi += pad;
  }
  const H = height;
  const ticks = niceTicks(lo, hi);
  const m = { l: 12 + Math.max(...ticks.map((t) => yFormat(t).length), 2) * 6.4, r: 12, t: 10, b: 22 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const xPos = (x: string) => m.l + (xs.length === 1 ? iw / 2 : (xs.indexOf(x) / (xs.length - 1)) * iw);
  const yPos = (y: number) => {
    const f = (y - lo) / (hi - lo || 1);
    return m.t + (invert ? f : 1 - f) * ih;
  };
  const xLabelEvery = Math.max(1, Math.ceil(xs.length / Math.max(2, Math.floor(W / 90))));
  const dots = showDots ?? xs.length <= 16;

  return (
    <div className="relative" ref={boxRef}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block w-full touch-none select-none" role="img" aria-label={series.map((s) => s.name).join(', ')}
        onPointerLeave={() => setHover(null)}
        onPointerMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          const idx = Math.round(((px - m.l) / iw) * (xs.length - 1));
          setHover(Math.min(Math.max(idx, 0), xs.length - 1));
        }}>
        <defs>
          <clipPath id={clipId}><rect x={m.l} y={m.t - 6} width={iw} height={ih + 12} /></clipPath>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={yPos(t)} y2={yPos(t)} stroke="var(--line)" strokeWidth={1} />
            <text x={m.l - 8} y={yPos(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)" className="num">{yFormat(t)}</text>
          </g>
        ))}
        {xs.map((x, i) => (i % xLabelEvery === 0 || i === xs.length - 1) && (
          <text key={x} x={xPos(x)} y={H - 6} textAnchor={xs.length > 1 && i === 0 ? 'start' : xs.length > 1 && i === xs.length - 1 ? 'end' : 'middle'} fontSize={11} fill="var(--muted)">{xFormat(x)}</text>
        ))}
        <g clipPath={`url(#${clipId})`}>
          {series.map((s) => {
            const pts = s.points.filter((p) => Number.isFinite(p.y)).sort((a, b) => a.x.localeCompare(b.x));
            const d = pts.map((p, i) => `${i ? 'L' : 'M'}${xPos(p.x).toFixed(1)},${yPos(p.y).toFixed(1)}`).join('');
            return (
              <g key={s.name}>
                <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? '5 4' : undefined} />
                {dots && pts.map((p) => <circle key={p.x} cx={xPos(p.x)} cy={yPos(p.y)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />)}
              </g>
            );
          })}
        </g>
        {hover != null && (
          <g pointerEvents="none">
            <line x1={xPos(xs[hover])} x2={xPos(xs[hover])} y1={m.t} y2={m.t + ih} stroke="var(--ink-2)" strokeWidth={1} strokeDasharray="3 3" />
            {series.map((s) => {
              const p = s.points.find((q) => q.x === xs[hover]);
              return p && Number.isFinite(p.y) ? <circle key={s.name} cx={xPos(p.x)} cy={yPos(p.y)} r={5} fill={s.color} stroke="var(--surface)" strokeWidth={2} /> : null;
            })}
          </g>
        )}
      </svg>
      {hover != null && (
        <div className="pointer-events-none absolute top-1 z-10 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-sm"
          style={{ left: `${(xPos(xs[hover]) / W) * 100}%`, transform: xPos(xs[hover]) > W * 0.6 ? 'translateX(calc(-100% - 8px))' : 'translateX(8px)' }}>
          <div className="mb-0.5 font-medium text-ink">{xFormat(xs[hover])}</div>
          {series.map((s) => {
            const p = s.points.find((q) => q.x === xs[hover]);
            if (!p || !Number.isFinite(p.y)) return null;
            return (
              <div key={s.name} className="flex items-center gap-1.5 whitespace-nowrap text-ink-2">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                {series.length > 1 && <span>{s.name}</span>}
                <span className="num font-medium text-ink">{yFormat(p.y)}</span>
                {p.label && <span className="text-muted">· {p.label}</span>}
              </div>
            );
          })}
        </div>
      )}
      {series.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
          {series.map((s) => (
            <span key={s.name} className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export interface StackBar {
  x: string;
  label?: string;
  parts: { key: string; value: number }[];
}

export function StackedBars({
  bars,
  colors,
  names,
  height = 180,
  yFormat: yKind = 'int',
  xFormat: xKind = 'raw',
}: {
  bars: StackBar[];
  colors: Record<string, string>;
  names: Record<string, string>;
  height?: number;
  yFormat?: YFormat;
  xFormat?: XFormat;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [boxRef, W] = useWidth();
  const yFormat = (v: number) => fmtY(yKind, v);
  const xFormat = (x: string) => fmtX(xKind, x);
  const totals = bars.map((b) => b.parts.reduce((a, p) => a + p.value, 0));
  const max = Math.max(...totals, 0);
  if (!bars.length || max === 0) return <div ref={boxRef} className="flex h-24 items-center justify-center text-xs text-muted">Sem dados no período</div>;
  const H = height;
  const ticks = niceTicks(0, max);
  const m = { l: 12 + Math.max(...ticks.map((t) => yFormat(t).length), 2) * 6.4, r: 8, t: 8, b: 22 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const hiT = Math.max(max, ticks[ticks.length - 1] ?? max);
  const slot = iw / bars.length;
  const bw = Math.max(2, Math.min(28, slot - 2));
  const y = (v: number) => m.t + ih - (v / hiT) * ih;
  const keys = Object.keys(names);
  const every = Math.max(1, Math.ceil(bars.length / Math.max(2, Math.floor(W / 70))));
  return (
    <div className="relative" ref={boxRef}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block w-full select-none" role="img" aria-label="Volume por período" onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="var(--line)" />
            <text x={m.l - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)" className="num">{yFormat(t)}</text>
          </g>
        ))}
        {bars.map((b, i) => {
          const x0 = m.l + i * slot + (slot - bw) / 2;
          let acc = 0;
          const parts = keys.map((k) => b.parts.find((p) => p.key === k)).filter((p): p is { key: string; value: number } => !!p && p.value > 0);
          return (
            <g key={b.x} onPointerEnter={() => setHover(i)} opacity={hover == null || hover === i ? 1 : 0.45}>
              <rect x={m.l + i * slot} y={m.t} width={slot} height={ih} fill="transparent" />
              {parts.map((p, j) => {
                const top = y(acc + p.value);
                const h = y(acc) - top;
                acc += p.value;
                const isTop = j === parts.length - 1;
                // 2px de respiro entre segmentos; topo arredondado.
                return <rect key={p.key} x={x0} y={top + (isTop ? 0 : 1)} width={bw} height={Math.max(h - (isTop ? 0 : 1) - (j === 0 ? 0 : 1), 0.5)} rx={isTop ? Math.min(3, bw / 2) : 0} fill={colors[p.key]} />;
              })}
              {(i % every === 0 || i === bars.length - 1) && <text x={x0 + bw / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--muted)">{xFormat(b.x)}</text>}
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <div className="pointer-events-none absolute top-1 z-10 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-sm"
          style={{ left: `${((m.l + hover * slot + slot / 2) / W) * 100}%`, transform: hover > bars.length * 0.6 ? 'translateX(calc(-100% - 8px))' : 'translateX(8px)' }}>
          <div className="mb-0.5 font-medium">{bars[hover].label ?? xFormat(bars[hover].x)}</div>
          {keys.map((k) => {
            const v = bars[hover].parts.find((p) => p.key === k)?.value ?? 0;
            return v > 0 ? (
              <div key={k} className="flex items-center gap-1.5 whitespace-nowrap text-ink-2">
                <span className="h-2 w-2 rounded-full" style={{ background: colors[k] }} />
                {names[k]} <span className="num font-medium text-ink">{yFormat(v)}</span>
              </div>
            ) : null;
          })}
          <div className="num mt-0.5 border-t border-line pt-0.5 font-medium">Total {yFormat(totals[hover])}</div>
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        {keys.map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: colors[k] }} />
            {names[k]}
          </span>
        ))}
      </div>
    </div>
  );
}

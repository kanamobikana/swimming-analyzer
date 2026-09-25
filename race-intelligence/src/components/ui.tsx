import Link from 'next/link';
import type { ReactNode } from 'react';
import type { GapBucket } from '@/lib/analytics/race';
import type { DataProvenance } from '@/lib/domain/types';

export const BUCKET_COLOR: Record<GapBucket, string> = {
  swim: 'var(--swim)',
  bike: 'var(--bike)',
  run: 'var(--run)',
  transitions: 'var(--trans)',
};

export function cx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(' ');
}

export function Card({ children, className, title, action, eyebrow }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <section className={cx('rounded-2xl border border-line bg-surface p-4 sm:p-5', className)}>
      {(title || action || eyebrow) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            {eyebrow && <div className="eyebrow mb-0.5">{eyebrow}</div>}
            {title && <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-ink-2">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** Número grande com rótulo — o elemento central do produto. */
export function Stat({ label, value, sub, size = 'md', tone }: { label: ReactNode; value: ReactNode; sub?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl'; tone?: 'good' | 'bad' }) {
  const sizes = { sm: 'text-lg', md: 'text-2xl', lg: 'text-3xl sm:text-4xl', xl: 'text-4xl sm:text-5xl' };
  return (
    <div className="min-w-0">
      <div className="eyebrow truncate">{label}</div>
      <div className={cx('num mt-1 font-semibold leading-none tracking-tight', sizes[size], tone === 'good' && 'text-good', tone === 'bad' && 'text-bad')}>{value}</div>
      {sub && <div className="mt-1.5 text-xs text-ink-2">{sub}</div>}
    </div>
  );
}

const PROVENANCE: Record<DataProvenance | 'estimate' | 'official', { label: string; cls: string }> = {
  official: { label: 'Oficial', cls: 'bg-[#e8f3ec] text-good' },
  imported: { label: 'Importado', cls: 'bg-[#e9f1fb] text-swim' },
  manual: { label: 'Manual', cls: 'bg-surface-2 text-ink-2' },
  estimate: { label: 'Estimativa', cls: 'bg-[#fbf3e0] text-warn' },
  mock: { label: 'Exemplo', cls: 'bg-surface-2 text-muted border border-dashed border-line' },
};

export function Badge({ kind, children }: { kind: keyof typeof PROVENANCE; children?: ReactNode }) {
  const p = PROVENANCE[kind];
  return <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', p.cls)}>{children ?? p.label}</span>;
}

export function Chip({ children, active, href }: { children: ReactNode; active?: boolean; href: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      className={cx(
        'rounded-full border px-3 py-1 text-xs font-medium transition',
        active ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink-2 hover:border-ink-2',
      )}
    >
      {children}
    </Link>
  );
}

/** Variação com sinal e seta (nunca só cor). */
export function Delta({ value, lowerIsBetter, format }: { value: number; lowerIsBetter?: boolean; format: (v: number) => string }) {
  if (!Number.isFinite(value) || Math.abs(value) < 1e-9) return <span className="text-xs text-muted">= sem variação</span>;
  const better = lowerIsBetter ? value < 0 : value > 0;
  return (
    <span className={cx('num text-xs font-medium', better ? 'text-good' : 'text-bad')}>
      {value > 0 ? '▲' : '▼'} {format(Math.abs(value))}
      <span className="sr-only">{better ? ' (melhor)' : ' (pior)'}</span>
    </span>
  );
}

export function DisciplineDot({ bucket }: { bucket: GapBucket }) {
  return <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: BUCKET_COLOR[bucket] }} aria-hidden />;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">{children}</div>;
}

export function Button({ children, variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' }) {
  return (
    <button
      {...props}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-50',
        variant === 'primary' ? 'bg-ink text-white hover:bg-ink-2' : 'border border-line bg-surface text-ink hover:border-ink-2',
        props.className,
      )}
    >
      {children}
    </button>
  );
}

export const inputCls = 'w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink';

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </label>
  );
}

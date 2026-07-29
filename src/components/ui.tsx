import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';

/** Minimal, dependency-free UI kit styled with Tailwind. */

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-border bg-surface shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonProps) {
  const styles: Record<string, string> = {
    primary: 'bg-brand text-white hover:opacity-90',
    secondary: 'bg-surface border border-border text-foreground hover:bg-background',
    ghost: 'text-brand hover:underline',
    danger: 'bg-surface border border-red-200 text-red-600 hover:bg-red-50',
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    />
  );
}

export function Label({
  children,
  htmlFor,
  hint,
}: {
  children: ReactNode;
  htmlFor?: string;
  hint?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
      {children}
      {hint ? <span className="ml-1 font-normal text-muted">{hint}</span> : null}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm tabnum outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 ${props.className ?? ''}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 ${props.className ?? ''}`}
    />
  );
}

export function Badge({
  children,
  tone = 'default',
}: {
  children: ReactNode;
  tone?: 'default' | 'positive' | 'warning' | 'brand';
}) {
  const tones: Record<string, string> = {
    default: 'bg-background text-muted',
    positive: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    brand: 'bg-indigo-50 text-indigo-700',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'default' | 'positive' | 'warning' | 'brand';
}) {
  const valueTone: Record<string, string> = {
    default: 'text-foreground',
    positive: 'text-positive',
    warning: 'text-warning',
    brand: 'text-brand',
  };
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold tabnum ${valueTone[tone]}`}>
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="px-5 py-10 text-center text-sm text-muted">{children}</div>
  );
}

import { formatDuration, formatHours, formatNumber } from '@/lib/domain/time';

/** Formatos serializáveis (Server → Client Components não aceitam funções). */
export type YFormat = 'int' | 'dec1' | 'dec2' | 'duration' | 'pace_km' | 'pace_100' | 'top_pct' | 'hours' | 'watts' | 'km' | 'pct';
export type XFormat = 'raw' | 'month' | 'day' | 'week' | 'year_month';

export function fmtY(kind: YFormat, raw: number): string {
  const v = Object.is(Math.round(raw), -0) ? 0 : raw;
  switch (kind) {
    case 'int':
      return formatNumber(v);
    case 'dec1':
      return formatNumber(v, 1);
    case 'dec2':
      return formatNumber(v, 2);
    case 'duration':
      return formatDuration(v);
    case 'pace_km':
      return `${formatDuration(v)}/km`;
    case 'pace_100':
      return `${formatDuration(v)}/100`;
    case 'top_pct':
      return `Top ${Math.round(v)}%`;
    case 'pct':
      return `${Math.round(v)}%`;
    case 'hours':
      return formatHours(v * 3600);
    case 'watts':
      return `${Math.round(v)} W`;
    case 'km':
      return `${formatNumber(v)} km`;
  }
}

export function fmtX(kind: XFormat, x: string): string {
  switch (kind) {
    case 'raw':
      return x;
    case 'month':
      return new Date(`${x.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    case 'year_month':
      return new Date(`${x.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');
    case 'day':
    case 'week':
      return new Date(`${x.slice(0, 10)}T12:00:00Z`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }
}

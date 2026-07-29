/** Formatting helpers for the UI. pt-BR locale, BRL currency. */

export function formatBRL(value: number, digits = 2): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** Format a fraction (0.4) as a percentage string ("40,0%"). */
export function formatPct(fraction: number, digits = 1): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(fraction);
}

/** Format a lives count compactly (1_000_000 -> "1MM", 1_500_000 -> "1,5MM"). */
export function formatLives(lives: number | null): string {
  if (lives === null) return 'acima';
  if (lives >= 1_000_000) {
    const mm = lives / 1_000_000;
    return `${mm.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}MM`;
  }
  if (lives >= 1_000) {
    return `${(lives / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k`;
  }
  return lives.toLocaleString('pt-BR');
}

/** Parse a pt-BR or plain numeric string into a number (accepts "," decimals). */
export function parseNumber(input: string | number | null | undefined): number {
  if (typeof input === 'number') return input;
  if (!input) return 0;
  const normalized = String(input).trim().replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : Number(input) || 0;
}

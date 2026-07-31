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

/**
 * Parse a numeric string robustly, accepting both Brazilian ("1.234,56",
 * "11,25", "10,5") and plain/US ("1234.56", "10.5") formats. Never throws and
 * returns 0 for empty/invalid input.
 *
 * Rules:
 * - both "." and "," present → the rightmost one is the decimal separator
 * - only "," → single comma is decimal ("11,25"); many commas are thousands
 * - only "." → single dot is decimal ("10.5"); many dots are thousands
 */
export function parseNumber(input: string | number | null | undefined): number {
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0;
  if (input == null) return 0;
  let s = String(input).trim().replace(/\s/g, '').replace(/[^\d.,-]/g, '');
  if (!s) return 0;

  const hasDot = s.includes('.');
  const hasComma = s.includes(',');

  if (hasDot && hasComma) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.'); // BR: comma is decimal
    } else {
      s = s.replace(/,/g, ''); // US: dot is decimal
    }
  } else if (hasComma) {
    s = s.split(',').length > 2 ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (hasDot) {
    if (s.split('.').length > 2) s = s.replace(/\./g, ''); // many dots → thousands
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Format a number with a pt-BR decimal comma, trimming trailing zeros. */
export function formatDecimal(value: number, maxDigits = 4): string {
  if (!Number.isFinite(value)) return '';
  return new Intl.NumberFormat('pt-BR', {
    useGrouping: false,
    maximumFractionDigits: maxDigits,
  }).format(value);
}

/** Parse a plain integer count (lives), ignoring any thousands separators. */
export function parseInteger(input: string | number | null | undefined): number {
  if (typeof input === 'number') return Number.isFinite(input) ? Math.round(input) : 0;
  if (input == null) return 0;
  const digits = String(input).replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

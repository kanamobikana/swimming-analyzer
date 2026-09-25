/** Formatação e parsing de tempos, paces e velocidades. Tudo em segundos. */

const pad = (n: number) => String(n).padStart(2, '0');

/** 16432 → "4:33:52"; 452 → "7:32"; forceHours mantém "0:07:32". */
export function formatDuration(totalS: number, opts: { forceHours?: boolean } = {}): string {
  if (!Number.isFinite(totalS)) return '—';
  const s = Math.round(Math.abs(totalS));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const sign = totalS < 0 ? '-' : '';
  if (h > 0 || opts.forceHours) return `${sign}${h}:${pad(m)}:${pad(sec)}`;
  return `${sign}${m}:${pad(sec)}`;
}

/** Gap com sinal explícito: +3:42 (perdi) / -0:38 (ganhei). */
export function formatGap(deltaS: number): string {
  if (!Number.isFinite(deltaS)) return '—';
  if (Math.round(deltaS) === 0) return '0:00';
  return `${deltaS > 0 ? '+' : '-'}${formatDuration(Math.abs(deltaS))}`;
}

/** Horas decimais → "12h40". */
export function formatHours(totalS: number): string {
  const totalMin = Math.round(totalS / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h${pad(m)}`;
}

/**
 * Aceita "4:33:52", "33:52", "1:52", "452", "4h33m52s", "1:52,3".
 * Retorna NaN para entradas inválidas.
 */
export function parseDuration(input: string | null | undefined): number {
  if (input == null) return NaN;
  const raw = String(input).trim().replace(',', '.');
  if (!raw || raw === '-' || raw === '--' || /^(dnf|dns|dsq)$/i.test(raw)) return NaN;
  const hms = raw.match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m(?:in)?)?\s*(?:(\d+(?:\.\d+)?)\s*s)?$/i);
  if (hms && (hms[1] || hms[2] || hms[3])) {
    return Number(hms[1] ?? 0) * 3600 + Number(hms[2] ?? 0) * 60 + Number(hms[3] ?? 0);
  }
  const parts = raw.split(':');
  if (parts.some((p) => p === '' || isNaN(Number(p)))) return NaN;
  const nums = parts.map(Number);
  if (nums.length === 1) return nums[0];
  if (nums.length === 2) return nums[0] * 60 + nums[1];
  if (nums.length === 3) return nums[0] * 3600 + nums[1] * 60 + nums[2];
  return NaN;
}

/** Pace de corrida (s/km) a partir de tempo e distância. */
export const paceSecPerKm = (timeS: number, distanceM: number) =>
  distanceM > 0 ? timeS / (distanceM / 1000) : NaN;

/** Pace de natação (s/100m). */
export const paceSecPer100m = (timeS: number, distanceM: number) =>
  distanceM > 0 ? timeS / (distanceM / 100) : NaN;

/** Velocidade em km/h. */
export const speedKmh = (timeS: number, distanceM: number) =>
  timeS > 0 ? distanceM / 1000 / (timeS / 3600) : NaN;

export const formatPaceKm = (secPerKm: number) =>
  Number.isFinite(secPerKm) ? `${formatDuration(secPerKm)}/km` : '—';

export const formatPace100 = (secPer100: number) =>
  Number.isFinite(secPer100) ? `${formatDuration(secPer100)}/100m` : '—';

export const formatSpeed = (kmh: number) =>
  Number.isFinite(kmh) ? `${kmh.toFixed(1).replace('.', ',')} km/h` : '—';

/** Tempo para cobrir uma distância dado um pace/velocidade. */
export const timeFromPaceKm = (secPerKm: number, distanceM: number) => (secPerKm * distanceM) / 1000;
export const timeFromPace100 = (secPer100: number, distanceM: number) => (secPer100 * distanceM) / 100;
export const timeFromSpeedKmh = (kmh: number, distanceM: number) =>
  kmh > 0 ? (distanceM / 1000 / kmh) * 3600 : NaN;

export function formatNumber(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatPercent(fraction: number, digits = 0): string {
  if (!Number.isFinite(fraction)) return '—';
  return `${formatNumber(fraction * 100, digits)}%`;
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString('pt-BR', opts);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso.slice(0, 10) + 'T00:00:00Z').getTime();
  const b = new Date(toIso.slice(0, 10) + 'T00:00:00Z').getTime();
  return Math.round((b - a) / 86_400_000);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso.slice(0, 10) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

import type { RaceDistance, Sex } from './types';

/** Distâncias nominais (metros). O percurso real de cada prova pode diferir. */
export const NOMINAL_COURSE: Record<RaceDistance, { swimM: number; bikeM: number; runM: number }> = {
  sprint: { swimM: 750, bikeM: 20_000, runM: 5_000 },
  olympic: { swimM: 1_500, bikeM: 40_000, runM: 10_000 },
  '70.3': { swimM: 1_900, bikeM: 90_000, runM: 21_097 },
  full: { swimM: 3_800, bikeM: 180_000, runM: 42_195 },
  run_5k: { swimM: 0, bikeM: 0, runM: 5_000 },
  run_10k: { swimM: 0, bikeM: 0, runM: 10_000 },
  half_marathon: { swimM: 0, bikeM: 0, runM: 21_097 },
  marathon: { swimM: 0, bikeM: 0, runM: 42_195 },
};

export const DISTANCE_LABEL: Record<RaceDistance, string> = {
  sprint: 'Sprint',
  olympic: 'Olímpico',
  '70.3': '70.3',
  full: 'Full',
  run_5k: '5 km',
  run_10k: '10 km',
  half_marathon: 'Meia maratona',
  marathon: 'Maratona',
};

export const isTriathlon = (d: RaceDistance) => d === 'sprint' || d === 'olympic' || d === '70.3' || d === 'full';

/**
 * Categoria por idade no padrão IRONMAN/World Triathlon:
 * idade em 31/12 do ano da prova, faixas de 5 anos a partir de 18-24 → 25-29...
 */
export function ageGroupFor(birthDate: string, raceDate: string, sex: Sex): string {
  const birthYear = Number(birthDate.slice(0, 4));
  const raceYear = Number(raceDate.slice(0, 4));
  const age = raceYear - birthYear;
  if (age < 25) return `${sex}18-24`;
  const lo = Math.floor(age / 5) * 5;
  return `${sex}${lo}-${lo + 4}`;
}

/** Linha do tempo das categorias: quando o atleta muda de faixa. */
export function categoryTimeline(birthDate: string, sex: Sex, fromYear: number, years: number) {
  const out: { year: number; category: string; changed: boolean }[] = [];
  let prev = '';
  for (let y = fromYear; y < fromYear + years; y++) {
    const cat = ageGroupFor(birthDate, `${y}-06-30`, sex);
    out.push({ year: y, category: cat, changed: prev !== '' && cat !== prev });
    prev = cat;
  }
  return out;
}

/** Idade cronológica em uma data. */
export function ageOn(birthDate: string, date: string): number {
  const b = new Date(birthDate + 'T00:00:00Z');
  const d = new Date(date.slice(0, 10) + 'T00:00:00Z');
  let age = d.getUTCFullYear() - b.getUTCFullYear();
  const m = d.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && d.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

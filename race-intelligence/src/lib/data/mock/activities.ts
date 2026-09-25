/**
 * Treinos de EXEMPLO (~20 meses) com progressão realista, ciclos 3:1,
 * taper antes de provas, sessões perdidas e uma pausa. Substituídos pelos
 * dados do Strava quando a integração estiver conectada.
 */
import type { Activity, ActivityType, Athlete, Race, RaceResult, ZoneTime } from '../../domain/types';
import { addDays, daysBetween } from '../../domain/time';
import { rng, normCdf } from './random';

const START = '2025-01-01';

/** Limites superiores de Z1..Z4 em fração do LTHR (Z5 acima). */
const HR_BOUNDS = [0.81, 0.89, 0.93, 1.0];

function zonesAround(ratio: number, seconds: number, sd = 0.035): ZoneTime {
  const cdf = HR_BOUNDS.map((b) => normCdf((b - ratio) / sd));
  const p = [cdf[0], cdf[1] - cdf[0], cdf[2] - cdf[1], cdf[3] - cdf[2], 1 - cdf[3]];
  return { seconds: p.map((x) => Math.round(x * seconds)) as ZoneTime['seconds'] };
}

export function buildMockActivities(athlete: Athlete, races: Race[], results: RaceResult[], today: string): Activity[] {
  const r = rng(2025);
  const out: Activity[] = [];
  const totalDays = daysBetween(START, today);
  const raceDates = new Map(races.map((x) => [x.date, x]));
  let n = 0;
  const id = () => `a${++n}`;

  for (let d = 0; d < totalDays; d++) {
    const date = addDays(START, d);
    const p = d / totalDays; // progresso 0→1
    const ftp = 245 + 23 * p;
    const thr = 272 - 14 * p;
    const css = 116 - 9 * p;
    const lthr = athlete.lthr;
    const dow = (new Date(date + 'T12:00:00Z').getUTCDay() + 6) % 7; // 0 = seg
    const week = Math.floor(d / 7);
    const recoveryWeek = week % 4 === 3;
    let load = (0.85 + 0.25 * p) * (recoveryWeek ? 0.68 : 1);

    // Pausas (viagem/trabalho) e semana doente.
    if (date >= '2026-02-09' && date <= '2026-02-19') continue;
    if (date >= '2025-07-14' && date <= '2025-07-18') continue;

    // Taper e recuperação em torno de provas.
    let raceToday: Race | undefined;
    for (const [rd, race] of raceDates) {
      const delta = daysBetween(date, rd); // dias até a prova
      const long = race.distance === '70.3' || race.distance === 'full';
      if (delta === 0) raceToday = race;
      else if (delta > 0 && delta <= (long ? 12 : 5)) load *= long ? 0.55 + 0.03 * delta : 0.7;
      else if (delta < 0 && delta >= (long ? -6 : -2)) load *= 0.4;
    }
    if (raceToday) continue; // o esforço da prova entra como atividade própria abaixo

    const at = (h: number) => `${date}T${String(h).padStart(2, '0')}:${String(r.int(0, 59)).padStart(2, '0')}:00-03:00`;
    const missed = () => r.chance(0.07);

    const swim = (meters: number, paceOffset: number, key?: Activity['keySession'], ow = false) => {
      const m = Math.round((meters * load) / 100) * 100;
      if (m < 800) return;
      const pace = css + paceOffset + r.normal(0, 2);
      const t = Math.round((pace * m) / 100);
      const ratio = 0.84 + (css / pace - 0.9) * 0.6;
      const skip = missed();
      out.push({
        id: id(), source: 'mock', date: at(6), type: ow ? 'open_water_swim' : 'swim', name: ow ? 'Águas abertas' : 'Natação',
        movingTimeS: skip ? 0 : t, distanceM: skip ? 0 : m, avgHr: Math.round(lthr * ratio), maxHr: Math.round(lthr * (ratio + 0.07)),
        hrZones: zonesAround(ratio, t), calories: Math.round(t / 60 * 9), keySession: key, planned: true, completed: !skip,
        bestEfforts: m >= 3000 && !ow ? { swim: { '400': Math.round(css * 4 - 6 + r.normal(0, 3)), '1000': Math.round(css * 10 + 12 + r.normal(0, 5)) } } : undefined,
      });
    };
    const run = (km: number, paceOffset: number, key?: Activity['keySession'], opts: { intervals?: boolean } = {}) => {
      const dist = Math.round(km * load * 1000);
      if (dist < 3000) return;
      const pace = thr + paceOffset + r.normal(0, 4);
      const t = Math.round((pace * dist) / 1000);
      const IF = thr / pace;
      const ratio = 0.86 + (IF - 0.8) * 0.7 + r.normal(0, 0.01);
      const skip = missed();
      out.push({
        id: id(), source: 'mock', date: at(key === 'long_run' ? 6 : 18), type: 'run', name: key === 'long_run' ? 'Longão' : key === 'brick' ? 'Transição (brick)' : opts.intervals ? 'Intervalado' : 'Corrida leve',
        movingTimeS: skip ? 0 : t, distanceM: skip ? 0 : dist, avgHr: Math.round(lthr * ratio), maxHr: Math.round(lthr * (ratio + (opts.intervals ? 0.1 : 0.06))),
        avgCadence: Math.round(172 + (IF - 0.8) * 30), elevationGainM: Math.round(dist / 1000 * r.between(3, 12)),
        hrZones: zonesAround(ratio, t, opts.intervals ? 0.06 : 0.03), calories: Math.round(athlete.weightKg * dist / 1000),
        relativeEffort: Math.round(t / 60 * IF * IF * 1.1), keySession: key, planned: true, completed: !skip,
        decoupling: key === 'long_run' ? Math.max(0, 0.07 - 0.035 * p + r.normal(0, 0.012)) : undefined,
        bestEfforts: opts.intervals ? { run: { '1k': Math.round(thr - 20 + r.normal(0, 3)) } } : undefined,
      });
    };
    const ride = (hours: number, IFtarget: number, key?: Activity['keySession'], virtual = false) => {
      const t = Math.round(hours * load * 3600);
      if (t < 2400) return;
      const np = Math.round(ftp * (IFtarget + r.normal(0, 0.015)));
      const avg = Math.round(np / (virtual ? 1.02 : 1.06));
      const speed = virtual ? 33 + 3 * p : 30.5 + 3.5 * p + r.normal(0, 1);
      const ratio = 0.8 + (np / ftp - 0.65) * 0.8 + r.normal(0, 0.01);
      const skip = missed();
      const type: ActivityType = virtual ? 'virtual_ride' : 'ride';
      out.push({
        id: id(), source: 'mock', date: at(virtual ? 19 : 6), type, name: key === 'long_ride' ? 'Pedal longo' : key === 'threshold' ? 'Limiar no rolo' : virtual ? 'Rolo (Zwift)' : 'Pedal',
        movingTimeS: skip ? 0 : t, distanceM: skip ? 0 : Math.round(speed * t / 3.6), avgHr: Math.round(lthr * ratio), maxHr: Math.round(lthr * (ratio + 0.08)),
        avgPowerW: avg, normalizedPowerW: np, avgCadence: Math.round(r.between(84, 92)), elevationGainM: virtual ? 0 : Math.round(t / 3600 * r.between(150, 450)),
        hrZones: zonesAround(ratio, t), calories: Math.round(avg * t / 1000), keySession: key, planned: true, completed: !skip,
        decoupling: key === 'long_ride' ? Math.max(0, 0.06 - 0.03 * p + r.normal(0, 0.01)) : undefined,
        bestEfforts: key === 'threshold' ? { power: { '20m': Math.round(ftp * 0.99 + r.normal(0, 4)), '5m': Math.round(ftp * 1.16 + r.normal(0, 6)), '60m': Math.round(ftp * 0.9 + r.normal(0, 4)) } } : undefined,
      });
    };
    const strength = () => {
      const skip = r.chance(0.2);
      out.push({ id: id(), source: 'mock', date: at(7), type: 'strength', name: 'Força', movingTimeS: skip ? 0 : 45 * 60, distanceM: 0, avgHr: 112, planned: true, completed: !skip });
    };
    const summer = date.slice(5, 7) >= '11' || date.slice(5, 7) <= '03';

    switch (dow) {
      case 0: swim(3000, 8); strength(); break;
      case 1: run(11, 22, 'threshold', { intervals: true }); ride(1, 0.72, undefined, true); break;
      case 2: swim(3200, 6); run(8, 78); break;
      case 3: ride(1.5, 0.86, 'threshold', true); break;
      case 4: swim(2600, 10, undefined, summer && r.chance(0.6)); break;
      case 5:
        ride(r.between(3, 4.5), 0.7, 'long_ride');
        if (week % 2 === 0) run(r.between(5, 8), 30, 'brick');
        break;
      case 6: run(r.between(16, 23), 58, 'long_run'); if (!recoveryWeek) strength(); break;
    }
  }

  // Esforços de prova (entram na carga e nos PBs).
  for (const race of races) {
    if (race.date > today) continue;
    const mine = results.find((x) => x.raceId === race.id && x.isMe);
    if (mine) out.push(...raceActivities(race, mine, id));
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

function raceActivities(race: Race, mine: RaceResult, id: () => string): Activity[] {
  const base = { source: 'mock' as const, keySession: 'race' as const, planned: true, completed: true };
  const date = `${race.date}T07:00:00-03:00`;
  const acts: Activity[] = [];
  const { swim, bike, run } = mine.splits;
  if (swim) acts.push({ ...base, id: id(), date, type: 'open_water_swim', name: `${race.name} — natação`, movingTimeS: swim, distanceM: race.course.swimM, avgHr: 150 });
  if (bike) acts.push({ ...base, id: id(), date, type: 'ride', name: `${race.name} — bike`, movingTimeS: bike, distanceM: race.course.bikeM, avgPowerW: race.myBikePowerW, normalizedPowerW: race.myBikePowerW ? Math.round(race.myBikePowerW * 1.03) : undefined, avgHr: 150 });
  if (run) acts.push({ ...base, id: id(), date, type: 'run', name: `${race.name} — corrida`, movingTimeS: run, distanceM: race.course.runM, avgHr: 158 });
  return acts;
}

/**
 * Gera `data/seed.json` com dados REAIS a partir de exportações do Strava
 * (arquivos JSON com o formato do conector Strava/MCP: list_activities +
 * get_activity_performance).
 *
 * Uso: npx tsx scripts/build-seed.ts <pasta-com-partN.json> [today=YYYY-MM-DD]
 *
 * Valores fisiológicos que o Strava não fornece são ESTIMADOS e listados em
 * athlete.estimates, para o atleta revisar em /perfil.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import type { Activity, Athlete, ZoneTime } from '../src/lib/domain/types';
import { mapStravaActivity, type StravaActivity } from '../src/lib/integrations/strava/mapper';

interface McpActivity {
  id: string;
  name: string;
  description?: string;
  sport_type: string;
  start_local: string;
  moving_time: number;
  elapsed_time?: number;
  distance: number;
  elevation_gain?: number;
  avg_speed?: number;
  avg_cadence?: number;
  calories?: number;
  relative_effort?: number;
  is_trainer?: boolean;
  avg_hr?: number;
  max_hr?: number;
  avg_watts?: number;
  device_watts?: boolean;
  best_efforts?: { name: string; seconds: number }[];
  laps_count?: number;
}

const [dir, todayArg] = process.argv.slice(2);
if (!dir) throw new Error('Informe a pasta com os JSON exportados.');
const today = todayArg ?? new Date().toISOString().slice(0, 10);

const raw: McpActivity[] = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as McpActivity[]);
const byId = [...new Map(raw.map((a) => [a.id, a])).values()].sort((a, b) => a.start_local.localeCompare(b.start_local));
// Gravação dupla (ex.: relógio + ciclocomputador): mesmo esporte, início até 15 min
// de diferença e distância ±10% → fica a versão com mais dados (potência/FC).
const score = (a: McpActivity) => (a.avg_watts ? 2 : 0) + (a.avg_hr ? 1 : 0) + (a.best_efforts?.length ? 1 : 0);
const unique: McpActivity[] = [];
for (const a of byId) {
  const dup = unique.findIndex(
    (b) =>
      b.sport_type === a.sport_type &&
      Math.abs(Date.parse(b.start_local) - Date.parse(a.start_local)) <= 15 * 60_000 &&
      Math.abs(b.distance - a.distance) <= Math.max(a.distance, b.distance) * 0.1,
  );
  if (dup === -1) unique.push(a);
  else if (score(a) > score(unique[dup])) unique[dup] = a;
}
// Perna de bike gravada como "Workout" (ex.: modo multisport): velocidade de bike → Ride.
for (const a of unique) {
  if (a.sport_type === 'Workout' && a.distance >= 5000 && a.moving_time > 0 && a.distance / a.moving_time >= 6) a.sport_type = 'Ride';
}
// Registros espúrios (poucos metros / segundos).
for (let i = unique.length - 1; i >= 0; i--) if (unique[i].moving_time < 60 && unique[i].distance < 100) unique.splice(i, 1);
// Potência média implausível (< 30 W) é erro de sensor: descarta.
for (const a of unique) if (a.avg_watts != null && a.avg_watts < 30) delete a.avg_watts;

// Nomes de best efforts do Strava → chaves da API v3 usadas no mapper.
const EFFORT: Record<string, string> = { '1k': '1k', '1 km': '1k', '5k': '5k', '5 km': '5k', '10k': '10k', '10 km': '10k', 'half-marathon': 'Half-Marathon', 'half marathon': 'Half-Marathon', 'meia maratona': 'Half-Marathon', marathon: 'Marathon', maratona: 'Marathon' };

// Zonas de FC do atleta no Strava (limites superiores Z1..Z4).
const HR_UPPER = [112, 139, 153, 167];
function normCdf(x: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}
/** Sem streams: distribuição estimada em torno da FC média (desvio de 7 bpm). */
function estimatedZones(avgHr: number, seconds: number): ZoneTime {
  const c = HR_UPPER.map((u) => normCdf((u + 0.5 - avgHr) / 7));
  const p = [c[0], c[1] - c[0], c[2] - c[1], c[3] - c[2], 1 - c[3]];
  return { seconds: p.map((x) => Math.round(x * seconds)) as ZoneTime['seconds'] };
}

const RACE_RE = /(\bprova\b|race|70\.3|ironman|triathlon|triatlo|maratona|meia|marathon|\bsprint\b|ol[ií]mpico|internacional|trof[eé]u)/i;
const NOT_RACE_RE = /(ritmo|treino|simulad|transi[çc][ãa]o|\bT2\b|pr[eé][ -]?prova|aquec|warm|semana de prova|teste|x\d+k|\d+x\d)/i;

const activities: Activity[] = unique.map((m) => {
  const s: StravaActivity = {
    id: Number(m.id),
    name: m.name,
    sport_type: m.sport_type,
    start_date: m.start_local,
    start_date_local: m.start_local,
    moving_time: m.moving_time,
    elapsed_time: m.elapsed_time,
    distance: m.distance,
    total_elevation_gain: m.elevation_gain,
    average_heartrate: m.avg_hr,
    max_heartrate: m.max_hr,
    average_watts: m.avg_watts,
    device_watts: m.device_watts,
    average_cadence: m.avg_cadence,
    calories: m.calories,
    suffer_score: m.relative_effort,
    trainer: m.is_trainer,
    best_efforts: (m.best_efforts ?? [])
      .map((e) => ({ name: EFFORT[e.name.toLowerCase()] ?? e.name, elapsed_time: e.seconds, moving_time: e.seconds, distance: 0 })),
  };
  const a = mapStravaActivity(s);
  a.id = `strava-${m.id}`;
  if (m.avg_hr && m.moving_time > 0) a.hrZones = estimatedZones(m.avg_hr, m.moving_time);
  // Sessões-chave por heurística (sem plano de treino conectado).
  if (a.type === 'run' && a.distanceM >= 16000) a.keySession = 'long_run';
  if ((a.type === 'ride' || a.type === 'virtual_ride') && a.movingTimeS >= 2.5 * 3600) a.keySession = 'long_ride';
  if (RACE_RE.test(m.name) && !NOT_RACE_RE.test(m.name) && (m.relative_effort ?? 0) >= 60) a.keySession = 'race';
  return a;
});

// Triathlon: natação → bike → corrida no mesmo dia, tudo em até 3h30 → prova.
{
  const byDay = new Map<string, Activity[]>();
  for (const a of activities) byDay.set(a.date.slice(0, 10), [...(byDay.get(a.date.slice(0, 10)) ?? []), a]);
  for (const day of byDay.values()) {
    const swim = day.find((a) => (a.type === 'swim' || a.type === 'open_water_swim') && a.distanceM >= 300 && a.distanceM <= 4200);
    if (!swim) continue;
    const t0 = Date.parse(swim.date);
    // Transições curtas (≤ 12 min) separam prova de treino combinado.
    const swimEnd = t0 + (swim.elapsedTimeS ?? swim.movingTimeS) * 1000;
    const bike = day.find((a) => a.type === 'ride' && Date.parse(a.date) >= swimEnd - 2 * 60_000 && Date.parse(a.date) - swimEnd <= 12 * 60_000);
    if (!bike) continue;
    const t1 = Date.parse(bike.date) + (bike.elapsedTimeS ?? bike.movingTimeS) * 1000;
    const run = day.find((a) => a.type === 'run' && Date.parse(a.date) >= t1 - 2 * 60_000 && Date.parse(a.date) - t1 <= 10 * 60_000);
    if (run) for (const a of [swim, bike, run]) a.keySession = 'race';
  }
}

// Bricks: corrida começando até 45 min depois do fim de um pedal.
for (let i = 1; i < activities.length; i++) {
  const a = activities[i];
  if (a.type !== 'run' || a.keySession === 'race') continue;
  const prev = activities.slice(Math.max(0, i - 3), i).reverse().find((p) => p.type === 'ride' || p.type === 'virtual_ride');
  if (!prev) continue;
  const gap = (Date.parse(a.date) - (Date.parse(prev.date) + (prev.elapsedTimeS ?? prev.movingTimeS) * 1000)) / 60000;
  if (gap >= 0 && gap <= 45) a.keySession = 'brick';
}

// ─── Perfil: fatos do Strava + estimativas sinalizadas ───
const lastYear = activities.filter((a) => a.date.slice(0, 10) >= addDays(today, -365));
// FC máx robusta: percentil 99 das máximas de corrida/bike (ignora picos de sensor).
const maxes = lastYear.filter((a) => a.type === 'run' || a.type === 'ride' || a.type === 'virtual_ride').map((a) => a.maxHr ?? 0).filter((x) => x > 0).sort((a, b) => a - b);
const hrMax = maxes.length ? maxes[Math.floor((maxes.length - 1) * 0.99)] : 0;
const best = (key: '5k' | '10k') => Math.min(...activities.map((a) => a.bestEfforts?.run?.[key] ?? Infinity));
const best5k = best('5k');
const best10k = best('10k');
// Limiar ≈ pace de ~1h: 10 km × 1,03 ou 5 km × 1,06 — usa a estimativa mais rápida.
const thrCandidates = [best10k / 10 * 1.03, best5k / 5 * 1.06].filter(Number.isFinite);
const thrPace = thrCandidates.length ? Math.min(...thrCandidates) : 270;
const thrFrom = thrCandidates.length && thrPace === best5k / 5 * 1.06 ? '5 km' : '10 km';
const poolSwims = activities
  .filter((a) => a.type === 'swim' && a.distanceM >= 1000 && a.movingTimeS > 0)
  .map((a) => a.movingTimeS / (a.distanceM / 100))
  .sort((a, b) => a - b);
const css = poolSwims.length ? poolSwims[Math.floor(poolSwims.length * 0.1)] - 3 : 115;
const last12w = activities.filter((a) => a.date.slice(0, 10) >= addDays(today, -84));
const weeklyHours = last12w.reduce((s, a) => s + a.movingTimeS, 0) / 3600 / 12;

function addDays(iso: string, d: number) {
  const x = new Date(iso + 'T00:00:00Z');
  x.setUTCDate(x.getUTCDate() + d);
  return x.toISOString().slice(0, 10);
}
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

const athlete: Athlete = {
  id: 'me',
  name: 'Cristiano Kanashiro',
  nickname: 'Kana',
  birthDate: '1978-09-20',
  sex: 'M',
  weightKg: 78,
  heightCm: 175,
  ftpW: 261,
  vo2max: 0,
  hrMax: hrMax || 175,
  lthr: Math.round((hrMax || 175) * 0.9),
  thresholdPaceSecPerKm: Math.round(thrPace),
  cssSecPer100m: Math.round(css),
  injuries: [],
  avgWeeklyHours: Math.round(weeklyHours * 10) / 10,
  mainGoal: 'Competir por vaga no Mundial — foco Strava: "Ironman full 2027"',
  targetRaceName: 'IRONMAN full 2027 (definir prova)',
  targetRaceDate: '2027-06-14',
  targetRaceDistance: 'full',
  goals: [
    { id: 'g-swim', label: 'Natação em águas abertas', discipline: 'swim', metric: 'swim_pace_100m', target: 102, context: '1:40–1:45/100m em águas abertas' },
    { id: 'g-bike', label: 'Bike de prova', discipline: 'bike', metric: 'bike_speed_kmh', target: 37, context: 'média de prova ~37 km/h' },
    { id: 'g-run', label: 'Maratona do IRONMAN', discipline: 'run', metric: 'run_pace_km', target: 290, context: 'pace de 4:50/km no full' },
  ],
  history: [{ date: today, ftpW: 261, weightKg: 78, thresholdPaceSecPerKm: Math.round(thrPace), cssSecPer100m: Math.round(css) }],
  estimates: [
    'Peso 78 kg e FTP 261 W: vindos do Strava (FTP estimado pelo Strava a partir da potência).',
    `FC máx ${hrMax} bpm: maior FC registrada nos últimos 12 meses.`,
    `LTHR ${Math.round((hrMax || 175) * 0.9)} bpm: estimado como 90% da FC máx — faça um teste de limiar.`,
    `Pace de limiar ${fmt(thrPace)}/km: estimado a partir do melhor ${thrFrom} registrado no Strava.`,
    `CSS ${fmt(css)}/100m: estimado pelos treinos de piscina mais rápidos — faça o teste 400/200.`,
    'VO₂ Max, altura e histórico de lesões: não disponíveis no Strava — preencha no perfil.',
    'Prova-alvo: o Strava informa só "Ironman full 2027" — defina a prova e a data.',
  ],
};

const seed = {
  generatedAt: new Date().toISOString(),
  source: `Strava (conector Claude) · ${activities.length} atividades de ${activities[0]?.date.slice(0, 10)} a ${activities[activities.length - 1]?.date.slice(0, 10)}`,
  athlete,
  races: [],
  results: [],
  competitors: [],
  activities,
};

const out = process.env.SEED_OUT ?? path.join(process.cwd(), 'data', 'seed.json');
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(seed));
const detected = activities.filter((a) => a.keySession === 'race');
console.log(`seed.json: ${activities.length} atividades; ${detected.length} provas detectadas`);
for (const r of detected) console.log(` - ${r.date.slice(0, 10)} ${r.type} ${r.name.replace(/\n/g, ' ')} ${(r.distanceM / 1000).toFixed(1)} km ${Math.round(r.movingTimeS / 60)} min`);
console.log(athlete.estimates?.join('\n'));

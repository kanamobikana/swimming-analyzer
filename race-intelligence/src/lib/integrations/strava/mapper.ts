/** Strava API v3 → modelo interno. Puro e testado (sem rede). */
import type { Activity, ActivityType, Lap, ZoneTime } from '../../domain/types';

/** Subconjunto de SummaryActivity/DetailedActivity usado aqui. */
export interface StravaActivity {
  id: number;
  name: string;
  sport_type?: string;
  type?: string;
  start_date: string;
  start_date_local?: string;
  moving_time: number;
  elapsed_time?: number;
  distance: number;
  total_elevation_gain?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_watts?: number;
  weighted_average_watts?: number;
  device_watts?: boolean;
  average_cadence?: number;
  kilojoules?: number;
  calories?: number;
  suffer_score?: number | null;
  trainer?: boolean;
  workout_type?: number | null;
  best_efforts?: { name: string; elapsed_time: number; moving_time: number; distance: number }[];
  laps?: { lap_index: number; distance: number; moving_time: number; average_heartrate?: number; average_watts?: number; average_cadence?: number }[];
}

export interface StravaZone {
  type: 'heartrate' | 'power';
  distribution_buckets: { min: number; max: number; time: number }[];
}

export function mapSportType(a: Pick<StravaActivity, 'sport_type' | 'type' | 'name' | 'trainer'>): ActivityType {
  const t = a.sport_type ?? a.type ?? '';
  switch (t) {
    case 'Run':
    case 'TrailRun':
    case 'VirtualRun':
      return 'run';
    case 'Ride':
    case 'GravelRide':
    case 'MountainBikeRide':
    case 'EBikeRide':
    case 'EMountainBikeRide':
      return a.trainer ? 'virtual_ride' : 'ride';
    case 'VirtualRide':
      return 'virtual_ride';
    case 'Swim':
      return /(águas abertas|aguas abertas|open water|\bmar\b|travessia|\bow\b)/i.test(a.name) ? 'open_water_swim' : 'swim';
    case 'WeightTraining':
    case 'Crossfit':
    case 'Workout':
    case 'HighIntensityIntervalTraining':
    case 'Pilates':
    case 'Yoga':
      return 'strength';
    default:
      return 'other';
  }
}

const RUN_EFFORTS: Record<string, '1k' | '5k' | '10k' | '21k' | '42k'> = {
  '1k': '1k',
  '5k': '5k',
  '10k': '10k',
  'Half-Marathon': '21k',
  Marathon: '42k',
};

/** Strava entrega buckets de zona com limites próprios; normalizamos para 5 zonas. */
export function zonesToFive(z: StravaZone | undefined): ZoneTime | undefined {
  if (!z?.distribution_buckets?.length) return undefined;
  const b = z.distribution_buckets.map((x) => x.time);
  if (b.length === 5) return { seconds: b as ZoneTime['seconds'] };
  // Potência vem em 6–7 buckets (Coggan): agrupa os de cima em Z5.
  const five = [b[0] ?? 0, b[1] ?? 0, b[2] ?? 0, b[3] ?? 0, b.slice(4).reduce((a, x) => a + x, 0)];
  return { seconds: five as ZoneTime['seconds'] };
}

export function mapStravaActivity(a: StravaActivity, zones?: StravaZone[]): Activity {
  const type = mapSportType(a);
  const runBests: NonNullable<Activity['bestEfforts']>['run'] = {};
  for (const e of a.best_efforts ?? []) {
    const k = RUN_EFFORTS[e.name];
    if (k) runBests[k] = e.moving_time ?? e.elapsed_time;
  }
  const laps: Lap[] | undefined = a.laps?.map((l) => ({
    index: l.lap_index,
    distanceM: l.distance,
    movingTimeS: l.moving_time,
    avgHr: l.average_heartrate,
    avgPowerW: l.average_watts,
    avgCadence: l.average_cadence,
  }));
  const hasPower = a.device_watts !== false && a.average_watts != null;
  return {
    id: `strava-${a.id}`,
    source: 'strava',
    externalId: String(a.id),
    date: a.start_date_local ?? a.start_date,
    type,
    name: a.name,
    movingTimeS: a.moving_time,
    elapsedTimeS: a.elapsed_time,
    distanceM: a.distance,
    elevationGainM: a.total_elevation_gain,
    avgHr: a.average_heartrate,
    maxHr: a.max_heartrate,
    avgPowerW: hasPower ? a.average_watts : undefined,
    normalizedPowerW: hasPower ? a.weighted_average_watts : undefined,
    // Corrida no Strava reporta cadência por perna: dobra para passos/min.
    avgCadence: a.average_cadence != null ? (type === 'run' ? a.average_cadence * 2 : a.average_cadence) : undefined,
    calories: a.calories ?? (a.kilojoules ? Math.round(a.kilojoules) : undefined),
    relativeEffort: a.suffer_score ?? undefined,
    hrZones: zonesToFive(zones?.find((z) => z.type === 'heartrate')),
    powerZones: zonesToFive(zones?.find((z) => z.type === 'power')),
    laps,
    keySession: a.workout_type === 1 ? 'race' : a.workout_type === 2 ? 'long_run' : undefined,
    bestEfforts: Object.keys(runBests).length ? { run: runBests } : undefined,
  };
}

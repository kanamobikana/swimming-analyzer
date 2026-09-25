/**
 * "What if?" — simula um resultado a partir de paces/velocidades/watts e
 * posiciona esse resultado no field REAL daquela edição.
 */
import type { RaceResult, Splits } from '../domain/types';
import { timeFromPace100, timeFromPaceKm, timeFromSpeedKmh } from '../domain/time';
import { percentileOf, sumSplits } from './race';

export interface SimInput {
  swimPaceSecPer100: number;
  /** Se bikeWatts vier preenchido, a velocidade é derivada do modelo de potência. */
  bikeSpeedKmh?: number;
  bikeWatts?: number;
  t1S: number;
  t2S: number;
  runPaceSecPerKm: number;
}

export interface Course {
  swimM: number;
  bikeM: number;
  runM: number;
}

export interface BikePowerModel {
  /** CdA efetivo (m²). Calibrado pela prova real quando possível. */
  cda: number;
  crr: number;
  massKg: number; // atleta + bike
  rho: number; // densidade do ar
  drivetrainEff: number;
}

export const DEFAULT_BIKE_MODEL: BikePowerModel = {
  cda: 0.26,
  crr: 0.0045,
  massKg: 82,
  rho: 1.18,
  drivetrainEff: 0.975,
};

const G = 9.81;

/** Potência necessária (W) para manter v (m/s) em terreno plano sem vento. */
export function powerForSpeed(vMs: number, m: BikePowerModel = DEFAULT_BIKE_MODEL): number {
  const aero = 0.5 * m.rho * m.cda * vMs ** 3;
  const rolling = m.crr * m.massKg * G * vMs;
  return (aero + rolling) / m.drivetrainEff;
}

/** Inverte o modelo por bisseção: velocidade (km/h) sustentada com P watts. */
export function speedForPower(watts: number, m: BikePowerModel = DEFAULT_BIKE_MODEL): number {
  if (!(watts > 0)) return NaN;
  let lo = 0.5;
  let hi = 30; // m/s
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (powerForSpeed(mid, m) > watts) hi = mid;
    else lo = mid;
  }
  return ((lo + hi) / 2) * 3.6;
}

/**
 * Calibra o CdA efetivo para que o modelo reproduza a velocidade real da prova
 * com a potência média real. Absorve altimetria/vento/pavimento daquele percurso,
 * então a simulação em watts fica "do percurso", não de laboratório.
 */
export function calibrateModel(actualSpeedKmh: number, actualWatts: number, base = DEFAULT_BIKE_MODEL): BikePowerModel {
  if (!(actualSpeedKmh > 0 && actualWatts > 0)) return base;
  const v = actualSpeedKmh / 3.6;
  const rolling = base.crr * base.massKg * G * v;
  const aeroPower = actualWatts * base.drivetrainEff - rolling;
  const cda = aeroPower > 0 ? aeroPower / (0.5 * base.rho * v ** 3) : base.cda;
  return { ...base, cda: Math.min(Math.max(cda, 0.15), 0.6) };
}

export function simulateSplits(input: SimInput, course: Course, model = DEFAULT_BIKE_MODEL): Splits & { bikeSpeedKmh: number } {
  const bikeSpeedKmh = input.bikeWatts && input.bikeWatts > 0 ? speedForPower(input.bikeWatts, model) : (input.bikeSpeedKmh ?? NaN);
  return {
    swim: course.swimM > 0 ? timeFromPace100(input.swimPaceSecPer100, course.swimM) : 0,
    t1: input.t1S,
    bike: course.bikeM > 0 ? timeFromSpeedKmh(bikeSpeedKmh, course.bikeM) : 0,
    t2: input.t2S,
    run: timeFromPaceKm(input.runPaceSecPerKm, course.runM),
    bikeSpeedKmh,
  };
}

export interface Placement {
  totalS: number;
  rank: number;
  fieldSize: number;
  percentile: number;
  /** Quem estaria imediatamente à frente e atrás. */
  ahead?: RaceResult;
  behind?: RaceResult;
  /** Rank de cada split simulado isolado no field. */
  splitRanks: { swim: number; bike: number; run: number };
}

/**
 * Posição que o resultado simulado teria. O próprio atleta é removido do field
 * (ele está sendo substituído pela versão simulada).
 */
export function placeInField(splits: Splits, field: RaceResult[]): Placement {
  const others = field.filter((r) => !r.isMe).sort((a, b) => a.totalS - b.totalS);
  const totalS = sumSplits(splits);
  const faster = others.filter((r) => r.totalS < totalS);
  const rank = faster.length + 1;
  const n = others.length + 1;
  return {
    totalS,
    rank,
    fieldSize: n,
    percentile: percentileOf(rank, n),
    ahead: faster[faster.length - 1],
    behind: others[faster.length],
    splitRanks: {
      swim: 1 + others.filter((r) => r.splits.swim < splits.swim).length,
      bike: 1 + others.filter((r) => r.splits.bike < splits.bike).length,
      run: 1 + others.filter((r) => r.splits.run < splits.run).length,
    },
  };
}

/** Tempo alvo necessário para atingir um rank (fica 1s à frente do atleta nessa posição). */
export function timeNeededForRank(field: RaceResult[], targetRank: number): number | undefined {
  const others = field.filter((r) => !r.isMe).sort((a, b) => a.totalS - b.totalS);
  const target = others[targetRank - 1];
  if (!target) return undefined;
  return target.totalS - 1;
}

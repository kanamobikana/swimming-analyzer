/**
 * Modelo de domínio do Race Performance Intelligence.
 *
 * Convenções (valem para o app inteiro):
 * - Durações sempre em SEGUNDOS (number).
 * - Distâncias em METROS.
 * - Velocidade em m/s internamente; formatação converte para km/h ou min/km.
 * - Datas como string ISO (YYYY-MM-DD ou ISO completo).
 *
 * As entidades espelham as tabelas previstas em `prisma/schema.prisma`
 * (Athletes, Activities, Races, RaceResults, RaceSplits, Competitors,
 * Benchmarks, TrainingMetrics, PerformanceMetrics, Goals).
 */

export type Sex = 'M' | 'F';
export type Discipline = 'swim' | 'bike' | 'run';
export type SplitKey = 'swim' | 't1' | 'bike' | 't2' | 'run';
export const SPLIT_KEYS: SplitKey[] = ['swim', 't1', 'bike', 't2', 'run'];

/** Proveniência do dado — o produto nunca mistura fato com estimativa sem avisar. */
export type DataProvenance = 'official' | 'imported' | 'manual' | 'estimate' | 'mock';

// ───────────────────────────── Atleta ─────────────────────────────

export interface InjuryRecord {
  date: string;
  description: string;
  weeksOff?: number;
}

export interface Athlete {
  id: string;
  name: string;
  nickname?: string;
  birthDate: string; // YYYY-MM-DD
  sex: Sex;
  weightKg: number;
  heightCm: number;
  ftpW: number;
  vo2max: number;
  hrMax: number;
  lthr: number; // FC de limiar de lactato
  thresholdPaceSecPerKm: number;
  cssSecPer100m: number;
  restingHr?: number;
  injuries: InjuryRecord[];
  avgWeeklyHours: number;
  mainGoal: string;
  targetRaceName: string;
  targetRaceDate: string;
  targetRaceDistance: RaceDistance;
  /** Metas de performance por modalidade (ex.: 1:42/100m, 37 km/h, 4:50/km). */
  goals: Goal[];
  /** Histórico de valores fisiológicos (para KPI atual × anterior). */
  history: PhysioSnapshot[];
  /** Campos estimados (não medidos) — exibidos no perfil para revisão. */
  estimates?: string[];
}

export interface PhysioSnapshot {
  date: string;
  ftpW?: number;
  vo2max?: number;
  weightKg?: number;
  thresholdPaceSecPerKm?: number;
  cssSecPer100m?: number;
}

export interface Goal {
  id: string;
  label: string;
  discipline: Discipline | 'overall';
  metric: 'swim_pace_100m' | 'bike_speed_kmh' | 'run_pace_km' | 'total_time' | 'ftp' | 'category_position';
  target: number;
  context?: string; // ex.: "águas abertas, IRONMAN"
  deadline?: string;
}

// ───────────────────────────── Treinos ─────────────────────────────

export type ActivityType =
  | 'run'
  | 'ride'
  | 'virtual_ride'
  | 'swim'
  | 'open_water_swim'
  | 'strength'
  | 'brick'
  | 'other';

export interface ZoneTime {
  /** Segundos em Z1..Z5 (índice 0 = Z1). */
  seconds: [number, number, number, number, number];
}

export interface Lap {
  index: number;
  distanceM: number;
  movingTimeS: number;
  avgHr?: number;
  avgPowerW?: number;
  avgCadence?: number;
}

export interface Activity {
  id: string;
  source: 'strava' | 'fit' | 'gpx' | 'tcx' | 'csv' | 'manual' | 'mock';
  externalId?: string;
  date: string; // ISO completo
  type: ActivityType;
  name: string;
  movingTimeS: number;
  elapsedTimeS?: number;
  distanceM: number;
  avgHr?: number;
  maxHr?: number;
  avgPowerW?: number;
  normalizedPowerW?: number;
  avgCadence?: number;
  elevationGainM?: number;
  calories?: number;
  /** Relative Effort do Strava (suffer score), quando disponível. */
  relativeEffort?: number;
  /** Training Load (Garmin/Strava) quando vier da fonte. */
  sourceTrainingLoad?: number;
  hrZones?: ZoneTime;
  powerZones?: ZoneTime;
  laps?: Lap[];
  /** Desacoplamento cardíaco (Pw:HR ou Pa:HR) em fração, ex.: 0.043 = 4,3%. */
  decoupling?: number;
  /** Sessão marcada como chave no plano (long run, long ride, brick, limiar...). */
  keySession?: 'long_run' | 'long_ride' | 'brick' | 'threshold' | 'vo2' | 'race';
  /** Planejado × executado, quando houver plano (TrainingPeaks/Strava). */
  planned?: boolean;
  completed?: boolean;
  /** Melhores esforços medidos na série (Strava best_efforts / curva de potência). */
  bestEfforts?: {
    run?: Partial<Record<'1k' | '5k' | '10k' | '21k' | '42k', number>>;
    swim?: Partial<Record<'400' | '750' | '1000' | '1500' | '1900', number>>;
    power?: Partial<Record<'5m' | '20m' | '60m', number>>;
  };
}

/** Métricas derivadas por atividade (calculadas, nunca importadas). */
export interface ActivityMetrics {
  tss: number;
  tssMethod: 'power' | 'pace' | 'swim_pace' | 'hr' | 'duration_estimate';
  intensityFactor?: number;
  variabilityIndex?: number;
  efficiencyFactor?: number; // NP/FC (bike) ou velocidade/FC (corrida)
  wPerKg?: number;
}

/** Série diária de carga (PMC). */
export interface TrainingLoadPoint {
  date: string; // YYYY-MM-DD
  tss: number;
  ctl: number; // Fitness
  atl: number; // Fatigue
  tsb: number; // Form
}

// ───────────────────────────── Provas ─────────────────────────────

export type RaceDistance =
  | 'sprint'
  | 'olympic'
  | '70.3'
  | 'full'
  | 'run_5k'
  | 'run_10k'
  | 'half_marathon'
  | 'marathon';

export type RaceBrand = 'IRONMAN' | 'IRONMAN 70.3' | 'Challenge' | 'T100' | 'Independente';

export interface RaceConditions {
  weather?: string;
  airTempC?: number;
  windKmh?: number;
  waterTempC?: number;
  wetsuitAllowed?: boolean;
  /** Curso real difere do nominal (ex.: natação encurtada). */
  courseNotes?: string;
}

export interface Race {
  id: string;
  name: string;
  brand: RaceBrand;
  date: string;
  location: string;
  distance: RaceDistance;
  /** Distâncias reais do percurso em metros (swim/bike/run). */
  course: { swimM: number; bikeM: number; runM: number };
  category: string; // categoria do atleta nesta prova (ex.: M45-49)
  bibNumber?: string;
  resultsUrl?: string;
  conditions: RaceConditions;
  notes?: string;
  provenance: DataProvenance;
  /** Resultado do próprio atleta. */
  myResultId?: string;
  /** Informações de vagas para Mundial, quando existirem. */
  slots?: SlotAllocation;
  /** Potência média (ou NP) do atleta na bike desta prova — calibra o simulador em watts. */
  myBikePowerW?: number;
}

export interface Splits {
  swim: number;
  t1: number;
  bike: number;
  t2: number;
  run: number;
}

/**
 * Uma linha de resultado (qualquer atleta do field).
 * Posições podem vir ausentes se a fonte não informar.
 */
export interface RaceResult {
  id: string;
  raceId: string;
  competitorId: string;
  athleteName: string;
  category: string;
  sex: Sex;
  bib?: string;
  country?: string;
  splits: Splits;
  totalS: number;
  overallRank?: number;
  genderRank?: number;
  categoryRank?: number;
  /** Posição na categoria após cada modalidade (swim, após T1+bike, após T2+run). */
  rankAfter?: { swim?: number; bike?: number; run?: number };
  status: 'finisher' | 'dnf' | 'dsq' | 'dns';
  isMe?: boolean;
}

export interface Competitor {
  id: string;
  name: string;
  sex: Sex;
  /** Categoria mais recente observada em resultados públicos. */
  category: string;
  country?: string;
  tracked?: boolean;
}

// ─────────────────────── Road to Worlds / vagas ───────────────────────

export interface SlotAllocation {
  championship: 'IRONMAN World Championship' | 'IRONMAN 70.3 World Championship';
  /** Vagas totais da prova, se oficial. */
  totalSlots?: number;
  /** Vagas para a categoria do atleta. */
  categorySlots?: number;
  allocationRule?: string;
  /** Atletas que aceitaram (quando publicado). */
  accepted?: { name: string; categoryRank: number; totalS?: number }[];
  /** Posição mais baixa da categoria que conquistou vaga (incluindo rolldown). */
  lastQualifierRank?: number;
  lastQualifierTimeS?: number;
  /** Fonte da informação — diferencia oficial de estimativa. */
  provenance: 'official' | 'estimate';
  sourceNote?: string;
}

// ───────────────────────────── Benchmarks ─────────────────────────────

export type BenchmarkKey =
  | 'P1'
  | 'P3'
  | 'P5'
  | 'P10'
  | 'P20'
  | 'TOP10PCT'
  | 'TOP20PCT'
  | 'MEDIAN'
  | 'LAST_SLOT';

export interface Benchmark {
  key: BenchmarkKey;
  label: string;
  /** Posição usada (quando é uma linha real do field). */
  rank?: number;
  splits: Splits;
  totalS: number;
  /** 'actual' = linha real de um atleta; 'synthetic' = mediana por modalidade. */
  kind: 'actual' | 'synthetic';
  athleteName?: string;
}

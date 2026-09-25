/**
 * Provas de EXEMPLO com fields sintéticos da categoria.
 * Nomes de atletas são fictícios. Tudo marcado com provenance 'mock' e
 * substituído ao importar a URL oficial de resultados.
 */
import type { Competitor, Race, RaceDistance, RaceResult, Splits } from '../../domain/types';
import { NOMINAL_COURSE } from '../../domain/race-meta';
import { parseDuration } from '../../domain/time';
import { rng, type Rng } from './random';

const FIRST = ['Rodrigo', 'Marcelo', 'Fábio', 'André', 'Ricardo', 'Eduardo', 'Paulo', 'Sérgio', 'Luciano', 'Gustavo', 'Alexandre', 'Daniel', 'Fernando', 'Márcio', 'Rogério', 'Leandro', 'Maurício', 'Renato', 'Cláudio', 'Fabrício', 'Júlio', 'Henrique', 'Rafael', 'Thiago', 'Leonardo', 'Vinícius', 'Otávio', 'Anderson', 'Roberto', 'Wagner'];
const LAST = ['A.', 'B.', 'C.', 'D.', 'F.', 'G.', 'L.', 'M.', 'N.', 'P.', 'R.', 'S.', 'T.', 'V.', 'Z.'];

interface Ability {
  /** Fator global (1 = mediano). Menor = mais rápido. */
  f: number;
  swim: number;
  bike: number;
  run: number;
  trans: number;
}

interface PoolAthlete extends Competitor {
  ability: Ability;
}

const CATEGORY = 'M45-49';

function makePool(r: Rng, n: number): PoolAthlete[] {
  const used = new Set<string>();
  const pool: PoolAthlete[] = [];
  for (let i = 0; i < n; i++) {
    let name = '';
    do name = `${r.pick(FIRST)} ${r.pick(LAST)}`;
    while (used.has(name));
    used.add(name);
    pool.push({
      id: `c${String(i + 1).padStart(3, '0')}`,
      name,
      sex: 'M',
      category: CATEGORY,
      country: r.chance(0.9) ? 'BRA' : r.pick(['ARG', 'CHI', 'URU', 'USA', 'POR']),
      // Pool recorrente é enviesado para o terço mais rápido (quem viaja para 70.3 é competitivo).
      ability: {
        f: Math.exp(r.normal(-0.06, 0.07)),
        swim: Math.exp(r.normal(0, 0.09)),
        bike: Math.exp(r.normal(0, 0.045)),
        run: Math.exp(r.normal(0, 0.065)),
        trans: Math.exp(r.normal(0, 0.22)),
      },
    });
  }
  return pool;
}

interface RaceSpec {
  race: Omit<Race, 'course' | 'category' | 'provenance'> & { course?: Race['course'] };
  /** Tempo do vencedor da categoria. */
  p1: string;
  fieldSize: number;
  myRank: number;
  mySplits: string[]; // swim, t1, bike, t2, run
  /** Splits do atleta mediano do field. */
  medianSplits: string[];
  spread: number; // desvio do fator global
  poolShare: number; // fração do pool recorrente presente
  myBikePowerW?: number;
}

const SPECS: RaceSpec[] = [
  {
    race: { id: 'r-2025-sprint-santos', name: 'Triathlon Sprint Santos', brand: 'Independente', date: '2025-03-23', location: 'Santos, SP', distance: 'sprint', bibNumber: '214', conditions: { weather: 'Nublado', airTempC: 26, windKmh: 12, waterTempC: 25, wetsuitAllowed: false } },
    p1: '1:07:30', fieldSize: 38, myRank: 2,
    mySplits: ['15:10', '1:45', '33:30', '1:05', '21:10'],
    medianSplits: ['17:30', '2:20', '37:30', '1:30', '25:00'],
    spread: 0.1, poolShare: 0.15,
  },
  {
    race: { id: 'r-2025-703-sp', name: 'IRONMAN 70.3 São Paulo', brand: 'IRONMAN 70.3', date: '2025-06-01', location: 'São Paulo, SP', distance: '70.3', bibNumber: '1187', conditions: { weather: 'Sol, frio pela manhã', airTempC: 19, windKmh: 14, waterTempC: 20, wetsuitAllowed: true },
      slots: { championship: 'IRONMAN 70.3 World Championship', categorySlots: 3, lastQualifierRank: 4, provenance: 'estimate', sourceNote: 'Estimativa: 3 vagas proporcionais ao nº de inscritos; 1 rolldown típico. Lista oficial não importada.' } },
    p1: '4:24:00', fieldSize: 180, myRank: 41,
    mySplits: ['38:45', '3:50', '2:34:10', '2:25', '1:43:30'],
    medianSplits: ['40:30', '3:50', '2:46:00', '2:30', '2:03:30'],
    spread: 0.085, poolShare: 0.7, myBikePowerW: 196,
  },
  {
    race: { id: 'r-2025-meia-rio', name: 'Meia Maratona do Rio', brand: 'Independente', date: '2025-08-17', location: 'Rio de Janeiro, RJ', distance: 'half_marathon', bibNumber: '8841', conditions: { weather: 'Sol', airTempC: 24, windKmh: 8 } },
    p1: '1:18:00', fieldSize: 410, myRank: 45,
    mySplits: ['0', '0', '0', '0', '1:36:40'],
    medianSplits: ['0', '0', '0', '0', '1:58:00'],
    spread: 0.12, poolShare: 0.1,
  },
  {
    race: { id: 'r-2025-olimpico-rio', name: 'Triathlon Olímpico Rio', brand: 'Independente', date: '2025-10-19', location: 'Rio de Janeiro, RJ', distance: 'olympic', bibNumber: '331', conditions: { weather: 'Sol', airTempC: 27, windKmh: 18, waterTempC: 22, wetsuitAllowed: true } },
    p1: '2:06:00', fieldSize: 64, myRank: 9,
    mySplits: ['29:40', '2:10', '1:08:20', '1:20', '40:00'],
    medianSplits: ['31:30', '2:50', '1:14:00', '1:40', '47:00'],
    spread: 0.09, poolShare: 0.3,
  },
  {
    race: { id: 'r-2025-703-brasilia', name: 'IRONMAN 70.3 Brasília', brand: 'IRONMAN 70.3', date: '2025-11-30', location: 'Brasília, DF', distance: '70.3', bibNumber: '905', conditions: { weather: 'Sol forte, seco', airTempC: 31, windKmh: 10, waterTempC: 26, wetsuitAllowed: false, courseNotes: 'Corrida quente, sem sombra' },
      slots: { championship: 'IRONMAN 70.3 World Championship', totalSlots: 75, categorySlots: 3, allocationRule: 'Alocação proporcional ao nº de largadas por categoria; rolldown na cerimônia.', lastQualifierRank: 5, lastQualifierTimeS: undefined, provenance: 'official', sourceNote: 'Lista de slot allocation publicada pelo organizador (dados de exemplo).' } },
    p1: '4:28:00', fieldSize: 150, myRank: 22,
    mySplits: ['37:40', '3:35', '2:29:50', '2:15', '1:38:50'],
    medianSplits: ['40:00', '3:40', '2:42:00', '2:20', '2:04:30'],
    spread: 0.08, poolShare: 0.45, myBikePowerW: 205,
  },
  {
    race: { id: 'r-2026-olimpico-bsb', name: 'Triathlon Olímpico Brasília', brand: 'Independente', date: '2026-03-22', location: 'Brasília, DF', distance: 'olympic', bibNumber: '118', conditions: { weather: 'Nublado', airTempC: 24, windKmh: 9, waterTempC: 25, wetsuitAllowed: false } },
    p1: '2:04:30', fieldSize: 70, myRank: 6,
    mySplits: ['28:30', '1:55', '1:05:40', '1:10', '39:30'],
    medianSplits: ['31:00', '2:40', '1:12:30', '1:35', '46:00'],
    spread: 0.09, poolShare: 0.3,
  },
  {
    race: { id: 'r-2026-703-sp', name: 'IRONMAN 70.3 São Paulo', brand: 'IRONMAN 70.3', date: '2026-05-31', location: 'São Paulo, SP', distance: '70.3', bibNumber: '842', conditions: { weather: 'Sol, vento moderado', airTempC: 21, windKmh: 20, waterTempC: 20, wetsuitAllowed: true },
      slots: { championship: 'IRONMAN 70.3 World Championship', totalSlots: 75, categorySlots: 4, allocationRule: 'Alocação proporcional ao nº de largadas por categoria; rolldown na cerimônia.', lastQualifierRank: 6, provenance: 'official', sourceNote: 'Lista de slot allocation publicada pelo organizador (dados de exemplo).' } },
    p1: '4:19:30', fieldSize: 210, myRank: 28,
    mySplits: ['36:50', '3:20', '2:28:30', '2:05', '1:37:20'],
    medianSplits: ['40:00', '3:40', '2:44:00', '2:20', '1:59:30'],
    spread: 0.085, poolShare: 0.85, myBikePowerW: 212,
  },
  {
    race: { id: 'r-2026-sprint-ilhabela', name: 'Triathlon Sprint Ilhabela', brand: 'Independente', date: '2026-08-09', location: 'Ilhabela, SP', distance: 'sprint', bibNumber: '57', conditions: { weather: 'Sol', airTempC: 23, windKmh: 6, waterTempC: 21, wetsuitAllowed: true } },
    p1: '1:05:40', fieldSize: 42, myRank: 3,
    mySplits: ['14:20', '1:35', '32:40', '0:55', '20:25'],
    medianSplits: ['17:00', '2:15', '37:00', '1:25', '24:30'],
    spread: 0.1, poolShare: 0.15,
  },
];

const toSplits = (xs: string[]): Splits => {
  const [swim, t1, bike, t2, run] = xs.map(parseDuration);
  return { swim, t1, bike, t2, run };
};
const total = (s: Splits) => s.swim + s.t1 + s.bike + s.t2 + s.run;

/**
 * Curva tempo × posição ancorada em P1, na minha posição real e na mediana:
 * topo esparso (côncavo), meio linear, cauda lenta. Deixa o field crível e o
 * meu resultado exatamente na posição informada.
 */
function totalForRank(rank: number, n: number, p1: number, myRank: number, myT: number, med: number): number {
  const mid = Math.ceil(n / 2);
  if (rank <= myRank) return p1 + (myT - p1) * Math.pow((rank - 1) / Math.max(myRank - 1, 1), 0.6);
  if (rank <= mid) return myT + ((med - myT) * (rank - myRank)) / Math.max(mid - myRank, 1);
  return med + med * 0.42 * Math.pow((rank - mid) / Math.max(n - mid, 1), 1.6);
}

function generateField(spec: RaceSpec, pool: PoolAthlete[], r: Rng): { results: RaceResult[]; race: Race } {
  const distance: RaceDistance = spec.race.distance;
  const course = spec.race.course ?? NOMINAL_COURSE[distance];
  const race: Race = { ...spec.race, course, category: CATEGORY, provenance: 'mock', myResultId: `${spec.race.id}-me` };
  const med = toSplits(spec.medianSplits);
  const mine = toSplits(spec.mySplits);
  const n = spec.fieldSize;
  const others = n - 1;
  const myTotal = total(mine);
  const medTotal = total(med);
  const p1 = parseDuration(spec.p1);

  // Participantes: parte do pool recorrente + atletas avulsos. Ordem = habilidade + forma do dia.
  const present = pool.filter(() => r.chance(spec.poolShare)).slice(0, Math.floor(others * 0.6));
  const people: { competitor: Competitor; ability: Ability; score: number }[] = present.map((p) => ({
    competitor: p,
    ability: p.ability,
    score: Math.log(p.ability.f) + r.normal(0, 0.03),
  }));
  let k = 0;
  while (people.length < others) {
    k++;
    const f = Math.exp(r.normal(0.02, spec.spread) + Math.max(0, r.normal(0, 0.05)));
    people.push({
      competitor: { id: `${spec.race.id}-x${k}`, name: `${r.pick(FIRST)} ${r.pick(LAST)}`, sex: 'M', category: CATEGORY, country: 'BRA' },
      ability: { f, swim: Math.exp(r.normal(0, 0.1)), bike: Math.exp(r.normal(0, 0.05)), run: Math.exp(r.normal(0, 0.07)), trans: Math.exp(r.normal(0, 0.25)) },
      score: Math.log(f) + r.normal(0, 0.03),
    });
  }
  people.sort((a, b) => a.score - b.score);

  const round = (x: number) => Math.round(x);
  const scaled = people.map((p, i) => {
    const rank = i + 1 >= spec.myRank ? i + 2 : i + 1; // pula a minha posição
    const t = totalForRank(rank, n, p1, spec.myRank, myTotal, medTotal) * Math.exp(r.normal(0, 0.0004));
    const ab = p.ability;
    const speedRatio = t / medTotal;
    const t1 = med.t1 * ab.trans * (0.8 + 0.2 * speedRatio);
    const t2 = med.t2 * ab.trans * (0.8 + 0.2 * speedRatio);
    // Quem é mais rápido ganha proporcionalmente mais na corrida e menos na bike
    // (padrão observado em fields de AG): expoentes por modalidade.
    const w = {
      swim: med.swim * ab.swim * speedRatio ** 1.0,
      bike: med.bike * ab.bike * speedRatio ** 0.7,
      run: med.run * ab.run * speedRatio ** 1.4,
    };
    const wSum = w.swim + w.bike + w.run;
    const rest = t - t1 - t2;
    return {
      competitor: p.competitor,
      splits: {
        swim: round((rest * w.swim) / wSum),
        t1: round(t1),
        bike: round((rest * w.bike) / wSum),
        t2: round(t2),
        run: round((rest * w.run) / wSum),
      },
    };
  });

  const results: RaceResult[] = scaled.map((row, i) => ({
    id: `${spec.race.id}-${i}`,
    raceId: spec.race.id,
    competitorId: row.competitor.id,
    athleteName: row.competitor.name,
    category: CATEGORY,
    sex: 'M',
    splits: row.splits,
    totalS: total(row.splits),
    status: 'finisher',
    country: row.competitor.country,
  }));
  results.push({
    id: `${spec.race.id}-me`,
    raceId: spec.race.id,
    competitorId: 'me',
    athleteName: 'Cristiano Kanashiro',
    category: CATEGORY,
    sex: 'M',
    bib: spec.race.bibNumber,
    splits: mine,
    totalS: myTotal,
    status: 'finisher',
    isMe: true,
    country: 'BRA',
  });
  // Alguns DNFs para realismo.
  const dnf = Math.round(spec.fieldSize * 0.03);
  for (let i = 0; i < dnf; i++) {
    results.push({
      id: `${spec.race.id}-dnf${i}`,
      raceId: spec.race.id,
      competitorId: `${spec.race.id}-dnf${i}`,
      athleteName: `${r.pick(FIRST)} ${r.pick(LAST)}`,
      category: CATEGORY,
      sex: 'M',
      splits: { swim: med.swim, t1: med.t1, bike: 0, t2: 0, run: 0 },
      totalS: NaN,
      status: 'dnf',
    });
  }

  results.sort((a, b) => (a.totalS || Infinity) - (b.totalS || Infinity));
  results.forEach((row, i) => {
    if (row.status === 'finisher') row.categoryRank = i + 1;
  });
  // Tempo do último classificado (quando oficial) vem do próprio field.
  if (race.slots?.lastQualifierRank) {
    const q = results[race.slots.lastQualifierRank - 1];
    race.slots = { ...race.slots, lastQualifierTimeS: q?.totalS };
  }
  if (spec.myBikePowerW) race.myBikePowerW = spec.myBikePowerW;
  return { race, results };
}

export interface MockRaceData {
  races: Race[];
  results: RaceResult[];
  competitors: Competitor[];
}

export function buildMockRaces(): MockRaceData {
  const r = rng(703);
  const pool = makePool(r, 70);
  const races: Race[] = [];
  const results: RaceResult[] = [];
  for (const spec of SPECS) {
    const out = generateField(spec, pool, rng(spec.race.date.split('-').reduce((a, x) => a * 31 + Number(x), 7)));
    races.push(out.race);
    results.push(...out.results);
  }
  // Acompanha 3 rivais diretos: atletas do pool mais próximos do meu nível nas 70.3.
  const nearMe = new Map<string, number>();
  for (const race of races.filter((x) => x.distance === '70.3')) {
    const field = results.filter((x) => x.raceId === race.id && x.status === 'finisher');
    const me = field.find((x) => x.isMe)!;
    for (const row of field) {
      if (row.isMe || !row.competitorId.startsWith('c')) continue;
      nearMe.set(row.competitorId, (nearMe.get(row.competitorId) ?? 0) + (Math.abs(row.totalS - me.totalS) < 900 ? 1 : 0) + 0.2);
    }
  }
  const tracked = [...nearMe.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id);
  const competitors: Competitor[] = pool.map((p) => ({ id: p.id, name: p.name, sex: p.sex, category: p.category, country: p.country, tracked: tracked.includes(p.id) }));
  return { races, results, competitors };
}

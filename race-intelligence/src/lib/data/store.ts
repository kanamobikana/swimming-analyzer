/**
 * Persistência do MVP: um documento JSON por instalação (uso pessoal, 1 atleta).
 *
 * - Local: `.data/store.json` (fora do git).
 * - Vercel/serverless: `/tmp` (efêmero). Para produção, trocar por Postgres
 *   implementando a mesma interface `Store` com o schema de `prisma/schema.prisma`.
 *
 * Tudo que o usuário cria/importa vive aqui; os mocks nunca são gravados.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Activity, Athlete, Competitor, Race, RaceResult } from '../domain/types';

export interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch s
  athleteId: number;
  athleteName?: string;
  scope?: string;
}

export interface StoreState {
  version: 1;
  athlete?: Athlete;
  races: Race[];
  results: RaceResult[];
  competitors: Competitor[];
  activities: Activity[];
  trackedCompetitorIds?: string[];
  strava?: StravaTokens & { lastSyncAt?: string; lastSyncCount?: number };
  settings: {
    /** Mostrar provas/treinos de exemplo. undefined = automático (só sem dados reais). */
    showSampleData?: boolean;
  };
}

const EMPTY: StoreState = {
  version: 1,
  races: [],
  results: [],
  competitors: [],
  activities: [],
  settings: {},
};

function storePath() {
  const dir = process.env.DATA_DIR ?? (process.env.VERCEL ? '/tmp/race-intelligence' : path.join(process.cwd(), '.data'));
  return path.join(dir, 'store.json');
}

export async function readStore(): Promise<StoreState> {
  try {
    const raw = await fs.readFile(storePath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoreState>;
    return { ...EMPTY, ...parsed, settings: { ...EMPTY.settings, ...parsed.settings } };
  } catch {
    return structuredClone(EMPTY);
  }
}

let queue: Promise<unknown> = Promise.resolve();

/** Atualização serializada (evita escrita concorrente no mesmo arquivo). */
export function updateStore(mutate: (s: StoreState) => void | Promise<void>): Promise<StoreState> {
  const run = queue.then(async () => {
    const state = await readStore();
    await mutate(state);
    const file = storePath();
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(state));
    await fs.rename(tmp, file);
    return state;
  });
  queue = run.catch(() => undefined);
  return run;
}

/**
 * Seed versionado com dados reais do atleta (`data/seed.json`), gerado por
 * `scripts/build-seed.ts` a partir do Strava. Serve de base; o store por cima.
 */
export type SeedState = Omit<StoreState, 'strava' | 'settings' | 'version'> & { generatedAt?: string; source?: string };

let seedCache: SeedState | null | undefined;
export async function readSeed(): Promise<SeedState | null> {
  if (seedCache !== undefined) return seedCache;
  try {
    const raw = await fs.readFile(path.join(process.cwd(), 'data', 'seed.json'), 'utf8');
    seedCache = JSON.parse(raw) as SeedState;
  } catch {
    seedCache = null;
  }
  return seedCache;
}

/** Store por cima do seed: o que o usuário editou/importou vence. */
export function layer(seed: SeedState | null, store: StoreState): StoreState & { hasSeed: boolean; seedSource?: string } {
  if (!seed) return { ...store, hasSeed: false };
  const byId = <T extends { id: string }>(base: T[], over: T[]) => {
    const m = new Map(base.map((x) => [x.id, x]));
    for (const x of over) m.set(x.id, x);
    return [...m.values()];
  };
  const storeRaceIds = new Set(store.races.map((r) => r.id));
  return {
    ...store,
    athlete: store.athlete ?? seed.athlete,
    races: byId(seed.races, store.races),
    results: [...seed.results.filter((r) => !storeRaceIds.has(r.raceId)), ...store.results],
    competitors: byId(seed.competitors, store.competitors),
    activities: byId(seed.activities, store.activities).sort((a, b) => a.date.localeCompare(b.date)),
    trackedCompetitorIds: store.trackedCompetitorIds ?? seed.trackedCompetitorIds,
    hasSeed: true,
    seedSource: seed.source,
  };
}

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
    /** Mostrar provas/treinos de exemplo enquanto não há dados reais. */
    showSampleData: boolean;
  };
}

const EMPTY: StoreState = {
  version: 1,
  races: [],
  results: [],
  competitors: [],
  activities: [],
  settings: { showSampleData: true },
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

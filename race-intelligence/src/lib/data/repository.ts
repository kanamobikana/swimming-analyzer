/**
 * Ponto único de leitura de dados para as telas.
 * Mescla dados reais (store) com mocks de exemplo, sempre sinalizando a origem.
 * Para trocar a fonte (Postgres, APIs), só este arquivo e `store.ts` mudam.
 */
import type { Activity, Athlete, Competitor, Race, RaceResult } from '../domain/types';
import { MOCK_ATHLETE } from './mock/athlete';
import { buildMockRaces, type MockRaceData } from './mock/races';
import { buildMockActivities } from './mock/activities';
import { connection } from 'next/server';
import { readStore, type StoreState } from './store';

export interface Dataset {
  today: string;
  athlete: Athlete;
  races: Race[];
  results: RaceResult[];
  competitors: Competitor[];
  activities: Activity[];
  trackedCompetitorIds: string[];
  meta: {
    activitiesSource: 'strava' | 'mixed' | 'mock';
    sampleRaces: number;
    realRaces: number;
    stravaConnected: boolean;
    stravaAthleteName?: string;
    lastSyncAt?: string;
    profileIsSample: boolean;
  };
}

let mockRaces: MockRaceData | undefined;
const mockActivitiesByDay = new Map<string, Activity[]>();

function getMockRaces() {
  mockRaces ??= buildMockRaces();
  return mockRaces;
}

export function todayIso(): string {
  // Fuso de Brasília: o "dia" do atleta.
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
}

export async function getDataset(): Promise<Dataset> {
  await connection(); // sempre por requisição: dados mudam com Strava/importações
  const store = await readStore();
  return mergeDataset(store, todayIso());
}

export function mergeDataset(store: StoreState, today: string): Dataset {
  const athlete = store.athlete ?? MOCK_ATHLETE;
  const showSample = store.settings.showSampleData;
  const mock = getMockRaces();

  const races = [...store.races, ...(showSample ? mock.races : [])].sort((a, b) => a.date.localeCompare(b.date));
  const results = [...store.results, ...(showSample ? mock.results : [])];

  const byId = new Map<string, Competitor>();
  for (const c of showSample ? mock.competitors : []) byId.set(c.id, c);
  for (const c of store.competitors) byId.set(c.id, c);
  const competitors = [...byId.values()];

  const real = store.activities;
  let activities: Activity[];
  let activitiesSource: Dataset['meta']['activitiesSource'];
  if (real.length > 0) {
    activities = real;
    activitiesSource = 'strava';
  } else if (showSample) {
    const key = `${today}|${athlete.lthr}|${athlete.weightKg}`;
    if (!mockActivitiesByDay.has(key)) {
      mockActivitiesByDay.clear();
      mockActivitiesByDay.set(key, buildMockActivities(athlete, mock.races, mock.results, today));
    }
    activities = mockActivitiesByDay.get(key)!;
    activitiesSource = 'mock';
  } else {
    activities = [];
    activitiesSource = 'strava';
  }

  const tracked = store.trackedCompetitorIds ?? competitors.filter((c) => c.tracked).map((c) => c.id);

  return {
    today,
    athlete,
    races,
    results,
    competitors,
    activities,
    trackedCompetitorIds: tracked,
    meta: {
      activitiesSource,
      sampleRaces: showSample ? mock.races.length : 0,
      realRaces: store.races.length,
      stravaConnected: !!store.strava,
      stravaAthleteName: store.strava?.athleteName,
      lastSyncAt: store.strava?.lastSyncAt,
      profileIsSample: !store.athlete,
    },
  };
}

export const resultsForRace = (ds: Dataset, raceId: string) => ds.results.filter((r) => r.raceId === raceId);
export const getRace = (ds: Dataset, raceId: string) => ds.races.find((r) => r.id === raceId);
export const pastRaces = (ds: Dataset) => ds.races.filter((r) => r.date <= ds.today);
export const myResult = (ds: Dataset, raceId: string) => ds.results.find((r) => r.raceId === raceId && r.isMe);

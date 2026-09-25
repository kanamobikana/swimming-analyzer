'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { Athlete, Competitor, Race, RaceDistance, RaceResult, SlotAllocation } from '@/lib/domain/types';
import { NOMINAL_COURSE, ageGroupFor } from '@/lib/domain/race-meta';
import { parseDuration } from '@/lib/domain/time';
import { updateStore, readStore } from '@/lib/data/store';
import { MOCK_ATHLETE } from '@/lib/data/mock/athlete';
import { requireAuth } from '@/lib/auth/guard';
import { checkPassword, createSessionToken, SESSION_COOKIE, sessionMaxAge } from '@/lib/auth/session';
import { importFromUrl, parseText, type ImportOutcome } from '@/lib/integrations/results/fetch';
import { findAthleteRow, type ParsedRow } from '@/lib/integrations/results/parse';
import { syncActivities, stravaConfigured } from '@/lib/integrations/strava/client';
import { parseActivityFile } from '@/lib/integrations/files/parse';

// ───────────────────────── Auth ─────────────────────────

export async function login(_: unknown, formData: FormData): Promise<{ error?: string }> {
  const ok = await checkPassword(String(formData.get('password') ?? ''));
  if (!ok) return { error: 'Senha incorreta.' };
  (await cookies()).set(SESSION_COOKIE, await createSessionToken(), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: sessionMaxAge, path: '/' });
  const next = String(formData.get('next') ?? '/');
  redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/');
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/login');
}

// ───────────────────────── Perfil ─────────────────────────

const num = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? '').replace(',', '.').trim();
  return v === '' ? NaN : Number(v);
};
const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();

export async function saveProfile(_: unknown, fd: FormData): Promise<{ ok?: boolean; error?: string }> {
  await requireAuth();
  const store = await readStore();
  const base: Athlete = store.athlete ?? MOCK_ATHLETE;
  const pace = (k: string, fallback: number) => {
    const d = parseDuration(str(fd, k));
    return Number.isFinite(d) ? d : fallback;
  };
  const numOr = (k: string, fallback: number) => {
    const n = num(fd, k);
    return Number.isFinite(n) ? n : fallback;
  };
  const next: Athlete = {
    ...base,
    name: str(fd, 'name') || base.name,
    nickname: str(fd, 'nickname') || undefined,
    birthDate: str(fd, 'birthDate') || base.birthDate,
    sex: (str(fd, 'sex') as 'M' | 'F') || base.sex,
    weightKg: numOr('weightKg', base.weightKg),
    heightCm: numOr('heightCm', base.heightCm),
    ftpW: numOr('ftpW', base.ftpW),
    vo2max: numOr('vo2max', base.vo2max),
    hrMax: numOr('hrMax', base.hrMax),
    lthr: numOr('lthr', base.lthr),
    thresholdPaceSecPerKm: pace('thresholdPace', base.thresholdPaceSecPerKm),
    cssSecPer100m: pace('css', base.cssSecPer100m),
    avgWeeklyHours: numOr('avgWeeklyHours', base.avgWeeklyHours),
    mainGoal: str(fd, 'mainGoal') || base.mainGoal,
    targetRaceName: str(fd, 'targetRaceName') || base.targetRaceName,
    targetRaceDate: str(fd, 'targetRaceDate') || base.targetRaceDate,
    targetRaceDistance: (str(fd, 'targetRaceDistance') as RaceDistance) || base.targetRaceDistance,
    injuries: str(fd, 'injuries')
      ? str(fd, 'injuries').split('\n').filter(Boolean).map((l) => {
          const [date, ...rest] = l.split(' - ');
          return rest.length ? { date: date.trim(), description: rest.join(' - ').trim() } : { date: '', description: l.trim() };
        })
      : base.injuries,
  };
  // Registra snapshot fisiológico quando algo mudou (alimenta KPI atual × anterior).
  const changed = next.ftpW !== base.ftpW || next.vo2max !== base.vo2max || next.weightKg !== base.weightKg || next.thresholdPaceSecPerKm !== base.thresholdPaceSecPerKm || next.cssSecPer100m !== base.cssSecPer100m;
  if (changed) {
    next.history = [...base.history, { date: new Date().toISOString().slice(0, 10), ftpW: next.ftpW, vo2max: next.vo2max, weightKg: next.weightKg, thresholdPaceSecPerKm: next.thresholdPaceSecPerKm, cssSecPer100m: next.cssSecPer100m }];
  }
  await updateStore((s) => {
    s.athlete = next;
  });
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function setSampleData(show: boolean) {
  await requireAuth();
  await updateStore((s) => {
    s.settings.showSampleData = show;
  });
  revalidatePath('/', 'layout');
}

// ───────────────────────── Provas e resultados ─────────────────────────

export interface PreviewState {
  outcome?: Pick<ImportOutcome, 'ok' | 'message' | 'source' | 'columns'> & { count: number };
  categories?: { category: string; count: number }[];
  me?: ParsedRow;
  sample?: ParsedRow[];
}

async function loadResults(fd: FormData): Promise<ImportOutcome> {
  const text = str(fd, 'resultsText');
  if (text) return parseText(text);
  const url = str(fd, 'resultsUrl');
  if (url) return importFromUrl(url);
  return { ok: false, rows: [], columns: {}, source: 'none', message: 'Informe a URL oficial ou cole a tabela de resultados.' };
}

export async function previewResults(_: PreviewState, fd: FormData): Promise<PreviewState> {
  await requireAuth();
  const outcome = await loadResults(fd);
  const store = await readStore();
  const athlete = store.athlete ?? MOCK_ATHLETE;
  const idx = findAthleteRow(outcome.rows, { name: str(fd, 'myName') || athlete.name, bib: str(fd, 'bibNumber') });
  const cats = new Map<string, number>();
  for (const r of outcome.rows) cats.set(r.category ?? '—', (cats.get(r.category ?? '—') ?? 0) + 1);
  return {
    outcome: { ok: outcome.ok, message: outcome.message, source: outcome.source, columns: outcome.columns, count: outcome.rows.length },
    categories: [...cats.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
    me: idx >= 0 ? outcome.rows[idx] : undefined,
    sample: outcome.rows.slice(0, 5),
  };
}

const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function toResults(raceId: string, rows: ParsedRow[], meIdx: number, fallbackCategory: string): { results: RaceResult[]; competitors: Competitor[] } {
  const competitors: Competitor[] = [];
  const results = rows.map((r, i): RaceResult => {
    const isMe = i === meIdx;
    const competitorId = isMe ? 'me' : `n-${slug(r.name)}`;
    const category = r.category ?? fallbackCategory;
    if (!isMe) competitors.push({ id: competitorId, name: r.name, sex: r.sex ?? 'M', category, country: r.country });
    const splits = { swim: r.swim ?? 0, t1: r.t1 ?? 0, bike: r.bike ?? 0, t2: r.t2 ?? 0, run: r.run ?? 0 };
    // Prova só de corrida sem coluna "run": o total é a corrida.
    if (!r.run && !r.bike && !r.swim && r.total) splits.run = r.total;
    return {
      id: `${raceId}-${i}`,
      raceId,
      competitorId,
      athleteName: r.name,
      category,
      sex: r.sex ?? 'M',
      bib: r.bib,
      country: r.country,
      splits,
      totalS: r.total ?? NaN,
      overallRank: r.overallRank ?? r.rank,
      genderRank: r.genderRank,
      categoryRank: r.categoryRank,
      status: r.status,
      isMe,
    };
  });
  return { results, competitors };
}

export async function createRace(_: { error?: string }, fd: FormData): Promise<{ error?: string }> {
  await requireAuth();
  const store = await readStore();
  const athlete = store.athlete ?? MOCK_ATHLETE;
  const distance = (str(fd, 'distance') || '70.3') as RaceDistance;
  const date = str(fd, 'date');
  const name = str(fd, 'name');
  if (!name || !date) return { error: 'Nome e data são obrigatórios.' };
  const id = `u-${date}-${slug(name)}`.slice(0, 80);
  const nominal = NOMINAL_COURSE[distance];
  const km = (k: string, fallback: number) => (Number.isFinite(num(fd, k)) ? num(fd, k) * 1000 : fallback);

  const race: Race = {
    id,
    name,
    brand: (str(fd, 'brand') || 'Independente') as Race['brand'],
    date,
    location: str(fd, 'location'),
    distance,
    course: { swimM: Number.isFinite(num(fd, 'swimM')) ? num(fd, 'swimM') : nominal.swimM, bikeM: km('bikeKm', nominal.bikeM), runM: km('runKm', nominal.runM) },
    category: str(fd, 'category') || ageGroupFor(athlete.birthDate, date, athlete.sex),
    bibNumber: str(fd, 'bibNumber') || undefined,
    resultsUrl: str(fd, 'resultsUrl') || undefined,
    conditions: {
      weather: str(fd, 'weather') || undefined,
      airTempC: Number.isFinite(num(fd, 'airTempC')) ? num(fd, 'airTempC') : undefined,
      windKmh: Number.isFinite(num(fd, 'windKmh')) ? num(fd, 'windKmh') : undefined,
      waterTempC: Number.isFinite(num(fd, 'waterTempC')) ? num(fd, 'waterTempC') : undefined,
      wetsuitAllowed: fd.get('wetsuit') === 'yes' ? true : fd.get('wetsuit') === 'no' ? false : undefined,
    },
    notes: str(fd, 'notes') || undefined,
    provenance: 'manual',
    myBikePowerW: Number.isFinite(num(fd, 'myBikePowerW')) ? num(fd, 'myBikePowerW') : undefined,
  };

  let results: RaceResult[] = [];
  let competitors: Competitor[] = [];
  const hasImport = str(fd, 'resultsText') || str(fd, 'resultsUrl');
  if (hasImport) {
    const outcome = await loadResults(fd);
    if (outcome.ok) {
      const meIdx = findAthleteRow(outcome.rows, { name: str(fd, 'myName') || athlete.name, bib: race.bibNumber });
      if (meIdx >= 0 && outcome.rows[meIdx].category && !str(fd, 'category')) race.category = outcome.rows[meIdx].category!;
      ({ results, competitors } = toResults(id, outcome.rows, meIdx, race.category));
      race.provenance = str(fd, 'resultsUrl') && !str(fd, 'resultsText') ? 'imported' : 'manual';
    } else if (!fd.get('manualTotal')) {
      return { error: outcome.message };
    }
  }

  // Resultado manual (quando não há tabela ou meu nome não foi achado).
  if (!results.some((r) => r.isMe) && str(fd, 'manualTotal')) {
    const splits = {
      swim: parseDuration(str(fd, 'manualSwim')) || 0,
      t1: parseDuration(str(fd, 'manualT1')) || 0,
      bike: parseDuration(str(fd, 'manualBike')) || 0,
      t2: parseDuration(str(fd, 'manualT2')) || 0,
      run: parseDuration(str(fd, 'manualRun')) || 0,
    };
    const total = parseDuration(str(fd, 'manualTotal'));
    results.push({
      id: `${id}-me`,
      raceId: id,
      competitorId: 'me',
      athleteName: athlete.name,
      category: race.category,
      sex: athlete.sex,
      bib: race.bibNumber,
      splits,
      totalS: total,
      categoryRank: Number.isFinite(num(fd, 'manualCategoryRank')) ? num(fd, 'manualCategoryRank') : undefined,
      status: 'finisher',
      isMe: true,
    });
  }
  race.myResultId = results.find((r) => r.isMe)?.id;

  await updateStore((s) => {
    s.races = [...s.races.filter((r) => r.id !== id), race];
    s.results = [...s.results.filter((r) => r.raceId !== id), ...results];
    const byId = new Map(s.competitors.map((c) => [c.id, c]));
    for (const c of competitors) byId.set(c.id, { ...byId.get(c.id), ...c });
    s.competitors = [...byId.values()];
  });
  revalidatePath('/', 'layout');
  redirect(`/provas/${id}`);
}

export async function deleteRace(raceId: string) {
  await requireAuth();
  await updateStore((s) => {
    s.races = s.races.filter((r) => r.id !== raceId);
    s.results = s.results.filter((r) => r.raceId !== raceId);
  });
  revalidatePath('/', 'layout');
  redirect('/provas');
}

export async function saveSlots(_: { ok?: boolean; error?: string }, fd: FormData): Promise<{ ok?: boolean; error?: string }> {
  await requireAuth();
  const raceId = str(fd, 'raceId');
  const store = await readStore();
  if (!store.races.some((r) => r.id === raceId)) return { error: 'Só é possível editar vagas de provas cadastradas por você (as de exemplo são fixas).' };
  const slots: SlotAllocation = {
    championship: (str(fd, 'championship') as SlotAllocation['championship']) || 'IRONMAN 70.3 World Championship',
    totalSlots: Number.isFinite(num(fd, 'totalSlots')) ? num(fd, 'totalSlots') : undefined,
    categorySlots: Number.isFinite(num(fd, 'categorySlots')) ? num(fd, 'categorySlots') : undefined,
    lastQualifierRank: Number.isFinite(num(fd, 'lastQualifierRank')) ? num(fd, 'lastQualifierRank') : undefined,
    allocationRule: str(fd, 'allocationRule') || undefined,
    provenance: str(fd, 'provenance') === 'official' ? 'official' : 'estimate',
    sourceNote: str(fd, 'sourceNote') || undefined,
  };
  await updateStore((s) => {
    s.races = s.races.map((r) => (r.id === raceId ? { ...r, slots } : r));
  });
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function toggleTracked(competitorId: string) {
  await requireAuth();
  const store = await readStore();
  const { getDataset } = await import('@/lib/data/repository');
  const ds = await getDataset();
  const current = store.trackedCompetitorIds ?? ds.trackedCompetitorIds;
  const next = current.includes(competitorId) ? current.filter((x) => x !== competitorId) : [...current, competitorId];
  await updateStore((s) => {
    s.trackedCompetitorIds = next;
  });
  revalidatePath('/', 'layout');
}

// ───────────────────────── Integrações ─────────────────────────

export async function stravaSync(): Promise<{ message: string }> {
  await requireAuth();
  if (!stravaConfigured()) return { message: 'Configure STRAVA_CLIENT_ID e STRAVA_CLIENT_SECRET.' };
  try {
    const r = await syncActivities();
    revalidatePath('/', 'layout');
    return { message: `${r.imported} atividades sincronizadas (${r.detailed} com detalhes).` };
  } catch (e) {
    return { message: (e as Error).message };
  }
}

export async function stravaDisconnect() {
  await requireAuth();
  await updateStore((s) => {
    delete s.strava;
  });
  revalidatePath('/', 'layout');
}

export async function uploadActivity(_: { message?: string }, fd: FormData): Promise<{ message?: string }> {
  await requireAuth();
  const file = fd.get('file');
  if (!(file instanceof File) || file.size === 0) return { message: 'Selecione um arquivo .gpx, .tcx ou .fit.' };
  if (file.size > 25 * 1024 * 1024) return { message: 'Arquivo maior que 25 MB.' };
  try {
    const activity = parseActivityFile(file.name, file.name.toLowerCase().endsWith('.fit') ? await file.arrayBuffer() : await file.text());
    await updateStore((s) => {
      s.activities = [...s.activities.filter((a) => a.id !== activity.id), activity].sort((a, b) => a.date.localeCompare(b.date));
    });
    revalidatePath('/', 'layout');
    return { message: `Importado: ${activity.name} (${(activity.distanceM / 1000).toFixed(1)} km).` };
  } catch (e) {
    return { message: (e as Error).message };
  }
}

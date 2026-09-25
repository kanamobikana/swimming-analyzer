/**
 * Cliente Strava (OAuth 2 + API v3). Requer STRAVA_CLIENT_ID e
 * STRAVA_CLIENT_SECRET; sem eles o app segue com dados de exemplo.
 */
import type { Activity } from '../../domain/types';
import { readStore, type StravaTokens, updateStore } from '../../data/store';
import { mapStravaActivity, type StravaActivity, type StravaZone } from './mapper';

const API = 'https://www.strava.com/api/v3';
const OAUTH = 'https://www.strava.com/oauth';

export const stravaConfigured = () => !!(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET);

export function authorizeUrl(redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID ?? '',
    redirect_uri: redirectUri,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'read,activity:read_all,profile:read_all',
    state,
  });
  return `${OAUTH}/authorize?${q}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { id: number; firstname?: string; lastname?: string };
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${OAUTH}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: process.env.STRAVA_CLIENT_ID, client_secret: process.env.STRAVA_CLIENT_SECRET, ...body }),
  });
  if (!res.ok) throw new Error(`Strava OAuth falhou (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function exchangeCode(code: string, scope?: string): Promise<StravaTokens> {
  const t = await tokenRequest({ code, grant_type: 'authorization_code' });
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiresAt: t.expires_at,
    athleteId: t.athlete?.id ?? 0,
    athleteName: [t.athlete?.firstname, t.athlete?.lastname].filter(Boolean).join(' ') || undefined,
    scope,
  };
}

/** Token válido, renovando se faltar menos de 5 min para expirar. */
async function accessToken(): Promise<string> {
  const store = await readStore();
  const s = store.strava;
  if (!s) throw new Error('Strava não conectado.');
  if (s.expiresAt - 300 > Date.now() / 1000) return s.accessToken;
  const t = await tokenRequest({ refresh_token: s.refreshToken, grant_type: 'refresh_token' });
  await updateStore((st) => {
    if (st.strava) Object.assign(st.strava, { accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: t.expires_at });
  });
  return t.access_token;
}

async function api<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${await accessToken()}` }, cache: 'no-store' });
  if (res.status === 429) throw new Error('Limite de requisições do Strava atingido (100/15 min). Tente novamente em alguns minutos.');
  if (!res.ok) throw new Error(`Strava API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

/**
 * Sincroniza atividades desde a última sync (ou últimos 400 dias).
 * Detalhes (best efforts, voltas, zonas) só para as N mais recentes, para
 * respeitar o rate limit; o restante fica com os dados de resumo.
 */
export async function syncActivities(opts: { detailLimit?: number } = {}): Promise<{ imported: number; detailed: number }> {
  const store = await readStore();
  const lastSync = store.strava?.lastSyncAt ? Math.floor(new Date(store.strava.lastSyncAt).getTime() / 1000) - 86400 : undefined;
  const after = lastSync ?? Math.floor(Date.now() / 1000) - 400 * 86400;

  const summaries: StravaActivity[] = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await api<StravaActivity[]>(`/athlete/activities?after=${after}&per_page=200&page=${page}`);
    summaries.push(...batch);
    if (batch.length < 200) break;
  }

  const detailLimit = opts.detailLimit ?? 25;
  const newest = [...summaries].sort((a, b) => b.start_date.localeCompare(a.start_date)).slice(0, detailLimit);
  const detailed = new Map<number, Activity>();
  for (const s of newest) {
    try {
      const [detail, zones] = await Promise.all([
        api<StravaActivity>(`/activities/${s.id}`),
        api<StravaZone[]>(`/activities/${s.id}/zones`).catch(() => undefined),
      ]);
      detailed.set(s.id, mapStravaActivity(detail, zones));
    } catch {
      // Sem detalhe: fica o resumo.
    }
  }

  const mapped = summaries.map((s) => detailed.get(s.id) ?? mapStravaActivity(s));
  await updateStore((st) => {
    const byId = new Map(st.activities.map((a) => [a.id, a]));
    for (const a of mapped) byId.set(a.id, a);
    st.activities = [...byId.values()].sort((a, b) => a.date.localeCompare(b.date));
    if (st.strava) {
      st.strava.lastSyncAt = new Date().toISOString();
      st.strava.lastSyncCount = mapped.length;
    }
  });
  return { imported: mapped.length, detailed: detailed.size };
}

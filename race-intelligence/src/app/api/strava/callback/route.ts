import { NextResponse, type NextRequest } from 'next/server';
import { exchangeCode, syncActivities } from '@/lib/integrations/strava/client';
import { updateStore } from '@/lib/data/store';
import { requireAuth } from '@/lib/auth/guard';

export async function GET(request: NextRequest) {
  await requireAuth();
  const url = request.nextUrl;
  const back = (status: string) => {
    const res = NextResponse.redirect(new URL(`/perfil?strava=${status}#integracoes`, request.url));
    res.cookies.delete('strava_oauth_state');
    return res;
  };
  if (url.searchParams.get('error')) return back('denied');
  const state = url.searchParams.get('state');
  if (!state || state !== request.cookies.get('strava_oauth_state')?.value) return back('bad_state');
  const code = url.searchParams.get('code');
  if (!code) return back('missing_code');
  try {
    const tokens = await exchangeCode(code, url.searchParams.get('scope') ?? undefined);
    await updateStore((s) => {
      s.strava = tokens;
    });
    // Primeira sync já no retorno (histórico de ~400 dias).
    await syncActivities().catch(() => undefined);
    return back('connected');
  } catch {
    return back('error');
  }
}

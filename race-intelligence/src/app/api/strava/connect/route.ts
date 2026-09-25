import { NextResponse, type NextRequest } from 'next/server';
import { authorizeUrl, stravaConfigured } from '@/lib/integrations/strava/client';
import { requireAuth } from '@/lib/auth/guard';

export async function GET(request: NextRequest) {
  await requireAuth();
  if (!stravaConfigured()) return NextResponse.redirect(new URL('/perfil?strava=not_configured#integracoes', request.url));
  const state = crypto.randomUUID();
  const redirectUri = new URL('/api/strava/callback', request.url).toString();
  const res = NextResponse.redirect(authorizeUrl(redirectUri, state));
  res.cookies.set('strava_oauth_state', state, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 600, path: '/' });
  return res;
}

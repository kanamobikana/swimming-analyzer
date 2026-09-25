import { NextResponse, type NextRequest } from 'next/server';
import { authEnabled, SESSION_COOKIE, verifySessionToken } from './lib/auth/session';

/** Checagem otimista: sem sessão válida → /login. As ações revalidam no servidor. */
export async function proxy(request: NextRequest) {
  if (!authEnabled()) return NextResponse.next();
  const ok = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (ok) return NextResponse.next();
  if (request.nextUrl.pathname.startsWith('/api/')) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  const url = new URL('/login', request.url);
  url.searchParams.set('next', request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!login|_next/static|_next/image|favicon.ico|icon.svg).*)'],
};

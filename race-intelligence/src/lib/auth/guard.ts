import { cookies } from 'next/headers';
import { authEnabled, SESSION_COOKIE, verifySessionToken } from './session';

/** Toda Server Function/Route Handler que muda dados chama isto. */
export async function requireAuth(): Promise<void> {
  if (!authEnabled()) return;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await verifySessionToken(token))) throw new Error('Não autenticado.');
}

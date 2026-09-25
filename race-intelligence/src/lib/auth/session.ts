/**
 * Autenticação single-user (uso pessoal): senha em APP_PASSWORD e cookie
 * assinado com HMAC-SHA256 (AUTH_SECRET). Web Crypto → roda no proxy e no Node.
 * Sem APP_PASSWORD definido, o app fica aberto (modo desenvolvimento).
 */
export const SESSION_COOKIE = 'rpi_session';
const MAX_AGE_S = 60 * 60 * 24 * 30;

export const authEnabled = () => !!process.env.APP_PASSWORD;

function secret(): string {
  return process.env.AUTH_SECRET ?? process.env.APP_PASSWORD ?? 'dev-secret';
}

const enc = new TextEncoder();

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Comparação em tempo constante. */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(now = Date.now()): Promise<string> {
  const exp = Math.floor(now / 1000) + MAX_AGE_S;
  return `${exp}.${await hmac(String(exp))}`;
}

export async function verifySessionToken(token: string | undefined, now = Date.now()): Promise<boolean> {
  if (!token) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || Number(exp) < now / 1000) return false;
  return safeEqual(sig, await hmac(exp));
}

export async function checkPassword(input: string): Promise<boolean> {
  const expected = process.env.APP_PASSWORD ?? '';
  // Compara os HMACs (mesmo tamanho) para não vazar o comprimento da senha.
  return !!expected && safeEqual(await hmac(`pw:${input}`), await hmac(`pw:${expected}`));
}

export const sessionMaxAge = MAX_AGE_S;

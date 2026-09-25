/**
 * Importação por URL: baixa a página/arquivo e escolhe o parser.
 * Provedores cujos resultados são renderizados via JavaScript (ex.: páginas
 * de resultado da IRONMAN) retornam orientação para exportar/colar a tabela;
 * adaptadores específicos entram em PROVIDERS quando houver API pública.
 */
import { type ParsedRow, parseDelimited, parseHtmlTables, parseJsonResults } from './parse';

export interface ImportOutcome {
  ok: boolean;
  rows: ParsedRow[];
  columns: Record<string, string>;
  source: 'csv' | 'html' | 'json' | 'none';
  message: string;
}

interface Provider {
  match: RegExp;
  name: string;
  hint: string;
}

const PROVIDERS: Provider[] = [
  { match: /ironman\.com|competitor\.com|labs-v2\.competitor/i, name: 'IRONMAN', hint: 'A página da IRONMAN carrega os resultados via JavaScript. Abra o resultado da categoria, selecione a tabela e cole no campo "colar resultados", ou exporte em CSV.' },
  { match: /athlinks\.com/i, name: 'Athlinks', hint: 'Athlinks carrega resultados dinamicamente. Use "copiar tabela" e cole no campo de texto.' },
  { match: /chronotrack\.com|mychronotrack/i, name: 'ChronoTrack', hint: 'Use a opção de exportação/printable results e cole o conteúdo.' },
];

export function providerFor(url: string) {
  return PROVIDERS.find((p) => p.match.test(url));
}

export function parseText(text: string): ImportOutcome {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const r = parseJsonResults(JSON.parse(trimmed));
      if (r.rows.length) return { ok: true, ...r, columns: r.columns as Record<string, string>, source: 'json', message: `${r.rows.length} linhas lidas (JSON).` };
    } catch {
      /* não é JSON */
    }
  }
  if (/<table/i.test(trimmed)) {
    const r = parseHtmlTables(trimmed);
    if (r.rows.length) return { ok: true, ...r, columns: r.columns as Record<string, string>, source: 'html', message: `${r.rows.length} linhas lidas (tabela HTML).` };
  }
  const r = parseDelimited(trimmed);
  if (r.rows.length) return { ok: true, ...r, columns: r.columns as Record<string, string>, source: 'csv', message: `${r.rows.length} linhas lidas (texto tabulado/CSV).` };
  return { ok: false, rows: [], columns: {}, source: 'none', message: 'Não encontrei uma tabela com colunas reconhecíveis (nome + tempos). Confira se o cabeçalho foi incluído.' };
}

export async function importFromUrl(url: string): Promise<ImportOutcome> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { ok: false, rows: [], columns: {}, source: 'none', message: 'URL inválida.' };
  }
  if (!/^https?:$/.test(u.protocol)) return { ok: false, rows: [], columns: {}, source: 'none', message: 'Use uma URL http(s).' };
  // Evita que o servidor seja usado para acessar a rede interna.
  if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?$|\[?f[cd])/i.test(u.hostname) || u.hostname.endsWith('.internal') || u.hostname.endsWith('.local')) {
    return { ok: false, rows: [], columns: {}, source: 'none', message: 'URL não permitida.' };
  }
  const provider = providerFor(url);
  let res: Response;
  try {
    res = await fetch(u, { headers: { 'User-Agent': 'RacePerformanceIntelligence/0.1 (+personal use)', Accept: 'text/html,application/json,text/csv,*/*' }, signal: AbortSignal.timeout(15000), cache: 'no-store', redirect: 'follow' });
  } catch (e) {
    return { ok: false, rows: [], columns: {}, source: 'none', message: `Não consegui acessar a URL (${(e as Error).message}).${provider ? ' ' + provider.hint : ''}` };
  }
  if (!res.ok) return { ok: false, rows: [], columns: {}, source: 'none', message: `A URL respondeu ${res.status}.${provider ? ' ' + provider.hint : ''}` };
  const text = await res.text();
  const out = parseText(text);
  if (!out.ok && provider) out.message = `${provider.name}: ${provider.hint}`;
  return out;
}

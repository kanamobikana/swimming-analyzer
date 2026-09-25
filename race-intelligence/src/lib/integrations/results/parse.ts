/**
 * Parsers de resultados de prova: CSV/TSV (inclui tabela copiada do navegador),
 * tabela HTML e JSON (array de objetos). Todos convergem para `ParsedRow`
 * via o mesmo mapeamento de colunas por sinônimos (pt/en).
 */
import { parseDuration } from '../../domain/time';

export interface ParsedRow {
  rank?: number;
  name: string;
  bib?: string;
  category?: string;
  sex?: 'M' | 'F';
  country?: string;
  swim?: number;
  t1?: number;
  bike?: number;
  t2?: number;
  run?: number;
  total?: number;
  status: 'finisher' | 'dnf' | 'dsq' | 'dns';
  overallRank?: number;
  genderRank?: number;
  categoryRank?: number;
}

export type Field = keyof Omit<ParsedRow, 'status'> | 'status';

const SYNONYMS: [Field, RegExp][] = [
  ['categoryRank', /^(div(ision)?\s*(rank|pos|place)|ag\s*(rank|pos)|cat(egoria)?\s*(rank|pos|place)|pos\.?\s*cat(egoria)?|class(\.|ificação)?\s*cat(egoria)?)$/i],
  ['genderRank', /^(gender\s*(rank|pos|place)|sex\s*(rank|pos)|pos\.?\s*sexo|class(\.|ificação)?\s*sexo)$/i],
  ['overallRank', /^(overall(\s*(rank|pos|place))?|pos\.?\s*geral|class(\.|ificação)?\s*geral|geral)$/i],
  ['rank', /^(#|pos(ição|icao|\.)?|rank|place|colocação|colocacao|clas(s|\.)?)$/i],
  ['bib', /^(bib|n[ºo°]?\.?|num(ber|ero|\.)?|peito|dorsal)$/i],
  ['name', /^((athlete|full|display|competitor)\s*name|name|athlete|atleta|nome(\s*completo)?|competitor|participante)$/i],
  ['category', /^(div(ision)?|cat(egoria|egory)?|age\s*group|ag|faixa(\s*et[áa]ria)?)$/i],
  ['sex', /^(sex|gender|sexo|g[êe]nero)$/i],
  ['country', /^(country|pa[ií]s|nat(ionality)?|nacionalidade)$/i],
  ['swim', /^(swim|nata[çc][ãa]o|nado)(\s*time)?$/i],
  ['t1', /^(t1|transition\s*1|transi[çc][ãa]o\s*1)$/i],
  ['bike', /^(bike|cycle|cycling|ciclismo|pedal)(\s*time)?$/i],
  ['t2', /^(t2|transition\s*2|transi[çc][ãa]o\s*2)$/i],
  ['run', /^(run|corrida|running)(\s*time)?$/i],
  ['total', /^(total|finish(\s*time)?|overall\s*time|time|tempo(\s*(total|final|l[ií]quido))?|chip(\s*time)?|l[ií]quido|final)$/i],
  ['status', /^(status|situa[çc][ãa]o)$/i],
];

export function mapHeader(header: string): Field | undefined {
  const h = header.trim().replace(/\s+/g, ' ');
  for (const [field, re] of SYNONYMS) if (re.test(h)) return field;
  return undefined;
}

function normSex(v: string): 'M' | 'F' | undefined {
  const s = v.trim().toUpperCase();
  if (/^(M|MALE|MASC(ULINO)?|H|HOMEM)$/.test(s)) return 'M';
  if (/^(F|FEMALE|FEM(ININO)?|MULHER)$/.test(s)) return 'F';
  return undefined;
}

function toRow(record: Record<Field, string | undefined>): ParsedRow | undefined {
  const name = record.name?.trim();
  if (!name) return undefined;
  const num = (v?: string) => {
    const n = parseInt(String(v ?? '').replace(/[^\d]/g, ''), 10);
    return Number.isFinite(n) ? n : undefined;
  };
  const dur = (v?: string) => {
    const d = parseDuration(v);
    return Number.isFinite(d) ? d : undefined;
  };
  const statusRaw = `${record.status ?? ''} ${record.total ?? ''} ${record.rank ?? ''}`.toUpperCase();
  const status: ParsedRow['status'] = /DNF/.test(statusRaw) ? 'dnf' : /DSQ|DQ/.test(statusRaw) ? 'dsq' : /DNS/.test(statusRaw) ? 'dns' : 'finisher';
  let category = record.category?.trim();
  let sex = record.sex ? normSex(record.sex) : undefined;
  // "M45-49" / "F 40-44" → sexo implícito na categoria.
  const catMatch = category?.match(/^([MF])\s*(\d{2})\s*[-–]\s*(\d{2})$/i);
  if (catMatch) {
    sex ??= catMatch[1].toUpperCase() as 'M' | 'F';
    category = `${catMatch[1].toUpperCase()}${catMatch[2]}-${catMatch[3]}`;
  }
  const splits = { swim: dur(record.swim), t1: dur(record.t1), bike: dur(record.bike), t2: dur(record.t2), run: dur(record.run) };
  let total = dur(record.total);
  if (total == null && Object.values(splits).every((x) => x != null)) total = Object.values(splits).reduce((a, x) => a! + x!, 0);
  return {
    name,
    bib: record.bib?.trim() || undefined,
    category,
    sex,
    country: record.country?.trim() || undefined,
    ...splits,
    total: status === 'finisher' ? total : undefined,
    status: status === 'finisher' && total == null ? 'dnf' : status,
    rank: num(record.rank),
    overallRank: num(record.overallRank),
    genderRank: num(record.genderRank),
    categoryRank: num(record.categoryRank),
  };
}

function rowsFromMatrix(matrix: string[][]): { rows: ParsedRow[]; columns: Partial<Record<Field, string>> } {
  // Header = primeira linha com ≥ 3 colunas reconhecidas, incluindo nome.
  let headerIdx = -1;
  let fields: (Field | undefined)[] = [];
  for (let i = 0; i < Math.min(matrix.length, 15); i++) {
    const f = matrix[i].map(mapHeader);
    if (f.includes('name') && f.filter(Boolean).length >= 3) {
      headerIdx = i;
      fields = f;
      break;
    }
  }
  if (headerIdx === -1) return { rows: [], columns: {} };
  const columns: Partial<Record<Field, string>> = {};
  fields.forEach((f, i) => {
    if (f && !columns[f]) columns[f] = matrix[headerIdx][i];
  });
  const rows: ParsedRow[] = [];
  for (const line of matrix.slice(headerIdx + 1)) {
    const rec = {} as Record<Field, string | undefined>;
    fields.forEach((f, i) => {
      if (f && rec[f] == null) rec[f] = line[i];
    });
    const row = toRow(rec);
    if (row) rows.push(row);
  }
  return { rows, columns };
}

/** CSV/TSV/;-separado com aspas. Detecta o separador pela 1ª linha não vazia. */
export function parseDelimited(text: string): ReturnType<typeof rowsFromMatrix> {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim());
  if (!lines.length) return { rows: [], columns: {} };
  const sample = lines.slice(0, 5).join('\n');
  const delim = ['\t', ';', ','].map((d) => ({ d, n: sample.split(d).length })).sort((a, b) => b.n - a.n)[0].d;
  const split = (line: string) => {
    const out: string[] = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (q && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = !q;
      } else if (c === delim && !q) {
        out.push(cur);
        cur = '';
      } else cur += c;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  return rowsFromMatrix(lines.map(split));
}

const decode = (s: string) =>
  s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Extrai a tabela HTML com mais linhas reconhecidas. */
export function parseHtmlTables(html: string): ReturnType<typeof rowsFromMatrix> {
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
  let best: ReturnType<typeof rowsFromMatrix> = { rows: [], columns: {} };
  for (const t of tables) {
    const trs = t.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
    const matrix = trs.map((tr) => (tr.match(/<t[hd][^>]*>[\s\S]*?<\/t[hd]>/gi) ?? []).map(decode));
    const parsed = rowsFromMatrix(matrix);
    if (parsed.rows.length > best.rows.length) best = parsed;
  }
  return best;
}

/** JSON: procura o maior array de objetos e mapeia as chaves como cabeçalhos. */
export function parseJsonResults(data: unknown): ReturnType<typeof rowsFromMatrix> {
  let bestArr: Record<string, unknown>[] = [];
  const visit = (v: unknown, depth: number) => {
    if (depth > 5 || v == null) return;
    if (Array.isArray(v)) {
      if (v.length > bestArr.length && v.every((x) => x && typeof x === 'object' && !Array.isArray(x))) bestArr = v as Record<string, unknown>[];
      v.slice(0, 3).forEach((x) => visit(x, depth + 1));
    } else if (typeof v === 'object') Object.values(v as object).forEach((x) => visit(x, depth + 1));
  };
  visit(data, 0);
  if (!bestArr.length) return { rows: [], columns: {} };
  const keys = [...new Set(bestArr.slice(0, 20).flatMap((o) => Object.keys(o)))];
  const humanize = (k: string) => k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
  const matrix = [keys.map(humanize), ...bestArr.map((o) => keys.map((k) => (o[k] == null ? '' : String(o[k]))))];
  return rowsFromMatrix(matrix);
}

const normName = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Encontra o atleta pelo nº de peito ou nome (tolerante a acento/ordem). */
export function findAthleteRow(rows: ParsedRow[], opts: { name?: string; bib?: string }): number {
  if (opts.bib) {
    const want = Number(opts.bib.replace(/\D/g, ''));
    const i = rows.findIndex((r) => r.bib && Number(r.bib.replace(/\D/g, '')) === want);
    if (i >= 0) return i;
  }
  if (opts.name) {
    const target = normName(opts.name).split(' ');
    const first = target[0];
    const last = target[target.length - 1];
    const i = rows.findIndex((r) => {
      const n = normName(r.name);
      return n.includes(first) && n.includes(last);
    });
    if (i >= 0) return i;
  }
  return -1;
}

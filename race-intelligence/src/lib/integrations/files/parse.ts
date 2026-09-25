/**
 * Importação de arquivos de atividade.
 * - GPX e TCX: parse completo aqui (XML simples, sem dependências).
 * - FIT: binário; a interface está pronta (`parseFit`) e deve ser ligada a um
 *   decoder (ex.: pacote `fit-file-parser`) na próxima fase.
 */
import type { Activity, ActivityType } from '../../domain/types';
import { decoupling, normalizedPower } from '../../analytics/streams';

interface Sample {
  t: number; // epoch ms
  lat?: number;
  lon?: number;
  hr?: number;
  watts?: number;
  cad?: number;
  ele?: number;
  dist?: number; // metros acumulados (TCX)
}

const num = (s: string | undefined) => (s == null ? undefined : Number(s));
const tag = (xml: string, name: string) => xml.match(new RegExp(`<(?:\\w+:)?${name}[^>]*>([^<]*)</(?:\\w+:)?${name}>`, 'i'))?.[1];

function haversine(a: Sample, b: Sample): number {
  if (a.lat == null || b.lat == null || a.lon == null || b.lon == null) return 0;
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function summarize(samples: Sample[], type: ActivityType, name: string, source: 'gpx' | 'tcx'): Activity {
  const s = samples.filter((x) => Number.isFinite(x.t)).sort((a, b) => a.t - b.t);
  if (s.length < 2) throw new Error('Arquivo sem pontos suficientes.');
  let dist = 0;
  let moving = 0;
  let gain = 0;
  for (let i = 1; i < s.length; i++) {
    const d = s[i].dist != null && s[i - 1].dist != null ? s[i].dist! - s[i - 1].dist! : haversine(s[i - 1], s[i]);
    const dt = (s[i].t - s[i - 1].t) / 1000;
    dist += Math.max(d, 0);
    if (dt > 0 && dt < 30 && d / dt > 0.3) moving += dt; // parado = < ~1 km/h
    const de = (s[i].ele ?? 0) - (s[i - 1].ele ?? 0);
    if (de > 0) gain += de;
  }
  const hr = s.map((x) => x.hr).filter((x): x is number => !!x);
  const w = s.map((x) => x.watts).filter((x): x is number => x != null);
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : undefined);
  // Séries de 1 Hz para NP/desacoplamento (reamostragem simples por repetição).
  const perSecond = (key: 'watts' | 'hr') => {
    const out: number[] = [];
    for (let i = 1; i < s.length; i++) {
      const dt = Math.min(Math.round((s[i].t - s[i - 1].t) / 1000), 30);
      for (let k = 0; k < dt; k++) out.push(s[i][key] ?? 0);
    }
    return out;
  };
  const watts1s = w.length ? perSecond('watts') : [];
  const hr1s = hr.length ? perSecond('hr') : [];
  return {
    id: `${source}-${s[0].t}`,
    source,
    date: new Date(s[0].t).toISOString(),
    type,
    name,
    movingTimeS: Math.round(moving),
    elapsedTimeS: Math.round((s[s.length - 1].t - s[0].t) / 1000),
    distanceM: Math.round(dist),
    elevationGainM: Math.round(gain),
    avgHr: avg(hr),
    maxHr: hr.length ? Math.max(...hr) : undefined,
    avgPowerW: avg(w),
    normalizedPowerW: watts1s.length > 60 ? normalizedPower(watts1s) : undefined,
    avgCadence: avg(s.map((x) => x.cad).filter((x): x is number => !!x)),
    decoupling: watts1s.length && hr1s.length ? decoupling(watts1s, hr1s) || undefined : undefined,
  };
}

function guessType(name: string, sport?: string): ActivityType {
  const s = `${sport ?? ''} ${name}`.toLowerCase();
  if (/swim|nata/.test(s)) return 'swim';
  if (/bik|cycl|ride|pedal|biking/.test(s)) return 'ride';
  if (/run|corr/.test(s)) return 'run';
  return 'other';
}

export function parseGpx(xml: string): Activity {
  const name = tag(xml, 'name') ?? 'Atividade GPX';
  const type = guessType(name, tag(xml, 'type'));
  const pts = xml.match(/<trkpt[\s\S]*?<\/trkpt>/gi) ?? [];
  const samples: Sample[] = pts.map((p) => ({
    lat: num(p.match(/lat="([^"]+)"/)?.[1]),
    lon: num(p.match(/lon="([^"]+)"/)?.[1]),
    t: Date.parse(tag(p, 'time') ?? ''),
    ele: num(tag(p, 'ele')),
    hr: num(tag(p, 'hr')),
    cad: num(tag(p, 'cad')),
    watts: num(tag(p, 'power')),
  }));
  return summarize(samples, type, name, 'gpx');
}

export function parseTcx(xml: string): Activity {
  const sport = xml.match(/<Activity[^>]*Sport="([^"]+)"/i)?.[1];
  const name = tag(xml, 'Notes') ?? `Atividade ${sport ?? 'TCX'}`;
  const pts = xml.match(/<Trackpoint[\s\S]*?<\/Trackpoint>/gi) ?? [];
  const samples: Sample[] = pts.map((p) => ({
    t: Date.parse(tag(p, 'Time') ?? ''),
    lat: num(tag(p, 'LatitudeDegrees')),
    lon: num(tag(p, 'LongitudeDegrees')),
    ele: num(tag(p, 'AltitudeMeters')),
    dist: num(tag(p, 'DistanceMeters')),
    hr: num(p.match(/<HeartRateBpm[^>]*>\s*<Value>(\d+)<\/Value>/i)?.[1]),
    cad: num(tag(p, 'Cadence')) ?? num(tag(p, 'RunCadence')),
    watts: num(tag(p, 'Watts')),
  }));
  return summarize(samples, guessType(name, sport), name, 'tcx');
}

export function parseFit(data: ArrayBuffer): Activity {
  void data;
  throw new Error('Importação FIT ainda não habilitada — use GPX/TCX ou a sincronização do Strava por enquanto.');
}

export function parseActivityFile(filename: string, content: string | ArrayBuffer): Activity {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'fit') return parseFit(content as ArrayBuffer);
  const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
  if (ext === 'gpx') return parseGpx(text);
  if (ext === 'tcx') return parseTcx(text);
  throw new Error(`Formato .${ext} não suportado.`);
}

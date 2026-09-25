/**
 * Analista determinístico — responde às perguntas-chave SEM LLM, usando só os
 * números do dashboard. É o fallback quando não há ANTHROPIC_API_KEY e a
 * garantia de que as respostas principais nunca dependem de rede.
 */
import type { Dataset } from '../data/repository';
import type { Race } from '../domain/types';
import { formatDuration, formatGap, formatPace100, formatPaceKm, formatSpeed, parseDuration } from '../domain/time';
import { DISTANCE_LABEL } from '../domain/race-meta';
import {
  analyzeRace,
  disciplineHistory,
  latestKeyRace,
  qualificationStatus,
  raceReport,
  strongestDiscipline,
  triathlonResults,
} from '../analytics/insights';
import { BUCKET_LABEL, GAP_BUCKETS, type GapBucket, slope } from '../analytics/race';
import { placeInField, simulateSplits } from '../analytics/simulator';
import { powerAtHeartRate, paceAtHeartRate } from '../analytics/training';

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function racesMentioned(ds: Dataset, q: string): Race[] {
  const nq = norm(q);
  const year = nq.match(/\b(20\d{2})\b/)?.[1];
  const found: Race[] = [];
  const past = ds.races.filter((r) => r.date <= ds.today);
  // Tokens distintivos: cidade/local do nome (ignora marca e distância).
  const stop = new Set(['ironman', '70.3', 'triathlon', 'sprint', 'olimpico', 'meia', 'maratona', 'do', 'da', 'de']);
  const seen = new Set<string>();
  for (const r of [...past].reverse()) {
    const tokens = norm(r.name).split(/\s+/).filter((t) => t.length > 2 && !stop.has(t));
    const phrase = tokens.join(' ');
    if (!tokens.length || !nq.includes(tokens[0])) continue;
    if (year && !r.date.startsWith(year)) continue;
    const key = `${phrase}|${r.distance}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push(r);
  }
  // Ordem em que aparecem na pergunta.
  return found.sort((a, b) => nq.indexOf(norm(a.name).split(/\s+/).find((t) => nq.includes(t)) ?? '') - nq.indexOf(norm(b.name).split(/\s+/).find((t) => nq.includes(t)) ?? ''));
}

const line = (label: string, v: string) => `- **${label}:** ${v}`;

function raceSummary(ds: Dataset, race: Race) {
  const a = analyzeRace(ds, race.id, 'P5', { deep: true })!;
  if (!a.me) return `Não tenho meu resultado em ${race.name}.`;
  const r = raceReport(a)!;
  return [
    `### ${race.name} (${race.date})`,
    `${formatDuration(a.me.totalS)} · ${r.headline}`,
    '',
    '**Onde perdi tempo (vs P5):**',
    ...(r.lostTime.length ? r.lostTime.map((x) => `- ${x}`) : ['- Nada relevante — no nível do P5.']),
    '',
    '**Onde ganhei:**',
    ...(r.gainedTime.length ? r.gainedTime.slice(0, 4).map((x) => `- ${x}`) : ['- —']),
    r.biggestOpportunity ? `\n**Maior oportunidade:** ${r.biggestOpportunity}` : '',
    r.trainingImplications.length ? `\n**Preparação:** ${r.trainingImplications.join(' ')}` : '',
  ].join('\n');
}

function compareRaces(ds: Dataset, races: Race[]) {
  const rows = races.map((race) => ({ race, a: analyzeRace(ds, race.id)! })).filter((x) => x.a.me);
  if (rows.length < 2) return undefined;
  const head = `| | ${rows.map((x) => x.race.name.replace('IRONMAN ', '') + ` (${x.race.date.slice(0, 4)})`).join(' | ')} |`;
  const sep = `|---|${rows.map(() => '---').join('|')}|`;
  const r = (label: string, f: (x: (typeof rows)[number]) => string) => `| ${label} | ${rows.map(f).join(' | ')} |`;
  const table = [
    head,
    sep,
    r('Tempo', (x) => formatDuration(x.a.me!.totalS)),
    r('Categoria', (x) => `P${x.a.rank}/${x.a.n}`),
    r('Percentil', (x) => `Top ${Math.round(x.a.percentile! * 100)}%`),
    r('Swim', (x) => `${formatDuration(x.a.me!.splits.swim)} (${formatPace100(x.a.pace!.swim100)})`),
    r('Bike', (x) => `${formatDuration(x.a.me!.splits.bike)} (${formatSpeed(x.a.pace!.bikeKmh)})`),
    r('Run', (x) => `${formatDuration(x.a.me!.splits.run)} (${formatPaceKm(x.a.pace!.runKm)})`),
    r('Gap P5', (x) => (x.a.gapsByKey.P5 ? formatGap(x.a.gapsByKey.P5.totalS) : '—')),
    r('Força do field (est.)', (x) => (x.a.strength ? String(x.a.strength.index) : '—')),
    r('Percentil ajustado (est.)', (x) => (x.a.adjustedPercentile != null ? `Top ${Math.round(x.a.adjustedPercentile * 100)}%` : '—')),
    r('Clima', (x) => [x.race.conditions.airTempC != null ? `${x.race.conditions.airTempC}°C` : '', x.race.conditions.windKmh != null ? `vento ${x.race.conditions.windKmh} km/h` : ''].filter(Boolean).join(', ') || '—'),
  ].join('\n');
  const sameDistance = rows.every((x) => x.race.distance === rows[0].race.distance);
  const note = sameDistance
    ? 'Tempos absolutos entre edições diferentes sofrem com percurso e clima — olhe principalmente percentil, gap para o P5 e força do field.'
    : 'Distâncias diferentes: compare só as métricas relativas (percentil, gap relativo).';
  return `${table}\n\n${note}`;
}

function disciplineTrend(ds: Dataset, bucket: GapBucket) {
  const hist = disciplineHistory(ds);
  const pts = hist.map((h) => ({ x: new Date(h.date).getTime() / (365 * 86_400_000), y: h.percentile[bucket] }));
  const s = slope(pts);
  const lines = hist.map((h) => `- ${h.date}: split no Top ${Math.round(h.percentile[bucket] * 100)}% da categoria`);
  const a = ds.athlete;
  let physio = '';
  if (bucket === 'bike') {
    const first = a.history[0];
    const rides = powerAtHeartRate(ds.activities, a.lthr * 0.78, a.lthr * 0.9);
    physio = `FTP ${first?.ftpW ?? '—'} → ${a.ftpW} W (${(a.ftpW / a.weightKg).toFixed(2).replace('.', ',')} W/kg).`;
    if (rides.length > 6) {
      const early = rides.slice(0, 5);
      const late = rides.slice(-5);
      const ef = (xs: typeof rides) => xs.reduce((acc, x) => acc + x.watts / x.hr, 0) / xs.length;
      physio += ` Eficiência (W/bpm) em pedais aeróbicos: ${ef(early).toFixed(2)} → ${ef(late).toFixed(2)}.`;
    }
  }
  if (bucket === 'run') {
    const runs = paceAtHeartRate(ds.activities, a.lthr * 0.8, a.lthr * 0.89);
    physio = `Limiar ${formatPaceKm(a.history[0]?.thresholdPaceSecPerKm ?? NaN)} → ${formatPaceKm(a.thresholdPaceSecPerKm)}.`;
    if (runs.length > 6) {
      const avg = (xs: typeof runs) => xs.reduce((acc, x) => acc + x.paceSecPerKm, 0) / xs.length;
      physio += ` Pace em Z2 (mesma FC): ${formatPaceKm(avg(runs.slice(0, 5)))} → ${formatPaceKm(avg(runs.slice(-5)))}.`;
    }
  }
  if (bucket === 'swim') physio = `CSS ${formatPace100(a.history[0]?.cssSecPer100m ?? NaN)} → ${formatPace100(a.cssSecPer100m)}.`;
  const verdict = s < -0.02 ? 'Sim — evoluindo em relação ao field.' : s > 0.02 ? 'Não — perdendo posição relativa nas provas.' : 'Estável em relação ao field.';
  return [`**${BUCKET_LABEL[bucket]}: ${verdict}**`, physio, '', 'Percentil do split por prova:', ...lines].join('\n');
}

function parsePaceFromQuestion(q: string) {
  const out: { runPace?: number; swimPace?: number; bikeKmh?: number; bikeW?: number } = {};
  const run = q.match(/(\d:\d{2})\s*\/?\s*km/i) ?? (/(corr|run)/i.test(q) ? q.match(/(\d:\d{2})/) : null);
  if (run) out.runPace = parseDuration(run[1]);
  const swim = q.match(/(\d:\d{2})\s*\/?\s*100/i);
  if (swim) out.swimPace = parseDuration(swim[1]);
  const kmh = q.match(/(\d{2}(?:[.,]\d)?)\s*km\/h/i);
  if (kmh) out.bikeKmh = Number(kmh[1].replace(',', '.'));
  const w = q.match(/(\d{3})\s*w(atts)?\b/i);
  if (w) out.bikeW = Number(w[1]);
  return out;
}

export function localAnalyst(ds: Dataset, question: string): string {
  const q = norm(question);
  const key = latestKeyRace(ds);
  const mentioned = racesMentioned(ds, question);

  // "Se eu correr 4:25/km, onde teria terminado?"
  if (/\bse eu\b|what if|teria terminado|onde eu teria/.test(q)) {
    const race = mentioned[0] ?? key?.race;
    if (!race) return 'Ainda não há provas com resultado para simular.';
    const a = analyzeRace(ds, race.id)!;
    if (!a.me || !a.pace) return `Não tenho meu resultado em ${race.name}.`;
    const p = parsePaceFromQuestion(question);
    if (!Object.keys(p).length) return 'Me diga o pace/velocidade — ex.: "se eu correr 4:25/km" ou "se eu pedalar 38 km/h em Brasília".';
    const splits = simulateSplits(
      {
        swimPaceSecPer100: p.swimPace ?? a.pace.swim100,
        bikeSpeedKmh: p.bikeKmh ?? a.pace.bikeKmh,
        bikeWatts: p.bikeW,
        t1S: a.me.splits.t1,
        t2S: a.me.splits.t2,
        runPaceSecPerKm: p.runPace ?? a.pace.runKm,
      },
      race.course,
    );
    const place = placeInField(splits, a.field);
    return [
      `**${race.name}** com ${[p.swimPace && `natação ${formatPace100(p.swimPace)}`, p.bikeKmh && `bike ${formatSpeed(p.bikeKmh)}`, p.bikeW && `bike ${p.bikeW} W (modelo de potência, estimativa)`, p.runPace && `corrida ${formatPaceKm(p.runPace)}`].filter(Boolean).join(', ')} e o resto igual:`,
      '',
      line('Tempo estimado', `${formatDuration(place.totalS)} (${formatGap(place.totalS - a.me.totalS)} vs real)`),
      line('Posição na categoria', `P${place.rank}/${place.fieldSize} (real: P${a.rank}) — Top ${Math.round(place.percentile * 100)}%`),
      place.ahead ? line('Logo à frente', `${place.ahead.athleteName} — ${formatDuration(place.ahead.totalS)}`) : '',
      '',
      'Simulação contra o field real daquela edição (o resto do field não muda).',
    ].join('\n');
  }

  // "Compare Brasília com São Paulo" / "últimas três provas"
  if (/ultimas (tres|3)|last three|ultimas provas/.test(q)) {
    const last3 = triathlonResults(ds).slice(-3).map((x) => x.race);
    return compareRaces(ds, last3) ?? 'Preciso de ao menos duas provas com resultado.';
  }
  if (/compar/.test(q) && mentioned.length >= 2) return compareRaces(ds, mentioned) ?? 'Não encontrei meu resultado nessas provas.';

  // "Quanto preciso melhorar para Top 5?"
  const topN = q.match(/top\s*(\d+)|\bp(\d+)\b/);
  if (topN && /(preciso|falta|melhorar|chegar)/.test(q)) {
    const n = Number(topN[1] ?? topN[2]);
    const race = mentioned[0] ?? key?.race;
    if (!race) return 'Ainda não há provas com resultado.';
    const a = analyzeRace(ds, race.id)!;
    const target = a.field.filter((r) => !r.isMe)[n - 1];
    if (!a.me || !target) return `O field de ${race.name} não tem ${n} atletas.`;
    const gap = GAP_BUCKETS.map((b) => {
      const mine = b === 'transitions' ? a.me!.splits.t1 + a.me!.splits.t2 : a.me!.splits[b];
      const theirs = b === 'transitions' ? target.splits.t1 + target.splits.t2 : target.splits[b];
      return { b, g: mine - theirs };
    });
    const total = a.me.totalS - target.totalS + 1;
    return [
      `Para ser **P${n}** em ${race.name} você precisaria de **${formatDuration(target.totalS - 1)}** — ${formatDuration(total)} mais rápido que seus ${formatDuration(a.me.totalS)}.`,
      '',
      `Comparando com o P${n} real (${target.athleteName}):`,
      ...gap.map((x) => line(BUCKET_LABEL[x.b], formatGap(x.g))),
      '',
      `Tradução em pace (se viesse só da corrida): ${formatPaceKm((a.me.splits.run - total) / (race.course.runM / 1000))} vs ${formatPaceKm(a.pace!.runKm)} atual.`,
    ].join('\n');
  }

  // "Qual modalidade está limitando minha evolução?"
  if (/(limit|gargalo|ponto fraco|fraqueza)/.test(q)) {
    const s = strongestDiscipline(ds);
    const d = key ? analyzeRace(ds, key.race.id, 'P5', { deep: true }) : undefined;
    if (!s) return 'Preciso de ao menos uma prova de triathlon.';
    const weakest = (['swim', 'bike', 'run'] as GapBucket[]).sort((x, y) => s.all[y] - s.all[x])[0];
    const opp = d?.opportunities?.items[0];
    return [
      `**Pelo field:** sua modalidade relativa mais fraca é **${BUCKET_LABEL[weakest]}** (split médio no Top ${Math.round(s.all[weakest] * 100)}% nas últimas provas, vs ${BUCKET_LABEL[s.bucket]} no Top ${Math.round(s.avgPercentile * 100)}%).`,
      opp ? `**Pelos minutos:** onde há mais tempo realista para buscar é **${BUCKET_LABEL[opp.bucket]}** (${formatDuration(opp.potentialS)}).` : '',
      '',
      weakest === opp?.bucket
        ? 'As duas leituras apontam para o mesmo lugar — é o foco do próximo bloco.'
        : `Leituras diferentes: ${BUCKET_LABEL[weakest]} é o ponto fraco relativo, mas ${opp ? BUCKET_LABEL[opp.bucket] : '—'} devolve mais minutos no prazo até a prova-alvo. Priorize minutos; mantenha ${BUCKET_LABEL[weakest]} com volume técnico.`,
    ].join('\n');
  }

  // "Minha bike está evoluindo?"
  if (/(evolu|melhorando|progred)/.test(q)) {
    const b: GapBucket = /bike|pedal|cicl/.test(q) ? 'bike' : /corr|run|pace/.test(q) ? 'run' : /nata|swim|nado/.test(q) ? 'swim' : 'bike';
    return disciplineTrend(ds, b);
  }

  // "Onde estão meus 10 minutos mais fáceis?"
  if (/(mais faceis|facil|oportunidade|onde (estao|ganho)|minutos)/.test(q)) {
    const race = mentioned[0] ?? key?.race;
    if (!race) return 'Ainda não há provas com resultado.';
    const a = analyzeRace(ds, race.id, 'P5', { deep: true })!;
    const o = a.opportunities;
    if (!o) return 'Oportunidades só são calculadas para triathlon.';
    return [
      `**Minutos mais baratos até a prova-alvo** (base: ${race.name}, comparando com quem terminou 2–10% à frente — ${o.peerCount} atletas):`,
      '',
      ...o.items.map((x) => line(BUCKET_LABEL[x.bucket], `${formatDuration(x.potentialS)} realistas · gap total para o próximo nível ${formatDuration(x.peerGapS)} · confiança ${x.confidence}. ${x.rationale}`)),
      '',
      `**Total potencial: ${formatDuration(o.totalS)}.**`,
    ].join('\n');
  }

  // "Qual foi minha melhor prova considerando a força do field?"
  if (/melhor prova|best race|forca do field|field/.test(q)) {
    const rows = triathlonResults(ds).filter((x) => x.a.adjustedPercentile != null).sort((x, y) => x.a.adjustedPercentile! - y.a.adjustedPercentile!);
    if (!rows.length) return 'Sem dados suficientes de field.';
    return [
      '**Ranking das suas provas pelo percentil ajustado à força do field** (estimativa):',
      '',
      ...rows.map((x, i) => `${i + 1}. ${x.race.name} (${x.race.date.slice(0, 4)}, ${DISTANCE_LABEL[x.race.distance]}) — P${x.a.rank}/${x.a.n}, Top ${Math.round(x.a.percentile! * 100)}% · RSI ${x.a.strength?.index} → ajustado Top ${Math.round(x.a.adjustedPercentile! * 100)}%`),
    ].join('\n');
  }

  // "Por que perdi tempo nesta prova?"
  if (/(perdi|por que|porque|analis|relatorio|como fui)/.test(q)) {
    const race = mentioned[0] ?? key?.race;
    return race ? raceSummary(ds, race) : 'Ainda não há provas com resultado.';
  }

  // Default: onde estou.
  const qs = qualificationStatus(ds);
  const last = key;
  return [
    '**Onde você está hoje:**',
    last ? line('Última prova-chave', `${last.race.name} — P${last.a.rank}/${last.a.n} (Top ${Math.round(last.a.percentile! * 100)}%)`) : '',
    qs.gap ? line('Qualification Gap', `${formatDuration(qs.gap.totalS)} (${qs.provenance === 'official' ? 'benchmark oficial' : 'estimativa'})`) : '',
    ...(qs.gap ? GAP_BUCKETS.map((b) => `  - ${BUCKET_LABEL[b]}: ${formatGap(qs.gap!.byBucket[b])}`) : []),
    '',
    'Posso responder: "por que perdi tempo em São Paulo?", "compare Brasília com São Paulo", "quanto preciso melhorar para Top 5?", "minha bike está evoluindo?", "onde estão meus 10 minutos mais fáceis?", "se eu correr 4:25/km, onde teria terminado?", "qual foi minha melhor prova considerando a força do field?".',
  ].filter((x) => x !== '').join('\n');
}


import { describe, expect, it } from 'vitest';
import { findAthleteRow, parseDelimited, parseHtmlTables, parseJsonResults } from '../integrations/results/parse';
import { parseText } from '../integrations/results/fetch';
import { mapStravaActivity, mapSportType } from '../integrations/strava/mapper';
import { parseGpx, parseTcx } from '../integrations/files/parse';
import { createSessionToken, verifySessionToken } from '../auth/session';
import { markdownToHtml } from '../ai/markdown';

const TSV = `Pos\tNome\tCategoria\tSwim\tT1\tBike\tT2\tRun\tTotal
1\tRodrigo A.\tM45-49\t30:12\t2:10\t2:20:01\t1:40\t1:30:10\t4:24:13
2\tCristiano Kanashiro\tM45-49\t36:50\t3:20\t2:28:30\t2:05\t1:37:20\t4:48:05
3\tFulano B.\tM45-49\t40:00\t4:00\t2:50:00\t3:00\tDNF\tDNF`;

describe('parser de resultados', () => {
  it('lê tabela copiada do navegador (TSV)', () => {
    const r = parseDelimited(TSV);
    expect(r.rows).toHaveLength(3);
    expect(r.rows[1].total).toBe(17285);
    expect(r.rows[1].category).toBe('M45-49');
    expect(r.rows[1].sex).toBe('M');
    expect(r.rows[2].status).toBe('dnf');
    expect(findAthleteRow(r.rows, { name: 'Cristiano Kanashiro' })).toBe(1);
  });
  it('CSV com ; e cabeçalhos em inglês', () => {
    const r = parseDelimited('Place;Athlete;Division;Swim Time;T1;Bike Time;T2;Run Time;Finish Time\n1;"Doe, John";M45-49;30:00;2:00;2:20:00;1:30;1:30:00;4:23:30');
    expect(r.rows[0].name).toBe('Doe, John');
    expect(r.rows[0].total).toBe(15810);
  });
  it('HTML: escolhe a tabela de resultados', () => {
    const html = `<table><tr><td>menu</td></tr></table><table><thead><tr><th>#</th><th>Atleta</th><th>Categoria</th><th>Natação</th><th>Ciclismo</th><th>Corrida</th><th>Tempo</th></tr></thead>
      <tbody><tr><td>1</td><td><a>José&nbsp;Silva</a></td><td>M 45-49</td><td>30:00</td><td>2:20:00</td><td>1:30:00</td><td>4:25:00</td></tr></tbody></table>`;
    const r = parseHtmlTables(html);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].name).toBe('José Silva');
    expect(r.rows[0].category).toBe('M45-49');
  });
  it('JSON de API: acha o array de resultados', () => {
    const r = parseJsonResults({ data: { results: [{ rank: 1, athleteName: 'A', ageGroup: 'M45-49', swimTime: '30:00', bikeTime: '2:20:00', runTime: '1:30:00', finishTime: '4:24:00' }] } });
    expect(r.rows[0].name).toBe('A');
    expect(r.rows[0].total).toBe(15840);
  });
  it('mensagem clara quando não há tabela', () => {
    expect(parseText('texto qualquer').ok).toBe(false);
  });
  it('encontra por nº de peito', () => {
    expect(findAthleteRow([{ name: 'X', bib: '0842', status: 'finisher' }], { bib: '842' })).toBe(0);
  });
});

describe('Strava mapper', () => {
  it('mapeia tipos e métricas', () => {
    expect(mapSportType({ sport_type: 'VirtualRide', name: '' })).toBe('virtual_ride');
    expect(mapSportType({ sport_type: 'Swim', name: 'Travessia águas abertas' })).toBe('open_water_swim');
    expect(mapSportType({ sport_type: 'WeightTraining', name: '' })).toBe('strength');
    const a = mapStravaActivity(
      { id: 1, name: 'Longão', sport_type: 'Run', start_date: '2026-09-20T09:00:00Z', start_date_local: '2026-09-20T06:00:00Z', moving_time: 7000, distance: 22000, average_heartrate: 140, average_cadence: 86, suffer_score: 120, best_efforts: [{ name: '5k', elapsed_time: 1300, moving_time: 1290, distance: 5000 }] },
      [{ type: 'heartrate', distribution_buckets: [{ min: 0, max: 120, time: 100 }, { min: 120, max: 140, time: 5000 }, { min: 140, max: 150, time: 1500 }, { min: 150, max: 160, time: 300 }, { min: 160, max: -1, time: 100 }] }],
    );
    expect(a.type).toBe('run');
    expect(a.avgCadence).toBe(172);
    expect(a.bestEfforts?.run?.['5k']).toBe(1290);
    expect(a.hrZones?.seconds[1]).toBe(5000);
    expect(a.relativeEffort).toBe(120);
  });
});

describe('arquivos', () => {
  it('GPX: distância, tempo e FC', () => {
    const pts = Array.from({ length: 61 }, (_, i) => `<trkpt lat="${-23.5 + i * 0.0001}" lon="-46.6"><ele>700</ele><time>2026-09-20T09:${String(i).padStart(2, '0') === '60' ? '59' : String(i).padStart(2, '0')}:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>140</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>`).slice(0, 60).join('');
    const a = parseGpx(`<gpx><trk><name>Corrida</name><type>running</type><trkseg>${pts}</trkseg></trk></gpx>`);
    expect(a.type).toBe('run');
    expect(a.distanceM).toBeGreaterThan(600);
    expect(a.avgHr).toBe(140);
  });
  it('TCX: usa DistanceMeters e Watts', () => {
    const tp = (s: number, d: number) => `<Trackpoint><Time>2026-09-20T09:00:${String(s).padStart(2, '0')}Z</Time><DistanceMeters>${d}</DistanceMeters><HeartRateBpm><Value>130</Value></HeartRateBpm><Extensions><TPX><Watts>200</Watts></TPX></Extensions></Trackpoint>`;
    const a = parseTcx(`<TrainingCenterDatabase><Activities><Activity Sport="Biking">${[0, 10, 20, 30].map((s, i) => tp(s, i * 100)).join('')}</Activity></Activities></TrainingCenterDatabase>`);
    expect(a.type).toBe('ride');
    expect(a.distanceM).toBe(300);
    expect(a.avgPowerW).toBe(200);
  });
});

describe('sessão', () => {
  it('assina e valida; rejeita adulterado e expirado', async () => {
    const t = await createSessionToken();
    expect(await verifySessionToken(t)).toBe(true);
    expect(await verifySessionToken(t.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a')))).toBe(false);
    expect(await verifySessionToken(t, Date.now() + 40 * 86400_000)).toBe(false);
  });
});

describe('markdown do analista', () => {
  it('escapa HTML e renderiza tabela/lista', () => {
    const html = markdownToHtml('**x** <script>\n- a\n\n| a | b |\n|---|---|\n| 1 | 2 |');
    expect(html).not.toContain('<script>');
    expect(html).toContain('<strong>x</strong>');
    expect(html).toContain('<table>');
  });
});

import { describe, expect, it } from 'vitest';
import { mergeDataset } from '../data/repository';
import { analyzeRace, kpis, qualificationStatus, raceReport } from '../analytics/insights';
import { localAnalyst } from '../ai/local-analyst';
import { buildAnalystContext } from '../ai/context';

const ds = mergeDataset({ version: 1, races: [], results: [], competitors: [], activities: [], settings: { showSampleData: true } }, '2026-09-25');

describe('dataset de exemplo (aceite)', () => {
  it('reproduz o cenário do briefing: P28/210, Top 13%', () => {
    const a = analyzeRace(ds, 'r-2026-703-sp', 'P5', { deep: true })!;
    expect(a.rank).toBe(28);
    expect(a.n).toBe(210);
    expect(Math.round(a.percentile! * 100)).toBe(13);
    expect(a.gap!.totalS).toBeGreaterThan(0);
    expect(raceReport(a)!.headline).toContain('P28/210');
  });
  it('qualification gap usa lista oficial e decompõe por modalidade', () => {
    const q = qualificationStatus(ds);
    expect(q.provenance).toBe('official');
    expect(q.benchmark?.rank).toBe(6);
    const g = q.gap!;
    expect(g.byBucket.swim + g.byBucket.bike + g.byBucket.run + g.byBucket.transitions).toBe(g.totalS);
  });
  it('KPIs e contexto do analista são gerados', () => {
    expect(kpis(ds).length).toBeGreaterThan(8);
    const ctx = buildAnalystContext(ds);
    expect(ctx.races.length).toBe(8);
    expect(JSON.stringify(ctx)).not.toContain('NaN');
  });
  it('analista local responde às perguntas-chave', () => {
    expect(localAnalyst(ds, 'Compare Brasília com São Paulo')).toContain('|');
    expect(localAnalyst(ds, 'Se eu correr 4:25/km, onde teria terminado?')).toMatch(/P\d+\/210/);
    expect(localAnalyst(ds, 'Quanto preciso melhorar para Top 5?')).toContain('P5');
    expect(localAnalyst(ds, 'Minha bike está evoluindo?')).toContain('Bike');
    expect(localAnalyst(ds, 'Onde estão meus 10 minutos mais fáceis?')).toContain('Total potencial');
    expect(localAnalyst(ds, 'Qual modalidade está limitando minha evolução?')).toContain('Pelo field');
    expect(localAnalyst(ds, 'Qual foi minha melhor prova considerando a força do field?')).toContain('ajustado');
    expect(localAnalyst(ds, 'Compare minhas últimas três provas')).toContain('|');
    expect(localAnalyst(ds, 'Por que perdi tempo nesta prova?')).toContain('Onde perdi tempo');
  });
});

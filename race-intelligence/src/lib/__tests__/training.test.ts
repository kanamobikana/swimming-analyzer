import { describe, expect, it } from 'vitest';
import type { Activity } from '../domain/types';
import { activityMetrics, consistencyScore, intensityDistribution, performanceManagement, preRaceWindow } from '../analytics/training';
import { decoupling, normalizedPower } from '../analytics/streams';

const athlete = { ftpW: 250, lthr: 160, thresholdPaceSecPerKm: 260, cssSecPer100m: 110, weightKg: 72, avgWeeklyHours: 10 };
const act = (p: Partial<Activity>): Activity => ({ id: Math.random().toString(), source: 'mock', date: '2026-01-01T07:00:00', type: 'ride', name: 'x', movingTimeS: 3600, distanceM: 30000, ...p });

describe('TSS', () => {
  it('1h no FTP = 100 TSS (potência)', () => {
    const m = activityMetrics(act({ normalizedPowerW: 250, avgPowerW: 240 }), athlete);
    expect(m.tss).toBe(100);
    expect(m.tssMethod).toBe('power');
    expect(m.variabilityIndex).toBeCloseTo(250 / 240);
  });
  it('corrida no limiar por 1h = 100 rTSS; FC como fallback', () => {
    expect(activityMetrics(act({ type: 'run', distanceM: 3600 / 260 * 1000 }), athlete).tss).toBe(100);
    expect(activityMetrics(act({ type: 'other', distanceM: 0, avgHr: 160 }), athlete).tssMethod).toBe('hr');
  });
});

describe('PMC', () => {
  it('CTL converge para o TSS diário constante e TSB fica negativo em carga crescente', () => {
    const acts = Array.from({ length: 200 }, (_, i) => act({ date: new Date(Date.UTC(2025, 0, 1 + i)).toISOString(), normalizedPowerW: 250 }));
    const pmc = performanceManagement(acts, athlete, '2025-01-01', '2025-07-19');
    const last = pmc[pmc.length - 1];
    expect(last.ctl).toBeGreaterThan(95);
    expect(pmc[10].tsb).toBeLessThan(0);
  });
});

describe('intensidade e consistência', () => {
  it('classifica distribuição polarizada', () => {
    const d = intensityDistribution([act({ hrZones: { seconds: [4000, 3000, 300, 900, 300] } })]);
    expect(d.model).toBe('polarizado');
    expect(d.easy).toBeCloseTo(7000 / 8500);
  });
  it('score de consistência fica entre 0 e 100 e pune buracos', () => {
    const daily = Array.from({ length: 28 }, (_, i) => act({ date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(), movingTimeS: 5400, keySession: i % 7 === 5 ? 'long_ride' : undefined }));
    const full = consistencyScore(daily, athlete, '2026-01-01', '2026-01-28');
    const holes = consistencyScore(daily.filter((_, i) => i < 10 || i > 20), athlete, '2026-01-01', '2026-01-28');
    expect(full.score).toBeGreaterThan(holes.score);
    expect(full.score).toBeLessThanOrEqual(100);
  });
  it('janela pré-prova mede aderência ao plano', () => {
    const acts = [act({ date: '2026-02-20T07:00:00', planned: true, completed: true, keySession: 'long_run' }), act({ date: '2026-02-21T07:00:00', planned: true, completed: false })];
    const w = preRaceWindow(acts, athlete, '2026-03-01', 30, []);
    expect(w.plannedCompliance).toBe(0.5);
    expect(w.missedSessions).toBe(1);
    expect(w.longRuns).toBe(1);
  });
});

describe('streams', () => {
  it('NP de potência constante = potência; desacoplamento ~0 sem drift', () => {
    const w = Array(1200).fill(200);
    expect(normalizedPower(w)).toBe(200);
    expect(decoupling(w, Array(1200).fill(140))).toBeCloseTo(0);
    expect(decoupling(w, [...Array(600).fill(140), ...Array(600).fill(150)])).toBeGreaterThan(0.05);
  });
});

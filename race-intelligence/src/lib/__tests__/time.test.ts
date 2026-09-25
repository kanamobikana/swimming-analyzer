import { describe, expect, it } from 'vitest';
import { formatDuration, formatGap, parseDuration, paceSecPer100m, speedKmh, timeFromPaceKm } from '../domain/time';
import { ageGroupFor, categoryTimeline } from '../domain/race-meta';

describe('tempo', () => {
  it('formata e faz parse de durações', () => {
    expect(formatDuration(4 * 3600 + 48 * 60 + 5)).toBe('4:48:05');
    expect(formatDuration(452)).toBe('7:32');
    expect(parseDuration('4:48:05')).toBe(17285);
    expect(parseDuration('36:50')).toBe(2210);
    expect(parseDuration('4h33m52s')).toBe(16432);
    expect(parseDuration('DNF')).toBeNaN();
    expect(parseDuration('1:52,5')).toBeCloseTo(112.5);
  });
  it('gap com sinal', () => {
    expect(formatGap(222)).toBe('+3:42');
    expect(formatGap(-38)).toBe('-0:38');
    expect(formatGap(0)).toBe('0:00');
  });
  it('paces e velocidades', () => {
    expect(paceSecPer100m(2210, 1900)).toBeCloseTo(116.3, 1);
    expect(speedKmh(8910, 90000)).toBeCloseTo(36.36, 2);
    expect(timeFromPaceKm(265, 21097)).toBeCloseTo(5590.7, 0);
  });
});

describe('categoria por idade (regra 31/12)', () => {
  it('M45-49 em 2026 e M50-54 a partir de 2028 para nascido em 1978', () => {
    expect(ageGroupFor('1978-09-20', '2026-11-29', 'M')).toBe('M45-49');
    expect(ageGroupFor('1978-09-20', '2028-01-15', 'M')).toBe('M50-54');
    const t = categoryTimeline('1978-09-20', 'M', 2026, 3);
    expect(t.find((x) => x.changed)?.year).toBe(2028);
  });
});

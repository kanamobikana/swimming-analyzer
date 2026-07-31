import { describe, expect, it } from 'vitest';
import { parseNumber, parseInteger, formatDecimal } from './format';

describe('parseNumber (BR + US aware)', () => {
  it('parses Brazilian comma decimals', () => {
    expect(parseNumber('11,25')).toBe(11.25);
    expect(parseNumber('10,5')).toBe(10.5);
    expect(parseNumber('0,4')).toBe(0.4);
  });

  it('parses dot decimals without mangling them into thousands', () => {
    expect(parseNumber('10.5')).toBe(10.5);
    expect(parseNumber('11.25')).toBe(11.25);
    expect(parseNumber('0.4')).toBe(0.4);
  });

  it('handles thousands separators', () => {
    expect(parseNumber('1.000.000')).toBe(1_000_000);
    expect(parseNumber('1,000,000')).toBe(1_000_000);
    expect(parseNumber('1.234,56')).toBe(1234.56);
    expect(parseNumber('1,234.56')).toBe(1234.56);
  });

  it('handles plain integers and empties', () => {
    expect(parseNumber('1125')).toBe(1125);
    expect(parseNumber('')).toBe(0);
    expect(parseNumber(null)).toBe(0);
    expect(parseNumber('abc')).toBe(0);
    expect(parseNumber(42)).toBe(42);
  });
});

describe('parseInteger (lives count)', () => {
  it('strips any separators', () => {
    expect(parseInteger('1.000.000')).toBe(1_000_000);
    expect(parseInteger('1500000')).toBe(1_500_000);
    expect(parseInteger('')).toBe(0);
  });
});

describe('formatDecimal', () => {
  it('renders with a comma and no grouping', () => {
    expect(formatDecimal(11.25)).toBe('11,25');
    expect(formatDecimal(10.5)).toBe('10,5');
    expect(formatDecimal(40)).toBe('40');
  });
});

import { describe, expect, it } from 'vitest';
import {
  averageConsultPrice,
  buildPriceMatrix,
  excedentePrice,
  noShowFactor,
  pricePerLife,
  pricingDivisor,
  realCostPerConsult,
  realizedMargin,
  reversePricePerLife,
  sellCostPerConsult,
  effectiveConsultCost,
} from './calc';
import {
  REFERENCE_CONFIG,
  REFERENCE_PACKAGES,
  REFERENCE_SPECIALTIES,
} from './reference';
import type { Specialty } from './types';

const specialties = new Map<string, Specialty>(
  REFERENCE_SPECIALTIES.map((s) => [s.id, s]),
);
const [psicologia] = REFERENCE_SPECIALTIES;
const [tp2tp3, tp4plus] = REFERENCE_PACKAGES;

describe('specialty cost', () => {
  it('sells Psicologia at the full 2-credit duration (R$50)', () => {
    expect(sellCostPerConsult(psicologia)).toBeCloseTo(50, 6);
  });

  it('blends the real Psicologia cost to R$31.00 (76%×25 + 24%×50)', () => {
    expect(realCostPerConsult(psicologia)).toBeCloseTo(31, 6);
  });

  it('treats non-double specialties identically on both bases', () => {
    const nutricao = specialties.get('nutricao')!;
    expect(sellCostPerConsult(nutricao)).toBeCloseTo(30, 6);
    expect(realCostPerConsult(nutricao)).toBeCloseTo(30, 6);
  });
});

describe('average consult price of the package mix (90/5/5)', () => {
  it('sale basis is R$47.50 (100% Psicologia at 60min)', () => {
    expect(averageConsultPrice(tp2tp3, specialties, 'sell')).toBeCloseTo(47.5, 6);
  });

  it('real basis is R$30.40 (observed duration mix)', () => {
    expect(averageConsultPrice(tp2tp3, specialties, 'real')).toBeCloseTo(30.4, 6);
  });
});

describe('blended factors', () => {
  it('no-show factor is 0.9265', () => {
    expect(noShowFactor(REFERENCE_CONFIG)).toBeCloseTo(0.9265, 6);
  });

  it('pricing divisor is 0.4875 (1 − 0.40 − 0.1125)', () => {
    expect(
      pricingDivisor(REFERENCE_CONFIG.targetMargin, REFERENCE_CONFIG.taxRate),
    ).toBeCloseTo(0.4875, 6);
  });

  it('rejects an impossible margin+tax combination', () => {
    expect(() => pricingDivisor(0.95, 0.1125)).toThrow();
  });
});

describe('price per life at the "até 10%" band, no volume discount', () => {
  const ns = noShowFactor(REFERENCE_CONFIG);
  const divisor = pricingDivisor(
    REFERENCE_CONFIG.targetMargin,
    REFERENCE_CONFIG.taxRate,
  );
  const avgSell = averageConsultPrice(tp2tp3, specialties, 'sell');
  const eff = effectiveConsultCost(avgSell, ns);

  it('TP2/TP3 (recorrência 2.0) is R$18.05', () => {
    const price = pricePerLife({
      utilization: 0.1,
      recurrence: tp2tp3.recurrence,
      effectiveConsultCost: eff,
      divisor,
    });
    expect(price).toBeCloseTo(18.05, 2);
  });

  it('TP4+ (recorrência 3.5) is R$31.60', () => {
    const price = pricePerLife({
      utilization: 0.1,
      recurrence: tp4plus.recurrence,
      effectiveConsultCost: eff,
      divisor,
    });
    expect(price).toBeCloseTo(31.6, 2);
  });
});

describe('excedente consultation (sale basis)', () => {
  it('is R$97.44 (47.50 ÷ 0.4875, no no-show factor)', () => {
    const divisor = pricingDivisor(
      REFERENCE_CONFIG.targetMargin,
      REFERENCE_CONFIG.taxRate,
    );
    const avgSell = averageConsultPrice(tp2tp3, specialties, 'sell');
    expect(excedentePrice(avgSell, divisor)).toBeCloseTo(97.44, 2);
  });
});

describe('price matrix', () => {
  const matrix = buildPriceMatrix(tp2tp3, specialties, REFERENCE_CONFIG);

  it('has one row per utilization band and one column per volume band', () => {
    expect(matrix.cells).toHaveLength(REFERENCE_CONFIG.utilizationBands.length);
    for (const row of matrix.cells) {
      expect(row).toHaveLength(REFERENCE_CONFIG.volumeBands.length);
    }
  });

  it('reproduces R$18.05 at util 10% / no discount (top-left of that row)', () => {
    const topBandRow = matrix.cells[matrix.utilizationBands.indexOf(0.1)];
    expect(topBandRow[0].price).toBeCloseTo(18.05, 2);
  });

  it('applies volume discount to the price (3% column is 3% cheaper)', () => {
    const topBandRow = matrix.cells[matrix.utilizationBands.indexOf(0.1)];
    expect(topBandRow[1].price).toBeCloseTo(topBandRow[0].price * 0.97, 6);
  });

  it('realizes exactly the 40% target margin in the no-discount column', () => {
    const topBandRow = matrix.cells[matrix.utilizationBands.indexOf(0.1)];
    expect(topBandRow[0].saleMargin).toBeCloseTo(0.4, 6);
  });

  it('realizes a HIGHER real margin than sale margin (operational efficiency)', () => {
    const cell = matrix.cells[matrix.utilizationBands.indexOf(0.1)][0];
    expect(cell.realMargin).toBeGreaterThan(cell.saleMargin);
  });
});

describe('realized margin — reference scenario (~58.1%)', () => {
  // util 12.6%, 90% lives in TP2/TP3, 10% in TP4+, base 1,000,000 lives.
  const result = realizedMargin({
    packages: [
      { pkg: tp2tp3, livesShare: 0.9 },
      { pkg: tp4plus, livesShare: 0.1 },
    ],
    specialties,
    cfg: REFERENCE_CONFIG,
    utilization: 0.126,
    maxBandCap: 0.1,
    population: 1_000_000,
  });

  it('real (operational) margin is ~58.1%, well above the nominal 40%', () => {
    expect(result.realMargin).toBeCloseTo(0.581, 2);
  });

  it('sale (nominal) margin stays near 40%', () => {
    // Slightly above 40% because excedente usage carries no no-show discount.
    expect(result.saleMargin).toBeGreaterThan(0.4);
    expect(result.saleMargin).toBeLessThan(0.42);
  });

  it('does not depend on the absolute population size', () => {
    const scaled = realizedMargin({
      packages: [
        { pkg: tp2tp3, livesShare: 0.9 },
        { pkg: tp4plus, livesShare: 0.1 },
      ],
      specialties,
      cfg: REFERENCE_CONFIG,
      utilization: 0.126,
      maxBandCap: 0.1,
      population: 7,
    });
    expect(scaled.realMargin).toBeCloseTo(result.realMargin, 9);
  });

  it('collapses real margin to the nominal-ish flat value when util stays within the band', () => {
    const within = realizedMargin({
      packages: [{ pkg: tp2tp3, livesShare: 1 }],
      specialties,
      cfg: REFERENCE_CONFIG,
      utilization: 0.05,
      maxBandCap: 0.1,
    });
    // No excedente: real margin = 1 − (real/sell)·divisor − tax.
    const divisor = pricingDivisor(
      REFERENCE_CONFIG.targetMargin,
      REFERENCE_CONFIG.taxRate,
    );
    const ratio = (30.4 / 47.5) * divisor;
    expect(within.realMargin).toBeCloseTo(1 - ratio - REFERENCE_CONFIG.taxRate, 6);
    // And the nominal margin is exactly the 40% target when fully in-band.
    expect(within.saleMargin).toBeCloseTo(0.4, 6);
  });
});

describe('reverse calculator (margin -> price)', () => {
  const ns = noShowFactor(REFERENCE_CONFIG);
  const avgSell = averageConsultPrice(tp2tp3, specialties, 'sell');
  const avgReal = averageConsultPrice(tp2tp3, specialties, 'real');

  it('reproduces the forward price on the sale basis at the 40% target', () => {
    const price = reversePricePerLife({
      desiredMargin: 0.4,
      taxRate: REFERENCE_CONFIG.taxRate,
      utilization: 0.1,
      recurrence: tp2tp3.recurrence,
      avgConsultCost: avgSell,
      noShowFactor: ns,
    });
    expect(price).toBeCloseTo(18.05, 2);
  });

  it('needs a lower price on the real basis for the same margin', () => {
    const salePrice = reversePricePerLife({
      desiredMargin: 0.4,
      taxRate: REFERENCE_CONFIG.taxRate,
      utilization: 0.1,
      recurrence: tp2tp3.recurrence,
      avgConsultCost: avgSell,
      noShowFactor: ns,
    });
    const realPrice = reversePricePerLife({
      desiredMargin: 0.4,
      taxRate: REFERENCE_CONFIG.taxRate,
      utilization: 0.1,
      recurrence: tp2tp3.recurrence,
      avgConsultCost: avgReal,
      noShowFactor: ns,
    });
    expect(realPrice).toBeLessThan(salePrice);
  });

  it('a higher desired margin demands a higher price', () => {
    const base = reversePricePerLife({
      desiredMargin: 0.4,
      taxRate: REFERENCE_CONFIG.taxRate,
      utilization: 0.1,
      recurrence: tp2tp3.recurrence,
      avgConsultCost: avgSell,
      noShowFactor: ns,
    });
    const higher = reversePricePerLife({
      desiredMargin: 0.5,
      taxRate: REFERENCE_CONFIG.taxRate,
      utilization: 0.1,
      recurrence: tp2tp3.recurrence,
      avgConsultCost: avgSell,
      noShowFactor: ns,
    });
    expect(higher).toBeGreaterThan(base);
  });
});

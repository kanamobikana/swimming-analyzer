/**
 * Pure pricing calculations for the Starbem platform.
 *
 * This module is the heart of the tool: it decides how much Starbem charges per
 * eligible life. Every function here is pure (no I/O, no React, no DB) so it can
 * be unit-tested against the reference numbers and reused everywhere (matrix,
 * reverse calculator, margin analysis).
 *
 * The reference scenario in `calc.test.ts` pins the expected outputs; do not
 * change a formula here without checking the numbers still match.
 */

import type {
  CostBasis,
  GlobalConfig,
  PricingPackage,
  Specialty,
  VolumeBand,
} from './types';

export type SpecialtyLookup = Map<string, Specialty> | Record<string, Specialty>;

function resolveSpecialty(lookup: SpecialtyLookup, id: string): Specialty {
  const s = lookup instanceof Map ? lookup.get(id) : lookup[id];
  if (!s) throw new Error(`Especialidade não encontrada: ${id}`);
  return s;
}

/**
 * Cost of one consultation of a specialty on the SELL basis: the full duration
 * sold to the client. A double-session specialty is assumed 100% at 2 credits.
 */
export function sellCostPerConsult(s: Specialty): number {
  return (s.allowsDouble ? 2 : 1) * s.costPerCredit;
}

/**
 * Cost of one consultation on the REAL basis: the blended cost using the
 * observed duration mix. For Psicologia (76% 1-credit / 24% 2-credit @ R$25):
 *   0.76 * 25 + 0.24 * 50 = R$31.00
 */
export function realCostPerConsult(s: Specialty): number {
  if (!s.allowsDouble) return s.costPerCredit;
  return (
    s.realShortShare * s.costPerCredit + s.realLongShare * 2 * s.costPerCredit
  );
}

/** Cost of one consultation of a specialty on the requested basis. */
export function specialtyCost(s: Specialty, basis: CostBasis): number {
  return basis === 'sell' ? sellCostPerConsult(s) : realCostPerConsult(s);
}

/**
 * Weighted average consultation price of a package, using the package's
 * specialty mix. `basis` picks sell vs real cost.
 *
 *   preço_médio_consulta = Σ (mix da especialidade × custo da especialidade)
 */
export function averageConsultPrice(
  pkg: PricingPackage,
  specialties: SpecialtyLookup,
  basis: CostBasis,
): number {
  return pkg.specialties.reduce((acc, ps) => {
    const s = resolveSpecialty(specialties, ps.specialtyId);
    return acc + ps.mixShare * specialtyCost(s, basis);
  }, 0);
}

/**
 * Blended no-show cost factor. No-shows still cost the repasse fraction:
 *   fator = (1 − %no_show) × 1 + %no_show × %repasse
 */
export function noShowFactor(cfg: Pick<GlobalConfig, 'noShowRate' | 'noShowRepassePct'>): number {
  return (1 - cfg.noShowRate) * 1 + cfg.noShowRate * cfg.noShowRepassePct;
}

/** Effective per-consultation cost after applying the no-show factor. */
export function effectiveConsultCost(avgConsultPrice: number, factor: number): number {
  return avgConsultPrice * factor;
}

/**
 * Pricing divisor that bakes target NET margin and revenue tax into the price:
 *   divisor = 1 − margem_alvo − alíquota_imposto
 * Throws if the margin + tax leave no room (divisor <= 0).
 */
export function pricingDivisor(targetMargin: number, taxRate: number): number {
  const d = 1 - targetMargin - taxRate;
  if (d <= 0) {
    throw new Error(
      `Divisor inválido: margem (${targetMargin}) + imposto (${taxRate}) >= 1. ` +
        `Não é possível precificar com essa combinação.`,
    );
  }
  return d;
}

/**
 * Price per eligible life per month, before any volume discount:
 *   preço_por_vida = (utilização × recorrência × custo_médio_efetivo) ÷ divisor
 */
export function pricePerLife(params: {
  utilization: number;
  recurrence: number;
  effectiveConsultCost: number;
  divisor: number;
}): number {
  const { utilization, recurrence, effectiveConsultCost, divisor } = params;
  return (utilization * recurrence * effectiveConsultCost) / divisor;
}

/** Apply a volume discount to a price (discount hits the price, not the cost). */
export function applyVolumeDiscount(price: number, discountPct: number): number {
  return price * (1 - discountPct);
}

/**
 * Price of an extra (excedente) consultation. Unlike the population pricing,
 * an excedente is an event that already happened, so it carries NO no-show
 * factor:
 *   preço_consulta_excedente = preço_médio_consulta ÷ divisor
 */
export function excedentePrice(avgConsultPrice: number, divisor: number): number {
  return avgConsultPrice / divisor;
}

// ---------------------------------------------------------------------------
// Matrix
// ---------------------------------------------------------------------------

export interface MatrixCell {
  utilization: number;
  volumeBandIndex: number;
  /** Price per life before the volume discount is applied. */
  priceBeforeDiscount: number;
  discountPct: number;
  /** Final price per life after the volume discount. */
  price: number;
  /** Nominal (sale-basis) net margin realized in this cell. */
  saleMargin: number;
  /** Operational (real-basis) net margin realized in this cell. */
  realMargin: number;
}

export interface PriceMatrix {
  packageId: string;
  packageName: string;
  utilizationBands: number[];
  volumeBands: VolumeBand[];
  /** cells[utilizationIndex][volumeIndex] */
  cells: MatrixCell[][];
  avgSellConsult: number;
  avgRealConsult: number;
  noShowFactor: number;
  divisor: number;
  /** Price of one excedente consultation (sale basis). */
  excedentePrice: number;
}

/**
 * Build the full price matrix for a package: rows = utilization bands,
 * columns = volume bands. The charged price is always sell-based (that is what
 * the client actually pays); each cell also reports the nominal and real
 * margins it realizes so the "Margem Real vs Venda" panel can read from it.
 */
export function buildPriceMatrix(
  pkg: PricingPackage,
  specialties: SpecialtyLookup,
  cfg: GlobalConfig,
): PriceMatrix {
  const avgSell = averageConsultPrice(pkg, specialties, 'sell');
  const avgReal = averageConsultPrice(pkg, specialties, 'real');
  const ns = noShowFactor(cfg);
  const divisor = pricingDivisor(cfg.targetMargin, cfg.taxRate);
  const effSell = effectiveConsultCost(avgSell, ns);

  const cells: MatrixCell[][] = cfg.utilizationBands.map((utilization) =>
    cfg.volumeBands.map((band, volumeBandIndex) => {
      const priceBeforeDiscount = pricePerLife({
        utilization,
        recurrence: pkg.recurrence,
        effectiveConsultCost: effSell,
        divisor,
      });
      const price = applyVolumeDiscount(priceBeforeDiscount, band.discountPct);
      // Real per-life operational cost (uses real duration mix).
      const realCostPerLife = utilization * pkg.recurrence * avgReal * ns;
      const saleCostPerLife = utilization * pkg.recurrence * avgSell * ns;
      return {
        utilization,
        volumeBandIndex,
        priceBeforeDiscount,
        discountPct: band.discountPct,
        price,
        saleMargin: marginFromPrice(price, saleCostPerLife, cfg.taxRate),
        realMargin: marginFromPrice(price, realCostPerLife, cfg.taxRate),
      };
    }),
  );

  return {
    packageId: pkg.id,
    packageName: pkg.name,
    utilizationBands: cfg.utilizationBands,
    volumeBands: cfg.volumeBands,
    cells,
    avgSellConsult: avgSell,
    avgRealConsult: avgReal,
    noShowFactor: ns,
    divisor,
    excedentePrice: excedentePrice(avgSell, divisor),
  };
}

/**
 * Net margin realized given a charged price and a per-life cost:
 *   margem = (receita − custo − imposto) / receita
 * where imposto = taxRate × receita.
 */
export function marginFromPrice(price: number, cost: number, taxRate: number): number {
  if (price <= 0) return 0;
  return (price - cost - taxRate * price) / price;
}

// ---------------------------------------------------------------------------
// Realized margin over a full population scenario
// ---------------------------------------------------------------------------

export interface ScenarioPackageMix {
  pkg: PricingPackage;
  /** Share of the eligible population in this package (0..1). */
  livesShare: number;
}

export interface RealizedMarginInput {
  packages: ScenarioPackageMix[];
  specialties: SpecialtyLookup;
  cfg: GlobalConfig;
  /** Actual observed utilization for the scenario (can exceed the top band). */
  utilization: number;
  /**
   * Utilization ceiling of the offered matrix. Usage above this cap is billed
   * as excedente consultations (no no-show factor on the price). Defaults to
   * the largest configured utilization band.
   */
  maxBandCap?: number;
  /** Eligible population; cancels out of the margin but kept for reporting. */
  population?: number;
}

export interface RealizedMarginResult {
  /** Sale-basis (nominal) net margin realized. */
  saleMargin: number;
  /** Real-basis (operational) net margin realized. */
  realMargin: number;
  totalRevenue: number;
  totalRealCost: number;
  totalSaleCost: number;
  totalTax: number;
}

/**
 * Compute the margin actually realized over a population scenario, comparing
 * the sale basis (duration sold to the client) against the real basis (observed
 * duration mix). The gap between the two is the operational efficiency that is
 * NOT passed on to the client's price.
 *
 * Usage above `maxBandCap` is billed as excedente consultations (priced with no
 * no-show factor), which is what reconciles the reference scenario's ~58.1%.
 */
export function realizedMargin(input: RealizedMarginInput): RealizedMarginResult {
  const { packages, specialties, cfg, utilization } = input;
  const population = input.population ?? 1;
  const maxBandCap =
    input.maxBandCap ??
    (cfg.utilizationBands.length
      ? Math.max(...cfg.utilizationBands)
      : utilization);

  const ns = noShowFactor(cfg);
  const divisor = pricingDivisor(cfg.targetMargin, cfg.taxRate);

  let totalRevenue = 0;
  let totalRealCost = 0;
  let totalSaleCost = 0;

  for (const { pkg, livesShare } of packages) {
    const lives = livesShare * population;
    const avgSell = averageConsultPrice(pkg, specialties, 'sell');
    const avgReal = averageConsultPrice(pkg, specialties, 'real');

    const cappedUtil = Math.min(utilization, maxBandCap);
    const excessUtil = Math.max(0, utilization - maxBandCap);

    // Revenue from the population within the offered matrix band.
    const revenuePop = pricePerLife({
      utilization: cappedUtil,
      recurrence: pkg.recurrence,
      effectiveConsultCost: effectiveConsultCost(avgSell, ns),
      divisor,
    });
    // Revenue from excedente consultations above the cap.
    const excPrice = excedentePrice(avgSell, divisor);
    const revenueExc = excessUtil * pkg.recurrence * excPrice;
    const revenuePerLife = revenuePop + revenueExc;

    // Operational cost for ALL realized consultations (full utilization).
    const realCostPerLife = utilization * pkg.recurrence * avgReal * ns;
    const saleCostPerLife = utilization * pkg.recurrence * avgSell * ns;

    totalRevenue += lives * revenuePerLife;
    totalRealCost += lives * realCostPerLife;
    totalSaleCost += lives * saleCostPerLife;
  }

  const totalTax = cfg.taxRate * totalRevenue;
  const saleMargin =
    totalRevenue > 0 ? (totalRevenue - totalSaleCost - totalTax) / totalRevenue : 0;
  const realMargin =
    totalRevenue > 0 ? (totalRevenue - totalRealCost - totalTax) / totalRevenue : 0;

  return {
    saleMargin,
    realMargin,
    totalRevenue,
    totalRealCost,
    totalSaleCost,
    totalTax,
  };
}

// ---------------------------------------------------------------------------
// Reverse calculator: desired margin -> required price
// ---------------------------------------------------------------------------

export interface ReversePriceInput {
  desiredMargin: number;
  taxRate: number;
  utilization: number;
  recurrence: number;
  /** Weighted average consultation cost for the chosen basis. */
  avgConsultCost: number;
  noShowFactor: number;
  /** Optional volume discount applied to the resulting price. */
  volumeDiscountPct?: number;
}

/**
 * Reverse calculation: given a desired net margin, return the price per life
 * required to hit it. Feed `avgConsultCost` with the sell average to get the
 * price on the sale basis, or the real average for the real basis.
 */
export function reversePricePerLife(input: ReversePriceInput): number {
  const divisor = pricingDivisor(input.desiredMargin, input.taxRate);
  const base = pricePerLife({
    utilization: input.utilization,
    recurrence: input.recurrence,
    effectiveConsultCost: effectiveConsultCost(input.avgConsultCost, input.noShowFactor),
    divisor,
  });
  return applyVolumeDiscount(base, input.volumeDiscountPct ?? 0);
}

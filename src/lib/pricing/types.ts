/**
 * Domain types for the Starbem pricing engine.
 *
 * All percentages/rates are stored as FRACTIONS (0.40 = 40%), never as whole
 * numbers, so the math never has to guess the unit. Money is in BRL.
 */

/** Which cost the calculation is based on. */
export type CostBasis = 'sell' | 'real';

/**
 * A specialty (Psicologia, Nutrição, ...). The "credit" is the minimum unit of
 * appointment time (e.g. 30min). A specialty that allows a double session can
 * be delivered as 1 credit (short) or 2 credits (long).
 */
export interface Specialty {
  id: string;
  name: string;
  /** Cost in BRL of a single credit. */
  costPerCredit: number;
  /** Duration of one credit, in minutes. */
  creditDurationMin: number;
  /** Whether the specialty can be delivered in 1 or 2 credit blocks. */
  allowsDouble: boolean;
  /**
   * Observed real duration mix — fraction of sessions delivered as a SHORT
   * (1 credit) session. Only meaningful when allowsDouble is true.
   */
  realShortShare: number;
  /**
   * Observed real duration mix — fraction of sessions delivered as a LONG
   * (2 credit) session. Only meaningful when allowsDouble is true.
   * Should satisfy realShortShare + realLongShare === 1.
   */
  realLongShare: number;
}

/** One specialty line inside a package. */
export interface PackageSpecialty {
  specialtyId: string;
  /**
   * Share of the package's consultations that go to this specialty (0..1).
   * Across a package these should sum to 1.
   */
  mixShare: number;
  /** Contracted credits/month — the plan ceiling ("teto"). Informational. */
  contractedCredits: number;
}

/** A plan / package type (TP2/TP3, TP4+, ...). */
export interface PricingPackage {
  id: string;
  name: string;
  /**
   * Real expected recurrence: consultations per USER per month (typically lower
   * than the contracted ceiling). Comes from historical data, not the ceiling.
   */
  recurrence: number;
  specialties: PackageSpecialty[];
}

/** A volume band (eligible-lives bracket) with a progressive discount. */
export interface VolumeBand {
  /** Upper bound of eligible lives; null means "above the previous band". */
  maxLives: number | null;
  /** Discount applied to the FINAL price (not the cost), as a fraction. */
  discountPct: number;
  label?: string;
}

/** Global pricing parameters shared across all packages. */
export interface GlobalConfig {
  /** Target NET margin (net of revenue tax), as a fraction. */
  targetMargin: number;
  /** Revenue tax rate ("imposto sobre a receita"), as a fraction. */
  taxRate: number;
  /** Share of scheduled appointments that no-show, as a fraction. */
  noShowRate: number;
  /** Share of the full fee paid to the professional on a no-show, as a fraction. */
  noShowRepassePct: number;
  /** Utilization bands (rows of the matrix), as fractions, ascending. */
  utilizationBands: number[];
  /** Volume bands (columns of the matrix). */
  volumeBands: VolumeBand[];
}

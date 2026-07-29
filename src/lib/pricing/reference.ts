/**
 * The real reference scenario from the product brief, used both as the seed for
 * the database and as the fixed acceptance test for the calculation engine.
 *
 * If the engine reproduces these numbers, the core logic is correct.
 */

import type { GlobalConfig, PricingPackage, Specialty } from './types';

export const REFERENCE_SPECIALTIES: Specialty[] = [
  {
    id: 'psicologia',
    name: 'Psicologia',
    costPerCredit: 25,
    creditDurationMin: 30,
    allowsDouble: true,
    realShortShare: 0.76,
    realLongShare: 0.24,
  },
  {
    id: 'nutricao',
    name: 'Nutrição',
    costPerCredit: 30,
    creditDurationMin: 30,
    allowsDouble: false,
    realShortShare: 1,
    realLongShare: 0,
  },
  {
    id: 'clinico',
    name: 'Clínico Geral',
    costPerCredit: 20,
    creditDurationMin: 12,
    allowsDouble: false,
    realShortShare: 1,
    realLongShare: 0,
  },
];

/** Package mix: 90% Psicologia, 5% Nutrição, 5% Clínico Geral. */
const REFERENCE_MIX = [
  { specialtyId: 'psicologia', mixShare: 0.9, contractedCredits: 4 },
  { specialtyId: 'nutricao', mixShare: 0.05, contractedCredits: 2 },
  { specialtyId: 'clinico', mixShare: 0.05, contractedCredits: 2 },
];

export const REFERENCE_PACKAGES: PricingPackage[] = [
  {
    id: 'tp2-tp3',
    name: 'TP2/TP3',
    recurrence: 2.0,
    specialties: REFERENCE_MIX,
  },
  {
    id: 'tp4-plus',
    name: 'TP4+',
    recurrence: 3.5,
    specialties: REFERENCE_MIX,
  },
];

export const REFERENCE_CONFIG: GlobalConfig = {
  targetMargin: 0.4,
  taxRate: 0.1125,
  noShowRate: 0.105,
  noShowRepassePct: 0.3,
  utilizationBands: [0.01, 0.015, 0.02, 0.03, 0.04, 0.05, 0.06, 0.08, 0.1],
  volumeBands: [
    { maxLives: 1_000_000, discountPct: 0, label: 'até 1MM' },
    { maxLives: 1_500_000, discountPct: 0.03, label: 'até 1,5MM' },
    { maxLives: 2_000_000, discountPct: 0.05, label: 'até 2MM' },
    { maxLives: null, discountPct: 0.08, label: 'acima de 2MM' },
  ],
};

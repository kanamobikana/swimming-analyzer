import { prisma } from './db';
import { ensureSeeded } from './seed';
import type {
  GlobalConfig,
  PricingPackage,
  Specialty,
  VolumeBand,
} from './pricing/types';

/**
 * Data-access layer: loads rows from the DB and maps them into the pure
 * pricing types used by src/lib/pricing. The UI and pricing engine never touch
 * Prisma models directly.
 */

export async function getSpecialties(): Promise<Specialty[]> {
  await ensureSeeded(prisma);
  const rows = await prisma.specialty.findMany({ orderBy: { createdAt: 'asc' } });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    costPerCredit: r.costPerCredit,
    creditDurationMin: r.creditDurationMin,
    allowsDouble: r.allowsDouble,
    realShortShare: r.realShortShare,
    realLongShare: r.realLongShare,
  }));
}

export async function getPackages(): Promise<PricingPackage[]> {
  await ensureSeeded(prisma);
  const rows = await prisma.package.findMany({
    orderBy: { createdAt: 'asc' },
    include: { specialties: true },
  });
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    recurrence: p.recurrence,
    specialties: p.specialties.map((ps) => ({
      specialtyId: ps.specialtyId,
      mixShare: ps.mixShare,
      contractedCredits: ps.contractedCredits,
    })),
  }));
}

const DEFAULT_VOLUME_BANDS: VolumeBand[] = [
  { maxLives: 1_000_000, discountPct: 0, label: 'até 1MM' },
  { maxLives: 1_500_000, discountPct: 0.03, label: 'até 1,5MM' },
  { maxLives: 2_000_000, discountPct: 0.05, label: 'até 2MM' },
  { maxLives: null, discountPct: 0.08, label: 'acima de 2MM' },
];

export async function getConfig(): Promise<GlobalConfig> {
  await ensureSeeded(prisma);
  let row = await prisma.globalConfig.findUnique({ where: { id: 'global' } });
  if (!row) {
    row = await prisma.globalConfig.create({ data: { id: 'global' } });
  }

  let utilizationBands: number[] = [];
  let volumeBands: VolumeBand[] = [];
  try {
    utilizationBands = JSON.parse(row.utilizationBands);
  } catch {
    utilizationBands = [0.01, 0.015, 0.02, 0.03, 0.04, 0.05, 0.06, 0.08, 0.1];
  }
  try {
    const parsed = JSON.parse(row.volumeBands);
    volumeBands = Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_VOLUME_BANDS;
  } catch {
    volumeBands = DEFAULT_VOLUME_BANDS;
  }

  return {
    targetMargin: row.targetMargin,
    taxRate: row.taxRate,
    noShowRate: row.noShowRate,
    noShowRepassePct: row.noShowRepassePct,
    utilizationBands: [...utilizationBands].sort((a, b) => a - b),
    volumeBands,
  };
}

export function specialtiesToMap(specialties: Specialty[]): Map<string, Specialty> {
  return new Map(specialties.map((s) => [s.id, s]));
}

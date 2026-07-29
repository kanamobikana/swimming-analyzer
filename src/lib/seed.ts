import type { PrismaClient } from '@/generated/prisma/client';
import {
  REFERENCE_CONFIG,
  REFERENCE_PACKAGES,
  REFERENCE_SPECIALTIES,
} from './pricing/reference';

/** Write the Starbem reference dataset (specialties, packages, config). */
export async function seedReferenceData(prisma: PrismaClient): Promise<void> {
  for (const s of REFERENCE_SPECIALTIES) {
    await prisma.specialty.create({
      data: {
        id: s.id,
        name: s.name,
        costPerCredit: s.costPerCredit,
        creditDurationMin: s.creditDurationMin,
        allowsDouble: s.allowsDouble,
        realShortShare: s.realShortShare,
        realLongShare: s.realLongShare,
      },
    });
  }

  for (const pkg of REFERENCE_PACKAGES) {
    await prisma.package.create({
      data: {
        id: pkg.id,
        name: pkg.name,
        recurrence: pkg.recurrence,
        specialties: {
          create: pkg.specialties.map((ps) => ({
            specialtyId: ps.specialtyId,
            mixShare: ps.mixShare,
            contractedCredits: ps.contractedCredits,
          })),
        },
      },
    });
  }

  await prisma.globalConfig.upsert({
    where: { id: 'global' },
    update: {},
    create: {
      id: 'global',
      targetMargin: REFERENCE_CONFIG.targetMargin,
      taxRate: REFERENCE_CONFIG.taxRate,
      noShowRate: REFERENCE_CONFIG.noShowRate,
      noShowRepassePct: REFERENCE_CONFIG.noShowRepassePct,
      utilizationBands: JSON.stringify(REFERENCE_CONFIG.utilizationBands),
      volumeBands: JSON.stringify(REFERENCE_CONFIG.volumeBands),
    },
  });
}

/**
 * Idempotently seed the reference data the first time the app runs against an
 * empty database — so a fresh Vercel deployment shows data with no manual step.
 * Runs at most once per server instance.
 */
let ensured: Promise<void> | null = null;
export function ensureSeeded(prisma: PrismaClient): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      const count = await prisma.specialty.count();
      if (count === 0) {
        try {
          await seedReferenceData(prisma);
        } catch {
          // A concurrent instance may have seeded first; ignore races.
        }
      }
    })().catch(() => {
      // Reset so a transient failure can retry on the next request.
      ensured = null;
    });
  }
  return ensured;
}

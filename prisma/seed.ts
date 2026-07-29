import 'dotenv/config';
import path from 'node:path';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import {
  REFERENCE_CONFIG,
  REFERENCE_PACKAGES,
  REFERENCE_SPECIALTIES,
} from '../src/lib/pricing/reference';

const url =
  process.env.DATABASE_URL ?? `file:${path.join(process.cwd(), 'dev.db')}`;
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

async function main() {
  console.log('Seeding reference (Starbem) data...');

  // Reset content so the seed is idempotent.
  await prisma.proposalVersion.deleteMany();
  await prisma.proposal.deleteMany();
  await prisma.packageSpecialty.deleteMany();
  await prisma.package.deleteMany();
  await prisma.specialty.deleteMany();

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
    update: {
      targetMargin: REFERENCE_CONFIG.targetMargin,
      taxRate: REFERENCE_CONFIG.taxRate,
      noShowRate: REFERENCE_CONFIG.noShowRate,
      noShowRepassePct: REFERENCE_CONFIG.noShowRepassePct,
      utilizationBands: JSON.stringify(REFERENCE_CONFIG.utilizationBands),
      volumeBands: JSON.stringify(REFERENCE_CONFIG.volumeBands),
    },
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

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

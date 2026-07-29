import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { seedReferenceData } from '../src/lib/seed';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL não configurada.');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  console.log('Seeding reference (Starbem) data...');

  // Reset content so the seed is idempotent.
  await prisma.proposalVersion.deleteMany();
  await prisma.proposal.deleteMany();
  await prisma.packageSpecialty.deleteMany();
  await prisma.package.deleteMany();
  await prisma.specialty.deleteMany();

  await seedReferenceData(prisma);

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

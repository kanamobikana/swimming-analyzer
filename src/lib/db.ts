import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

/**
 * Prisma client singleton (Prisma 7 requires a driver adapter).
 *
 * Uses PostgreSQL via the pg driver so it runs on serverless hosts (Vercel).
 * The connection string comes from DATABASE_URL.
 */
/**
 * Resolve the Postgres connection string, tolerating the different names used
 * by common providers (Vercel Postgres, Neon integration, Supabase, ...).
 */
export function resolveDatabaseUrl(): string | undefined {
  const known =
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL;
  if (known) return known;
  // Last resort: discover ANY Postgres connection string in the environment,
  // regardless of the variable name/prefix a provider chose. Prefer a direct
  // (unpooled) connection since migrations need one.
  const candidates = Object.entries(process.env).filter(
    ([, v]) => typeof v === 'string' && /^postgres(ql)?:\/\//.test(v),
  ) as [string, string][];
  const direct = candidates.find(([k]) => /UNPOOL|NON_POOL|DIRECT/i.test(k));
  return (direct ?? candidates[0])?.[1];
}

function createClient(): PrismaClient {
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL não configurada. Defina a connection string do Postgres.',
    );
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

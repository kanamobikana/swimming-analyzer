import path from 'node:path';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@/generated/prisma/client';

/**
 * Prisma client singleton (Prisma 7 requires a driver adapter).
 *
 * The SQLite file lives at the project root as dev.db. We resolve it against
 * process.cwd() so it is found regardless of how the process was launched.
 */
function createClient(): PrismaClient {
  const url =
    process.env.DATABASE_URL ??
    `file:${path.join(process.cwd(), 'dev.db')}`;
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

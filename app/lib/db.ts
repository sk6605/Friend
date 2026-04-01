import { PrismaClient } from '../generated/prisma';

/**
 * Prisma Client Singleton
 * Prevents multiple instances in development and optimizes connection pooling.
 * 
 * NOTE: For connection pool issues, ensure DATABASE_URL includes:
 * &connection_limit=10 (or higher, depending on your DB plan limits)
 */

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

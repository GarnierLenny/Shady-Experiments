import { PrismaClient } from "@prisma/client";

// Reuse a single client across dev hot-reloads and serverless invocations to
// avoid exhausting Postgres connections. In prod each lambda still gets its own
// instance, so DATABASE_URL must point at the Supabase pooler (port 6543).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "@prisma/client";

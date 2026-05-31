import { PrismaClient } from "@prisma/client";

// Reuse a single PrismaClient across hot reloads in dev. Without this, Next.js
// re-instantiates the client on every module reload and quickly exhausts the
// database connection pool. In production a single instance is created per
// lambda/server process.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

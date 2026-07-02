import { PrismaClient } from "@prisma/client";

// Next.jsのHMRで複数インスタンスが生成されるのを防ぐ定番パターン
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

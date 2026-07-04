import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Prisma 7 + driver adapter(pg) 構成。
 * Prisma 7からはRustエンジン不要のクライアントが標準になり、
 * 接続はdriver adapter経由で行う(url指定はprisma.config.ts側)。
 * Next.jsのHMRで複数インスタンスが生成されるのを防ぐシングルトンパターンは従来通り。
 */
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

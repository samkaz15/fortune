/**
 * CL30: 読み取り負荷分散(リードレプリカ対応の接続層)
 *
 * DATABASE_URL_REPLICA が設定されている場合、読み取り専用クエリを
 * レプリカへ振り分けるためのクライアント。未設定時はプライマリと同一。
 *
 * 使い方: 集計・一覧など強い整合性が不要な読み取りは prismaRead を使う。
 * 書き込み・直後読み取り(read-your-writes)が必要な処理は従来の prisma を使う。
 *
 * シャーディング(ホット/コールド分離・ユーザーID水平分割)の設計は
 * docs/design/07_scale/scale_architecture.md を参照。
 */
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { prisma } from "@/lib/db";

const replicaUrl = process.env.DATABASE_URL_REPLICA;

export const prismaRead: PrismaClient = replicaUrl
  ? new PrismaClient({ adapter: new PrismaPg({ connectionString: replicaUrl }) })
  : prisma;

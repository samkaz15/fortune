/**
 * CL31: A/Bテスト基盤
 *
 * - userId+experimentKeyのハッシュで決定論的にバリアントを割当(同一ユーザーは常に同じ側)
 * - 初回割当をexperiment_assignmentsに永続化(統計評価はこのテーブルとanalytics_eventsをJOIN)
 * - 露出はanalytics_eventsに experiment_exposure として記録
 *
 * 使用例(ペイウォールCTA文言のA/B):
 *   const v = await getVariant(userId, "paywall_cta_v1", ["この先を、僕から聞く", "続きをひらく"]);
 */
import { prisma } from "@/lib/db";
import { trackEvent } from "@/lib/analytics";
import { createHash, randomUUID } from "node:crypto";

export async function getVariant(
  userId: string,
  experimentKey: string,
  variants: string[]
): Promise<string> {
  if (variants.length === 0) throw new Error("variants must not be empty");

  const existing = await prisma.experimentAssignment.findUnique({
    where: { userId_experimentKey: { userId, experimentKey } },
  });
  if (existing) return existing.variant;

  // 決定論的ハッシュ割当(再現可能・偏りなし)
  const h = createHash("sha256").update(`${userId}:${experimentKey}`).digest();
  const bucket = h.readUInt32BE(0) % variants.length;
  const variant = variants[bucket];

  // レース時はunique制約に任せ、負けた側は既存を読む
  try {
    await prisma.experimentAssignment.create({
      data: { id: randomUUID(), userId, experimentKey, variant },
    });
  } catch {
    const again = await prisma.experimentAssignment.findUnique({
      where: { userId_experimentKey: { userId, experimentKey } },
    });
    if (again) return again.variant;
  }

  trackEvent("experiment_exposure", { experimentKey, variant }, userId);
  return variant;
}

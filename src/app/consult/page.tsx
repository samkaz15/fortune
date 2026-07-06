import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * 占い相談の入口(LP方針 2026-07-06):
 * - 未ログイン/無料会員 → v4 LP(/report-ui/index.html)。サービスの魅力を伝える正式LP
 * - 有料会員 → LPを再度見せず /report(今日の運勢)へ直行(UX最適化 §6)
 */
export default async function ConsultPage() {
  const userId = await getCurrentUserId();
  if (userId) {
    const sub = await prisma.subscription.findFirst({ where: { userId, status: "active" } });
    if (sub) redirect("/report");
  }
  redirect("/report-ui/index.html");
}

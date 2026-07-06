import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { getRemainingDailyFreeQuota } from "@/lib/redis";

/**
 * 画面遷移設計書「マイページ」の実装(CL11)。
 * 残り質問回数・クレジット残高・契約状況・診断履歴サマリを1画面に集約する。
 * 診断履歴・お気に入りは独立画面にせずこのページ内のセクションとして扱う設計方針(WBS判断済み)。
 */
export default async function MyPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/auth/login");

  const [profile, subscription, creditBalance, pointBalance, remainingFree, recentResults] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.subscription.findUnique({ where: { userId } }),
    prisma.creditBalance.findUnique({ where: { userId } }),
    prisma.pointBalance.findUnique({ where: { userId } }),
    getRemainingDailyFreeQuota(userId),
    prisma.fortuneResult.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, summary: true, scoreOverall: true, createdAt: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6 px-5 pt-4">
      <section className="flex items-center gap-4 rounded-card border border-ink-700 bg-ink-900/50 p-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ink-800 font-display text-lg text-gold-400">
          {profile?.displayName?.slice(0, 1) ?? "?"}
        </div>
        <div>
          <p className="font-display text-base text-paper-50">{profile?.displayName ?? "ゲスト"}</p>
          <p className="text-xs text-paper-400">
            {subscription?.status === "active" ? "サブスク会員" : "無料会員"}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2">
        <StatCard label="本日の残り" value={subscription?.status === "active" ? "∞" : `${remainingFree}回`} />
        <StatCard label="ポイント" value={`${pointBalance?.balance ?? 0}`} />
        <StatCard label="クレジット" value={`${creditBalance?.balance ?? 0}`} />
      </section>

      <Link
        href="/plans"
        className="rounded-full border border-gold-500/50 py-3 text-center text-sm font-bold text-gold-400"
      >
        プラン・クレジットを管理する
      </Link>

      <section>
        <h2 className="mb-3 font-display text-sm text-paper-200">最近の診断</h2>
        <div className="flex flex-col gap-2">
          {recentResults.length === 0 && (
            <p className="text-sm text-paper-400">まだ診断履歴がありません。</p>
          )}
          {recentResults.map((r) => (
            <Link
              key={r.id}
              href={`/result/${r.id}`}
              className="flex items-center justify-between rounded-card border border-ink-700 bg-ink-900/40 px-4 py-3"
            >
              <span className="line-clamp-1 text-sm text-paper-200">{r.summary}</span>
              <span className="ml-3 shrink-0 text-xs text-gold-400">{r.scoreOverall}点</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-4 flex flex-col gap-2 text-center text-xs text-paper-600">
        <Link href="/mypage/notifications">通知設定</Link>
        <Link href="/mypage/account">会員情報・お支払い</Link>
        <Link href="/mypage/account/cancel">退会手続き</Link>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-ink-700 bg-ink-900/40 p-4">
      <p className="text-[11px] text-paper-400">{label}</p>
      <p className="mt-1 font-display text-lg text-gold-400">{value}</p>
    </div>
  );
}

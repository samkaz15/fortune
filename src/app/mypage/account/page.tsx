import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";

export default async function AccountPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/auth/login");

  const [user, subscription] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, include: { profile: true } }),
    prisma.subscription.findUnique({ where: { userId } }),
  ]);

  return (
    <div className="flex flex-col gap-4 px-5 pt-4">
      <h1 className="font-display text-lg text-paper-50">会員情報・お支払い</h1>
      <div className="rounded-card border border-ink-700 bg-ink-900/40 p-4 text-sm text-paper-200">
        <p>メールアドレス：{user?.email}</p>
        <p className="mt-1">
          契約状況：{subscription?.status === "active" ? "サブスク会員" : "無料会員"}
        </p>
      </div>
      <Link href="/mypage/account/cancel" className="text-center text-xs text-paper-600 underline">
        退会手続きはこちら
      </Link>
    </div>
  );
}

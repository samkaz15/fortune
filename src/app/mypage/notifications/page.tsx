import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";

/** 画面遷移設計書「通知設定」の最小実装。Phase2で95点通知等のしきい値UIを追加する。 */
export default async function NotificationSettingsPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/auth/login");

  const setting = await prisma.notificationSetting.findUnique({ where: { userId } });

  return (
    <div className="flex flex-col gap-4 px-5 pt-4">
      <h1 className="font-display text-lg text-paper-50">通知設定</h1>
      <div className="flex items-center justify-between rounded-card border border-ink-700 bg-ink-900/40 p-4">
        <span className="text-sm text-paper-200">プッシュ通知</span>
        <span className="text-sm text-gold-400">{setting?.pushEnabled ? "ON" : "OFF"}</span>
      </div>
      <p className="text-xs text-paper-600">
        ※ トグル操作のAPI連携はPhase2(通知高度化実装)で追加予定です。
      </p>
    </div>
  );
}

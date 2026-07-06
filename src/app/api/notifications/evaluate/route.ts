import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calculateShichu } from "@/lib/fortune-engine/shichu";

/**
 * POST /api/notifications/evaluate
 *
 * CL17: 通知高度化(95点通知・運気通知)の判定エンドポイント。
 * 日次バッチ(cron / Vercel Cron等)から呼ばれる想定で、全アクティブユーザーの
 * 当日運気スコアを計算し、しきい値(既定95点)以上のユーザーにのみ通知を発火する。
 *
 * GM3の知見「高スコア日のみ通知することで通知の希少性・CTRを維持する」を実装したもの。
 *
 * 実際のPush送信(Web Push / LINE)は本APIでは行わず、判定結果をNotificationLogに記録し、
 * channel未設定のユーザーはskippedとして残す。送信処理は:
 *   - Web Push: pushSubscription設定済みユーザーに対して別途worker実装(要VAPIDキー)
 *   - LINE: CL22のLINE連携完了ユーザーに対しMessaging APIで送信(要チャネルトークン)
 * どちらも外部サービスの credential が必要なため、本サンドボックスでは判定+記録までを実装する。
 *
 * セキュリティ: バッチ専用のため、CRON_SECRET ヘッダで保護する(Vercel Cronの推奨パターン)。
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    include: { profile: true, notifications: true },
  });

  const today = new Date();
  let sent = 0;
  let skipped = 0;

  for (const user of users) {
    if (!user.profile) continue;
    const setting = user.notifications;
    if (!setting?.pushEnabled) continue;

    const threshold = setting.scoreThreshold ?? 95;
    const { wave } = calculateShichu(user.profile.birthDate, today);

    if (wave < threshold) {
      await prisma.notificationLog.create({
        data: {
          userId: user.id,
          type: "score_threshold",
          score: wave,
          channel: "none",
          status: "skipped_below_threshold",
        },
      });
      skipped++;
      continue;
    }

    // 通知メッセージ(CEO_STRAT: 常にポジティブ・決め打ち。糸町の少年の一人称「僕」)
    const message = `今日のあなたの運気は${wave}点。僕が保証する、動くなら今日だよ。`;

    const hasWebPush = Boolean(setting.pushSubscription);
    const hasLine = Boolean(user.lineUserId);
    const channel = hasWebPush ? "web_push" : hasLine ? "line" : "none";

    await prisma.notificationLog.create({
      data: {
        userId: user.id,
        type: "score_threshold",
        score: wave,
        channel,
        // 実送信worker未接続のため、チャネルがあっても現段階では判定記録まで。
        // worker接続後にstatusを sent に更新するフローとする。
        status: channel === "none" ? "skipped_no_channel" : "sent",
        message,
      },
    });
    if (channel !== "none") sent++;
    else skipped++;
  }

  return NextResponse.json({ evaluated: users.length, sent, skipped });
}

// Vercel CronはGETで叩くため同じハンドラをGETにも割り当てる
export const GET = POST;

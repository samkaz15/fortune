/**
 * トークション日程予約: Googleカレンダー連携アダプタ(仕様書§日程予約)
 *
 * - GOOGLE_CALENDAR_ID と GOOGLE_API_KEY(またはサービスアカウント)設定時:
 *   freebusy APIで占い師の空き時間を取得する
 * - 未設定時(開発/MVP初期): 固定ルールのモック空き枠にフォールバック
 *   (翌日以降7日間の 10:00 / 14:00 / 20:00 JST。予約済み枠は除外)
 *
 * カレンダー障害時もフォールバックするため、予約フローが止まることはない。
 */
import { prisma } from "@/lib/db";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const SLOT_HOURS_JST = [10, 14, 20];
const DAYS_AHEAD = 7;

export interface TimeSlot {
  startsAt: string; // ISO
  label: string; // 表示用(JST)
}

export async function getAvailableSlots(): Promise<TimeSlot[]> {
  const candidates = buildCandidateSlots();

  // Googleカレンダーが設定されていれば busy 時間帯を除外する
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const apiKey = process.env.GOOGLE_API_KEY;
  let busy: { start: string; end: string }[] = [];
  if (calendarId && apiKey) {
    try {
      const res = await fetch(`https://www.googleapis.com/calendar/v3/freeBusy?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timeMin: candidates[0]?.startsAt,
          timeMax: candidates[candidates.length - 1]?.startsAt,
          items: [{ id: calendarId }],
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { calendars?: Record<string, { busy?: { start: string; end: string }[] }> };
        busy = data.calendars?.[calendarId]?.busy ?? [];
      }
    } catch {
      // カレンダー障害時はフォールバック(候補全件から予約済みのみ除外)
    }
  }

  // 既存予約と busy を除外
  const reserved = await prisma.auctionReservation.findMany({
    where: { status: "reserved", scheduledAt: { gte: new Date() } },
    select: { scheduledAt: true },
  });
  const reservedSet = new Set(reserved.map((r: { scheduledAt: Date }) => r.scheduledAt.toISOString()));

  return candidates.filter((slot) => {
    if (reservedSet.has(slot.startsAt)) return false;
    const t = new Date(slot.startsAt).getTime();
    return !busy.some((b) => t >= new Date(b.start).getTime() && t < new Date(b.end).getTime());
  });
}

export function isValidSlot(startsAt: string): boolean {
  return buildCandidateSlots().some((s) => s.startsAt === startsAt);
}

function buildCandidateSlots(): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const now = new Date();
  const jstNow = new Date(now.getTime() + JST_OFFSET_MS);
  for (let d = 1; d <= DAYS_AHEAD; d++) {
    for (const hour of SLOT_HOURS_JST) {
      const jst = Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate() + d, hour);
      const startsAt = new Date(jst - JST_OFFSET_MS);
      const mm = String(new Date(jst).getUTCMonth() + 1);
      const dd = String(new Date(jst).getUTCDate());
      slots.push({
        startsAt: startsAt.toISOString(),
        label: `${mm}/${dd} ${hour}:00〜(1時間)`,
      });
    }
  }
  return slots;
}

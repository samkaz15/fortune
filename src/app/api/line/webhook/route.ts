import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { redis } from "@/lib/redis";

/**
 * POST /api/line/webhook
 *
 * CL22: LINE Messaging APIのWebhook受け口。
 * 現段階で処理するイベント:
 *  - message(text): 6桁の連携コードを受け取ったらアカウント紐付けを行う
 *  - follow: 挨拶リプライ(トークンが設定されている場合のみ)
 *
 * 署名検証(x-line-signature)はLINEの必須要件。channel secret未設定時は
 * 503を返し、誤って未検証で処理してしまう事故を防ぐ。
 */
export async function POST(req: NextRequest) {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret) {
    return NextResponse.json({ error: "LINE_NOT_CONFIGURED" }, { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";
  const expected = createHmac("sha256", channelSecret).update(rawBody).digest("base64");
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 401 });
  }

  const body = JSON.parse(rawBody);
  const events: LineEvent[] = body.events ?? [];

  for (const event of events) {
    if (event.type === "message" && event.message?.type === "text" && event.source?.userId) {
      const text = event.message.text.trim();
      if (/^\d{6}$/.test(text)) {
        await handleLinkCode(text, event.source.userId, event.replyToken);
      }
    }
  }

  return NextResponse.json({ ok: true });
}

interface LineEvent {
  type: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: { type: string; text: string };
}

async function handleLinkCode(code: string, lineUserId: string, replyToken?: string) {
  const userId = await redis.get<string>(`line:link:${code}`);
  if (!userId) {
    await replyText(replyToken, "そのコードは見つからなかったよ。アプリでもう一度発行してみてね。");
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { lineUserId },
  });
  await redis.del(`line:link:${code}`);

  await replyText(
    replyToken,
    "連携できたよ！これからは運気のいい日をLINEでも知らせるね。大丈夫、必ずうまくいく！"
  );
}

/** 返信はトークンが設定されている場合のみ実行(未設定の開発環境ではログのみ) */
async function replyText(replyToken: string | undefined, text: string) {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!replyToken || !accessToken) {
    console.info("[line] reply skipped (no token):", text);
    return;
  }
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
  });
}

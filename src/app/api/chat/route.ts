import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId, AuthRequiredError } from "@/lib/auth";
import { consumeDailyFreeQuota, refundDailyFreeQuota, FREE_MEMBER_DAILY_LIMIT } from "@/lib/redis";
import { trackEvent } from "@/lib/analytics";
import { acquireGenerationLock, releaseGenerationLock } from "@/lib/redis";
import { generateFortune } from "@/lib/fortune-engine";
import { getWeatherContext } from "@/lib/weather";
import { detectCrisis, crisisResponseMessage } from "@/lib/fortune-engine/crisis-detection";
import { createKnowledgeEntry } from "@/lib/decision-report/knowledge";

/** shichuのadvice文から運勢タグを1語抽出(decision-report/index.tsと同じマッピング) */
function extractTagFromAdvice(advice: string): string {
  if (advice.includes("行動力")) return "決断";
  if (advice.includes("育てる")) return "継続";
  if (advice.includes("足元")) return "準備";
  if (advice.includes("判断力")) return "決断";
  if (advice.includes("柔軟")) return "つながり";
  return "流れ";
}

/**
 * POST /api/chat
 * 画面遷移設計書「占いチャット」の唯一の入口。
 * 人間関係/自分のこと/ビジネス/相性/今日の占い、すべてこのAPI 1本で受け、
 * category はチャット冒頭でAIが分岐して決める(フロント側でもcategory省略時はTODAYを既定にする)。
 *
 * 課金導線の分岐(要件定義CL4準拠):
 * 1) 無料枠(1日5回)が残っていれば無料で生成
 * 2) 枠を使い切っていて追加クレジット残高があればクレジットを1消費
 * 3) どちらもなければ 402 を返し、フロントは /plans への誘導CTAを出す
 */

const requestSchema = z.object({
  sessionId: z.string().uuid().optional(), // 未指定なら新規セッションを開始
  category: z.enum(["RELATIONSHIP", "SELF", "BUSINESS", "COMPATIBILITY", "TODAY"]),
  message: z.string().min(1).max(2000),
  context: z
    .object({
      relationship: z.enum(["片思い", "交際中", "復縁"]).optional(),
      occupation: z.enum(["会社員", "経営者", "フリーランス", "学生"]).optional(),
    })
    .optional(),
  partner: z
    .object({
      familyName: z.string().min(1),
      givenName: z.string().min(1),
      birthDate: z.string(), // ISO date
    })
    .optional(), // 相性診断(COMPATIBILITY)のときのみ必須
  location: z.object({ lat: z.number(), lon: z.number() }).optional(),
});

export async function POST(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    }
    throw e;
  }

  const parsed = requestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST", detail: parsed.error.flatten() }, { status: 400 });
  }
  const { sessionId, category, message, partner, location, context } = parsed.data;

  // ---- 0. crisis検知(GPT3安全設計 Layer2) ----
  // 課金判定・AI生成より前に行う。自傷等の示唆がある場合は無料枠/クレジットを消費せず、
  // 固定の専門窓口案内を返す(LLMには生成させない。確実性を優先するため)。
  if (detectCrisis(message)) {
    const session = sessionId
      ? await prisma.fortuneSession.findFirstOrThrow({ where: { id: sessionId, userId } })
      : await prisma.fortuneSession.create({ data: { userId, category, status: "in_progress" } });

    const crisisMessage = crisisResponseMessage();
    await prisma.fortuneMessage.createMany({
      data: [
        { sessionId: session.id, role: "user", content: message },
        { sessionId: session.id, role: "assistant", content: crisisMessage },
      ],
    });

    return NextResponse.json({
      sessionId: session.id,
      resultId: null,
      message: crisisMessage,
      isCrisis: true,
    });
  }

  // ---- 1. 利用回数 / ポイント / クレジットの判定 ----
  // 消費順序: 無料枠(1日5回) → ポイント(紹介報酬等) → 追加クレジット(有料)
  // 有償で購入したクレジットを最後に温存するのがユーザーにとって最も損のない順序のため。
  // 会員仕様v5(2026-07-06): 無料会員=1回/日、有料会員=5回/日。
  // 超過後は 有料会員のみ追加クレジット(5回300円パック)で継続できる。
  const activeSub = await prisma.subscription.findFirst({ where: { userId, status: "active" } });
  const isSubscribed = Boolean(activeSub);
  const quota = await consumeDailyFreeQuota(userId, isSubscribed ? undefined : FREE_MEMBER_DAILY_LIMIT);
  let usedCredit = false;
  let usedPoint = false;
  if (!quota.allowed) {
    if (!isSubscribed) {
      // 無料会員: クレジット消費はさせず「もっと占う」(サブスク)へ誘導する
      return NextResponse.json(
        {
          error: "UPGRADE_REQUIRED",
          message: "無料の質問は本日分を使い切りました。「もっと占う」で続きが聞けます。",
          cta: { label: "もっと占う", note: "※初月500円 月額980円", href: "/plans" },
        },
        { status: 402 }
      );
    }
    const pointBalance = await prisma.pointBalance.findUnique({ where: { userId } });
    if (pointBalance && pointBalance.balance > 0) {
      await prisma.$transaction([
        prisma.pointBalance.update({ where: { userId }, data: { balance: { decrement: 1 } } }),
        prisma.pointTransaction.create({ data: { userId, type: "redeem", amount: -1, reason: "質問1回に使用" } }),
      ]);
      usedPoint = true;
    } else {
      const creditBalance = await prisma.creditBalance.findUnique({ where: { userId } });
      if (!creditBalance || creditBalance.balance <= 0) {
        return NextResponse.json(
          {
            error: "QUOTA_EXCEEDED",
            message: "本日の5回分を使い切りました。追加の質問は5回300円で購入できます。",
            cta: { label: "追加5回を購入する(¥300)", href: "/plans#credits" },
          },
          { status: 402 }
        );
      }
      await prisma.$transaction([
        prisma.creditBalance.update({ where: { userId }, data: { balance: { decrement: 1 } } }),
        prisma.creditTransaction.create({
          data: { userId, type: "consume", amount: -1 },
        }),
      ]);
      usedCredit = true;
    }
  }

  // ---- 2. プロフィール(PII)取得。未登録なら先に登録を促す ----
  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  if (!profile) {
    return NextResponse.json(
      { error: "PROFILE_REQUIRED", message: "占いには名前・生年月日の登録が必要です。" },
      { status: 409 }
    );
  }

  // ---- 3. セッション取得 or 新規作成 ----
  const session = sessionId
    ? await prisma.fortuneSession.findFirstOrThrow({ where: { id: sessionId, userId } })
    : await prisma.fortuneSession.create({ data: { userId, category, status: "in_progress" } });

  await prisma.fortuneMessage.create({
    data: { sessionId: session.id, role: "user", content: message },
  });

  // ---- 4. 二重生成防止ロック ----
  const locked = await acquireGenerationLock(session.id);
  if (!locked) {
    return NextResponse.json({ error: "GENERATION_IN_PROGRESS" }, { status: 429 });
  }

  trackEvent("chat_message", { category, approxTokens: Math.ceil(message.length / 2) }, userId);

  // CEO_QUOTA_definition(2026-07-05): 「1日5回」は"返信が届いた回数"でカウントする。
  // 消費自体は上限突破防止のため生成前にアトミックに行い、
  // 生成に失敗して返信を届けられなかった場合はここで払い戻す。
  async function refundConsumedResource() {
    try {
      if (usedPoint) {
        await prisma.$transaction([
          prisma.pointBalance.update({ where: { userId }, data: { balance: { increment: 1 } } }),
          prisma.pointTransaction.create({
            data: { userId, type: "refund", amount: 1, reason: "返信生成失敗のため払い戻し" },
          }),
        ]);
      } else if (usedCredit) {
        await prisma.$transaction([
          prisma.creditBalance.update({ where: { userId }, data: { balance: { increment: 1 } } }),
          prisma.creditTransaction.create({ data: { userId, type: "refund", amount: 1 } }),
        ]);
      } else {
        await refundDailyFreeQuota(userId);
      }
    } catch (refundError) {
      // 払い戻し自体の失敗は監査ログに残す(ユーザー救済は手動対応)
      console.error("[quota] refund failed", refundError);
      await prisma.auditLog.create({
        data: {
          actorType: "system",
          action: "quota_refund_failed",
          targetType: "user",
          targetId: userId,
          metadata: { sessionId: session.id },
        },
      }).catch(() => {});
    }
  }

  try {
    const weatherContext = location ? await getWeatherContext(location.lat, location.lon) : null;

    const result = await generateFortune({
      category,
      profile: {
        familyName: profile.name.slice(0, 1), // TODO: 姓/名を分離して保存するようプロフィール入力フォームを設計する
        givenName: profile.name.slice(1),
        birthDate: profile.birthDate,
        birthTime: profile.birthTime ?? undefined,
        gender: profile.gender ?? undefined,
      },
      extraContext: context,
      partnerProfile: partner
        ? {
            familyName: partner.familyName,
            givenName: partner.givenName,
            birthDate: new Date(partner.birthDate),
          }
        : undefined,
      userQuestion: message,
      weatherContext,
    });

    await prisma.fortuneMessage.create({
      data: { sessionId: session.id, role: "assistant", content: result.message },
    });

    const fortuneResult = await prisma.fortuneResult.upsert({
      where: { sessionId: session.id },
      create: {
        sessionId: session.id,
        userId,
        summary: result.summary,
        bodyText: result.message,
        nextActions: result.nextActions,
        scoreOverall: result.overallScore,
        isUnlocked: false,
        seimeiScore: result.seimeiScore as unknown as object,
        sanmeiSummary: result.sanmeiSummary as unknown as object,
        shichuSummary: result.shichuSummary as unknown as object,
        horoscope: result.horoscope as unknown as object,
        weatherContext: weatherContext as unknown as object,
      },
      update: {
        summary: result.summary,
        bodyText: result.message,
        nextActions: result.nextActions,
        scoreOverall: result.overallScore,
      },
    });

    await prisma.fortuneSession.update({ where: { id: session.id }, data: { status: "completed" } });

    // RAG知識ベースへの構造化保存(CEO_UPDATE「会話ログの活用」)。
    // 失敗しても占い本体のレスポンスは止めない(ベストエフォート)。
    try {
      await createKnowledgeEntry({
        userId,
        sessionId: session.id,
        category,
        firstUserMessage: message,
        fortuneKeyword: result.shichuSummary?.advice
          ? extractTagFromAdvice(result.shichuSummary.advice)
          : "流れ",
        advice: result.message,
        nextAction: result.nextActions[0] ?? "",
      });
    } catch (e) {
      console.warn("[knowledge] entry creation failed", e);
    }

    return NextResponse.json({
      sessionId: session.id,
      resultId: fortuneResult.id,
      message: result.message,
      usedCredit,
      usedPoint,
      remainingFreeQuota: quota.remaining,
    });
  } catch (e) {
    // 返信を届けられなかったため、消費リソースを払い戻す(CEO_QUOTA_definition)
    console.error("[chat] generation failed", e);
    await refundConsumedResource();
    return NextResponse.json(
      { error: "GENERATION_FAILED", message: "占いの生成に失敗しました。回数は消費されていません。もう一度お試しください。" },
      { status: 500 }
    );
  } finally {
    await releaseGenerationLock(session.id);
  }
}

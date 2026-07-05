/**
 * GET  /api/auction/reviews            … レビュー一覧(公開。悪い評価も削除せず全表示・仕様書§3)
 * POST /api/auction/reviews {ticketId, rating, comment} … 落札面談後のユーザーのみ投稿可
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId, AuthRequiredError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const reviews = await prisma.auctionReview.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  // 表示名は出さない(匿名レビュー)。星とコメントのみ返す
  return NextResponse.json({
    reviews: reviews.map((r: { rating: number; comment: string; createdAt: Date }) => ({
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
    })),
  });
}

const postSchema = z.object({
  ticketId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(500),
});

export async function POST(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (e) {
    if (e instanceof AuthRequiredError) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    throw e;
  }
  const parsed = postSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  const { ticketId, rating, comment } = parsed.data;

  const ticket = await prisma.auctionTicket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.winnerUserId !== userId || ticket.status !== "fulfilled") {
    return NextResponse.json({ error: "NOT_ELIGIBLE" }, { status: 403 });
  }
  try {
    const review = await prisma.auctionReview.create({ data: { ticketId, userId, rating, comment } });
    return NextResponse.json({ reviewId: review.id });
  } catch {
    return NextResponse.json({ error: "ALREADY_REVIEWED" }, { status: 409 });
  }
}

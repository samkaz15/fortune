/**
 * PATCH /api/admin/auction (x-admin-secret保護)
 * { ticketId, topics?: string[], profileText?: string }
 * 「相談できる内容」「占い師プロフィール」を管理画面から追加・編集する(仕様書§2)。
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const schema = z.object({
  ticketId: z.string().uuid(),
  topics: z.array(z.string().min(1).max(50)).max(20).optional(),
  profileText: z.string().max(1000).optional(),
});

export async function PATCH(req: NextRequest) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.headers.get("x-admin-secret") !== secret) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  const { ticketId, topics, profileText } = parsed.data;

  const ticket = await prisma.auctionTicket.update({
    where: { id: ticketId },
    data: {
      ...(topics !== undefined ? { topics } : {}),
      ...(profileText !== undefined ? { profileText } : {}),
    },
  });
  await prisma.auditLog.create({
    data: { actorType: "admin", action: "admin_update_ticket", targetType: "auction_ticket", targetId: ticketId, metadata: { topics, profileText: Boolean(profileText) } },
  });
  return NextResponse.json({ id: ticket.id, topics: ticket.topics, profileText: ticket.profileText });
}

/** POST /api/profile/avatar { dataUrl } — アバター設定(2026-07-07 CEO要求)。縮小済みJPEG data URLをprofileに保存 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId, AuthRequiredError } from "@/lib/auth";

const schema = z.object({
  dataUrl: z.string().regex(/^data:image\/(jpeg|png|webp);base64,/).max(140_000), // 約100KB上限
});

export async function POST(req: NextRequest) {
  let userId: string;
  try { userId = await requireUserId(); }
  catch (e) { if (e instanceof AuthRequiredError) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 }); throw e; }
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "INVALID_IMAGE" }, { status: 400 });
  await prisma.userProfile.update({ where: { userId }, data: { avatar: parsed.data.dataUrl } });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  let userId: string;
  try { userId = await requireUserId(); }
  catch (e) { if (e instanceof AuthRequiredError) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 }); throw e; }
  await prisma.userProfile.update({ where: { userId }, data: { avatar: null } });
  return NextResponse.json({ ok: true });
}

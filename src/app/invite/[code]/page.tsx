import Link from "next/link";
import { prisma } from "@/lib/db";

/**
 * 招待着地ページ(紹介制度 2026-07-07 復活・Marketing-011,012,013)。
 * v5仕様でUI導線は一度廃止されたが、CEO指示によりSNSシェア連動の新設計として復活。
 * コードが実在しない場合も、そのまま会員登録へは進める(紹介特典が付かないだけ)。
 */
export default async function InvitePage({ params }: { params: { code: string } }) {
  const inviter = await prisma.user.findUnique({
    where: { referralCode: params.code },
    select: { profile: { select: { displayName: true } } },
  });
  const inviterName = inviter?.profile?.displayName ?? "友達";

  return (
    <div className="flex flex-col items-center gap-6 px-5 pt-16 text-center">
      <p className="font-display text-sm tracking-[0.3em] text-gold-500">ITOMACHI NO SHONEN</p>
      <h1 className="font-display text-xl leading-relaxed text-paper-50">
        {inviterName}さんから
        <br />
        招待が届いています
      </h1>
      <p className="text-sm leading-relaxed text-paper-300">
        今すぐ会員登録すると、あなたにも{inviterName}さんにも
        <br />
        ポイントがプレゼントされます。
      </p>
      <Link
        href={`/auth/signup?ref=${params.code}`}
        className="w-full max-w-xs rounded-full bg-gold-500 py-3.5 text-center text-sm font-bold text-ink-950 shadow-[0_4px_0_#8a6b25] active:translate-y-1"
      >
        招待を受けて登録する
      </Link>
      <Link href="/" className="text-xs text-paper-500 underline">
        招待コードなしでトップへ
      </Link>
    </div>
  );
}

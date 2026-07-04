import Link from "next/link";
import { prisma } from "@/lib/db";

/**
 * CL20: 招待リンクの着地ページ(/invite/:code)。
 * IA設計書⑨の設計通り「招待用の一時URLを新規追加するだけ」で、サイト構造は変えない。
 * コードをクエリ付きで登録ページへ引き継ぐ。
 */
export default async function InvitePage({ params }: { params: { code: string } }) {
  const inviter = await prisma.user.findUnique({
    where: { referralCode: params.code },
    include: { profile: { select: { displayName: true } } },
  });

  const inviterName = inviter?.profile?.displayName ?? "友達";
  const valid = Boolean(inviter);

  return (
    <div className="flex flex-col items-center gap-6 px-5 pt-16 text-center">
      <p className="font-display text-sm tracking-[0.3em] text-gold-500">INVITATION</p>
      {valid ? (
        <>
          <h1 className="font-display text-2xl leading-snug text-paper-50">
            {inviterName}さんから
            <br />
            招待が届いています
          </h1>
          <p className="max-w-[28ch] text-sm leading-relaxed text-paper-400">
            登録すると、あなたにも{inviterName}さんにも質問1回分のポイントが入ります。
          </p>
          <Link
            href={`/auth/signup?ref=${params.code}`}
            className="w-full max-w-xs rounded-full bg-gold-500 py-3 text-sm font-bold text-ink-950"
          >
            招待を受けて始める
          </Link>
        </>
      ) : (
        <>
          <h1 className="font-display text-xl text-paper-50">この招待リンクは見つかりませんでした</h1>
          <Link href="/" className="text-sm font-bold text-gold-400 underline">
            トップへ →
          </Link>
        </>
      )}
    </div>
  );
}

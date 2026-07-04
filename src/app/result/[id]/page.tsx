import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { ScoreOrb } from "@/components/ScoreOrb";
import { ShareButtons } from "@/components/ShareButtons";
import { recommendNextCategory } from "@/lib/recommendation";

/**
 * 画面遷移設計書「診断結果(ロック中/解放済み)」の実装。
 * 未ログインでも閲覧可能にし(IA設計書⑥のバイラル設計方針)、
 * 全文は isUnlocked のときのみ表示する。
 * CL19: 末尾に「次のおすすめ診断」(匿名集計ベースの推薦)を表示する。
 */
export default async function ResultPage({ params }: { params: { id: string } }) {
  const result = await prisma.fortuneResult.findUnique({
    where: { id: params.id },
    include: { session: { select: { category: true } } },
  });
  if (!result) notFound();

  const viewerId = await getCurrentUserId();
  let isUnlocked = result.isUnlocked;
  if (viewerId === result.userId && !isUnlocked) {
    const sub = await prisma.subscription.findUnique({ where: { userId: result.userId } });
    isUnlocked = sub?.status === "active";
  }

  const nextActions = (result.nextActions as string[]) ?? [];
  const recommendation = await recommendNextCategory(result.session.category);

  return (
    <div className="flex flex-col gap-6 px-5 pt-4">
      <div className="flex flex-col items-center gap-3">
        {result.scoreOverall !== null && <ScoreOrb score={result.scoreOverall} />}
        <p className="text-center text-sm leading-relaxed text-paper-200">{result.summary}</p>
      </div>

      <section className="rounded-card border border-ink-700 bg-ink-900/50 p-5">
        <h2 className="mb-3 font-display text-sm text-gold-400">ネクストアクション</h2>
        <ul className="space-y-2">
          {nextActions.map((action, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed text-paper-100">
              <span className="text-gold-500">{i + 1}.</span>
              <span>{action}</span>
            </li>
          ))}
        </ul>
      </section>

      {isUnlocked ? (
        <>
          <section className="rounded-card border border-ink-700 bg-ink-900/50 p-5">
            <h2 className="mb-3 font-display text-sm text-gold-400">くわしい結果</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-paper-100">{result.bodyText}</p>
          </section>
          <ShareButtons resultId={result.id} />
        </>
      ) : (
        <div className="relative rounded-card border border-gold-500/40 bg-ink-900/70 p-5">
          <p className="mb-2 text-xs font-bold text-gold-400">今日のあなたには、まだ続きがあります。</p>
          <div className="pointer-events-none select-none blur-sm">
            <p className="text-sm leading-relaxed text-paper-400">
              ここから先は、もう少し深く、あなたの流れを読み解いた内容です。
            </p>
          </div>
          <a
            href="/plans"
            className="absolute inset-x-4 bottom-4 rounded-full bg-gold-500 py-3 text-center text-sm font-bold text-ink-950"
          >
            続きを見る
          </a>
        </div>
      )}

      <Link
        href={`/consult?category=${recommendation.category}`}
        className="rounded-card border border-ink-700 bg-ink-900/40 p-4"
      >
        <p className="mb-1 text-xs text-paper-600">あわせて見られている診断</p>
        <p className="text-sm font-bold text-gold-400">「{recommendation.label}」も占ってみる →</p>
      </Link>
    </div>
  );
}

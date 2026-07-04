import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

/**
 * CL18: 神社詳細。一般情報と、CEOの参拝レビュー(GPT8の5ブロック構成)を表示する。
 * レビューblocksのJSON構造: { block1: string, ..., block5: string }
 * 各ブロックの意味はGPT8_ux_writing_guidelines.md参照
 * (1:出会いの一文 / 2:五感の描写 / 3:占術的視点 / 4:体験のハイライト / 5:読者への誘い)
 */
export default async function ShrineDetailPage({ params }: { params: { id: string } }) {
  const shrine = await prisma.shrine.findUnique({
    where: { id: params.id },
    include: { reviews: { orderBy: { createdAt: "desc" } } },
  });
  if (!shrine) notFound();

  const tags = (shrine.tags as string[]) ?? [];

  return (
    <div className="flex flex-col gap-5 px-5 pt-4 pb-8">
      <div>
        <h1 className="font-display text-xl text-paper-50">{shrine.name}</h1>
        <p className="mt-1 text-xs text-paper-400">
          {shrine.prefecture} {shrine.city}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span key={t} className="rounded-full border border-ink-700 px-2 py-0.5 text-[10px] text-paper-400">
              #{t}
            </span>
          ))}
        </div>
      </div>

      <section className="rounded-card border border-ink-700 bg-ink-900/40 p-4">
        <h2 className="mb-2 text-xs font-bold text-paper-400">基本情報</h2>
        <p className="whitespace-pre-line text-sm leading-relaxed text-paper-200">{shrine.generalInfo}</p>
      </section>

      {shrine.reviews.map((review) => {
        const blocks = review.blocks as Record<string, string>;
        return (
          <section key={review.id} className="rounded-card border border-torii-500/40 bg-ink-900/60 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-bold text-torii-500">運営者の参拝レビュー</h2>
              {review.visitedAt && (
                <span className="text-[10px] text-paper-600">
                  {new Date(review.visitedAt).toLocaleDateString("ja-JP")} 参拝
                </span>
              )}
            </div>
            <div className="space-y-3 text-sm leading-relaxed text-paper-100">
              {["block1", "block2", "block3", "block4", "block5"].map(
                (key) => blocks[key] && <p key={key}>{blocks[key]}</p>
              )}
            </div>
          </section>
        );
      })}

      {shrine.reviews.length === 0 && (
        <p className="text-center text-xs text-paper-600">
          運営者の参拝レビューは、実際に参拝でき次第この場所に追加されます。
        </p>
      )}
    </div>
  );
}

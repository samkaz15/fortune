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
  // UI仕様v5: 画像・ショート動画(YouTube埋込)・SNSリンク
  const media = (shrine.media ?? {}) as {
    imageUrl?: string;
    videoUrl?: string;
    sns?: { x?: string; instagram?: string; tiktok?: string };
  };

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

      {media.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media.imageUrl} alt={shrine.name} className="h-44 w-full rounded-card border border-ink-700 object-cover" />
      )}

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

      {media.videoUrl && (
        <section className="rounded-card border border-ink-700 bg-ink-900/40 p-3">
          <h2 className="mb-2 text-xs font-bold text-paper-400">ショート動画</h2>
          <div className="overflow-hidden rounded-xl" style={{ aspectRatio: "16/9" }}>
            <iframe
              src={media.videoUrl}
              title={`${shrine.name} の動画`}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </section>
      )}

      {media.sns && (media.sns.x || media.sns.instagram || media.sns.tiktok) && (
        <section className="flex gap-2">
          {media.sns.x && (
            <a href={media.sns.x} target="_blank" rel="noopener noreferrer" className="flex-1 rounded-full border border-ink-700 py-2 text-center text-xs font-bold text-paper-200">X</a>
          )}
          {media.sns.instagram && (
            <a href={media.sns.instagram} target="_blank" rel="noopener noreferrer" className="flex-1 rounded-full border border-ink-700 py-2 text-center text-xs font-bold text-paper-200">Instagram</a>
          )}
          {media.sns.tiktok && (
            <a href={media.sns.tiktok} target="_blank" rel="noopener noreferrer" className="flex-1 rounded-full border border-ink-700 py-2 text-center text-xs font-bold text-paper-200">TikTok</a>
          )}
        </section>
      )}

      {shrine.reviews.length === 0 && (
        <p className="text-center text-xs text-paper-600">
          運営者の参拝レビューは、実際に参拝でき次第この場所に追加されます。
        </p>
      )}
    </div>
  );
}

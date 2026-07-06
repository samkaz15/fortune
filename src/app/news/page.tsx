import { AffSlot } from "@/components/ui-common";
/**
 * 画面遷移設計書「お知らせ一覧」の実装。
 * TODO: 現状はNewsテーブルが未設計のため、CEOコメント/キャンペーン告知用の
 * テーブルをDB設計に追加してから実データに差し替える(prisma.news.findMany()等)。
 * ボトムナビの4タブ構成を崩さないために、先にダミーページとして用意しておく。
 */
export default async function NewsPage() {
  const items = await getPlaceholderNews();

  return (
    <div className="flex flex-col gap-4 px-5 pt-4">
      <h1 className="font-display text-lg text-paper-50">お知らせ</h1>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-card border border-ink-700 bg-ink-900/40 p-4">
            <p className="text-[11px] text-paper-600">{item.date}</p>
            <p className="mt-1 text-sm text-paper-100">{item.title}</p>
          </div>
        ))}
      </div>
      <AffSlot />
    </div>
  );
}

async function getPlaceholderNews() {
  // TODO: prisma.news.findMany() に差し替える(News/Announcementモデルの追加が必要)
  return [
    { id: "1", date: "2026/07/06", title: "糸町の少年、サービス開始しました。" },
    { id: "2", date: "2026/07/13", title: "週替わりオークションを開始します。" },
  ];
}

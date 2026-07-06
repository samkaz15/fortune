import Link from "next/link";

/** お問い合わせ・サポート(UI仕様v5: メニューからの404禁止対応)。窓口は公式LINEに集約。 */
export default function SupportPage() {
  const line = process.env.NEXT_PUBLIC_LINE_OFFICIAL_URL ?? "#";
  return (
    <div className="flex flex-col gap-5 px-4 pt-6">
      <h1 className="text-center font-display text-lg text-paper-50">お問い合わせ・サポート</h1>
      <p className="text-center text-xs leading-relaxed text-paper-400">
        ご質問・不具合のご報告・お支払いに関するご相談は、
        <br />
        公式LINEにて承っています。
      </p>
      <a
        href={line}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full bg-[#06C755] py-3.5 text-center text-sm font-bold text-white shadow-lantern active:translate-y-0.5"
      >
        公式LINEで問い合わせる
      </a>
      <div className="rounded-card border border-ink-700 bg-ink-900/50 p-5 text-xs leading-relaxed text-paper-300">
        <p className="mb-2 font-bold text-paper-100">よくあるお問い合わせ</p>
        <p>・お支払い/解約について → <Link href="/mypage/account" className="text-gold-400 underline">アカウント設定</Link></p>
        <p className="mt-1">・通知の変更 → <Link href="/mypage/notifications" className="text-gold-400 underline">通知設定</Link></p>
        <p className="mt-1">・利用規約 → <Link href="/legal/terms" className="text-gold-400 underline">こちら</Link></p>
      </div>
    </div>
  );
}

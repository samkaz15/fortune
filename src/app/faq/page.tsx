import type { Metadata } from "next";
import Link from "next/link";

/**
 * FAQページ(マーケ03章§2: FAQ 1ページ / Marketing-027)。
 * AEO対応: FAQPage構造化データを埋め込み、AI検索(AI Overviews等)からの引用を狙う。
 * 占術の根拠説明を含めることでEEAT(専門性)も同時に訴求する(03章の占術解説クラスター)。
 */

const FAQS: { q: string; a: string }[] = [
  { q: "錦糸町の少年とは何ですか?", a: "AIキャラクター「錦糸町の少年」があなたの相談に答える占いサービスです。算命学・四柱推命・九星気学・姓名判断・西洋占星術の5つの占術を統合して、名前と生年月日からあなただけの鑑定を作ります。運営は株式会社Viwe Pointです。" },
  { q: "無料で占えますか?", a: "はい。「自分のこと」「恋愛・相性」「仕事」の診断と「今日の運勢」は無料でご利用いただけます。会員登録(無料)をすると読める範囲が広がり、有料プランではさらに深い鑑定と毎日の意思決定レポートの全文が読めます。" },
  { q: "どんな占術を使っていますか?", a: "算命学(本質・才能)、四柱推命(運気のタイミング)、九星気学(日々の巡り)、姓名判断(人間関係・相性)、西洋占星術(心理)の5占術です。個別に使うのではなく、全占術を統合した総合判断で助言を作ります。" },
  { q: "占い結果に根拠はありますか?", a: "あります。結果画面の「今日の星回り」欄で、天中殺・月破・九星の中宮・命式との相性など、その日の助言の占術上の根拠を明示しています。生年月日と暦の計算に基づくもので、毎日変わります。" },
  { q: "今日の運勢は毎日変わりますか?", a: "変わります。日柱の干支(60日周期)・九星の日盤(9日周期)・十二支の巡り(12日周期)という周期の異なる複数の暦を組み合わせて計算しているため、スコアも内容も毎日変化します。" },
  { q: "天中殺とは何ですか?", a: "算命学で、生まれ日から定まる「巡ってこない2つの十二支」の期間のことです。新しい開始事より、続けてきたことの手入れや見直しに向くタイミングとされます。当サービスでは今日が天中殺に当たるかを結果画面で明示します。" },
  { q: "トークションとは何ですか?", a: "錦糸町の少年と公式LINE電話で1時間直接話せる権利のオークションです。毎週月曜7時と金曜20時から24時間開催され、1,000円から100円刻みで入札できます。落札後はキャンセルできませんのでご注意ください。" },
  { q: "入力した個人情報はどう扱われますか?", a: "名前・生年月日は鑑定の生成にのみ使用します。第三者への販売は行いません。詳細はプライバシーポリシー(運営会社: 株式会社Viwe Point)をご確認ください。" },
  { q: "AIの占いは当たりますか?", a: "占いは統計と暦に基づく「見立て」であり、未来を保証するものではありません。当サービスは根拠(どの暦・どの巡りからそう読んだか)を開示し、最終的な判断はあなた自身ができるように設計しています。鑑定は助言の提供であり、結果や効果を保証するものではありません。" },
  { q: "解約はいつでもできますか?", a: "はい。有料プランはマイページからいつでも解約できます。解約後も期間終了までは有料機能をご利用いただけます。" },
];

export const metadata: Metadata = {
  title: "よくある質問",
  description: "錦糸町の少年のよくある質問。使っている占術、無料範囲、天中殺や月破などの占術用語、トークションの仕組み、個人情報の扱いについて説明します。",
};

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 pb-24 pt-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h1 className="font-display text-lg text-paper-50">よくある質問</h1>
      <p className="mt-1 text-xs text-paper-500">🎋 錦糸町の少年について、よく聞かれることをまとめました</p>
      <div className="mt-5 space-y-3">
        {FAQS.map((f) => (
          <details key={f.q} className="group rounded-card border border-ink-700 bg-ink-900/60 p-4">
            <summary className="cursor-pointer list-none text-sm font-bold text-paper-100">
              <span className="mr-2 text-gold-400">Q.</span>
              {f.q}
            </summary>
            <p className="mt-3 text-xs leading-relaxed text-paper-300">{f.a}</p>
          </details>
        ))}
      </div>
      <div className="mt-8 text-center">
        <Link href="/self" className="inline-block rounded-full bg-gold-500 px-8 py-3 text-sm font-bold text-ink-950">まずは無料で占ってみる</Link>
      </div>
    </main>
  );
}

export default function TokushohoPage() {
  return (
    <div className="flex flex-col gap-4 px-5 pt-4 pb-8 text-sm leading-relaxed text-paper-200">
      <h1 className="font-display text-lg text-paper-50">特定商取引法に基づく表記</h1>
      <dl className="space-y-2">
        <Row label="販売事業者" value="株式会社Viwe Point" />
        <Row label="所在地" value="東京都港区麻布十番3-2-12 シンシア麻布十番504" />
        <Row label="連絡先" value="お問い合わせは公式LINEにて承ります（電話番号はご請求いただいた場合、遅滞なく開示いたします）" />
        <Row label="販売価格" value="サブスク：初月500円/2ヶ月目以降980円、追加クレジット：300円/5回、面談チケット：1,000円〜(オークション形式)" />
        <Row label="返金について" value="デジタルコンテンツの性質上、購入後の返金は原則行いません。" />
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-paper-600">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}

export default function TokushohoPage() {
  return (
    <div className="flex flex-col gap-4 px-5 pt-4 pb-8 text-sm leading-relaxed text-paper-200">
      <h1 className="font-display text-lg text-paper-50">特定商取引法に基づく表記</h1>
      <p className="text-xs text-paper-600">
        ※ 販売事業者名・所在地・連絡先・返金ポリシー等、CEOが確定した会社情報を反映してください。
      </p>
      <dl className="space-y-2">
        <Row label="販売事業者" value="（未設定）" />
        <Row label="運営責任者" value="（未設定）" />
        <Row label="所在地" value="（未設定）" />
        <Row label="連絡先" value="（未設定）" />
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

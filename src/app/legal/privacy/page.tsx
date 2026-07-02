export default function PrivacyPolicyPage() {
  return (
    <div className="flex flex-col gap-4 px-5 pt-4 pb-8 text-sm leading-relaxed text-paper-200">
      <h1 className="font-display text-lg text-paper-50">プライバシーポリシー</h1>
      <p className="text-xs text-paper-600">
        ※ これはひな形です。公開前に法務レビューを受けてください
        (データレイヤー設計書⑥⑦の匿名化方針・PII取り扱いと整合させること)。
      </p>
      <p>
        当社は、氏名・生年月日・メールアドレス等の個人情報を、占いサービスの提供および
        品質向上の目的でのみ利用します。占い結果の生成に伴い匿名化・集計されたデータは、
        個人を特定できない形でサービス改善に利用することがあります。
      </p>
    </div>
  );
}

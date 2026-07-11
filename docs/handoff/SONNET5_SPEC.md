# Sonnet 5 実装指示書 — 錦糸町の少年 改善スプリント(2026-07-11設計)

作成: Principal Product Architect(Fable 5) / 実装担当: Sonnet 5
SSoT: `docs/BLUEPRINT.md`(本指示書の実装完了時に§10の更新内容を反映すること)
原則: 既存設計を壊さない・CEO決定との整合維持・不明点はこの文書内の判断基準に従う(追加質問不要)

---

# 1. 要件整理

| # | 要件 | 種別 | DB変更 | 優先度 |
|---|---|---|---|---|
| ② | 今日の運勢が更新されない(バグ) | 修正 | **あり** | P0 |
| ⑧ | 表示時にUI全体が一瞬拡大される | 修正 | なし | P0 |
| ⑨ | 生年月日入力UIの崩れ | 修正 | なし | P0 |
| ① | ログイン成功が分かるUX | 改善 | なし | P1 |
| ④ | ホーム広告枠を約2/3へ縮小 | 改善 | なし | P1 |
| ③ | トークション: 事前入札+土日9時開催 | 仕様変更 | なし(既存スキーマで可) | P1 |
| ⑤ | 「自分のこと」6セクション再設計 | 再設計 | なし | P2 |
| ⑥ | 恋愛・相性を同構成へ | 再設計 | なし | P2 |
| ⑦ | 仕事・キャリアを同構成へ | 再設計 | なし | P2 |
| ⑩ | 縁のある神社→記事一覧 | 新機能 | なし(MDファイルベース) | P2 |

---

# 2. 原因調査結果(②⑧⑨ — コードリーディングによる確定/推定)

## ②「今日の運勢が更新されない」— 原因3件を特定(確定)

**原因A【タイムゾーン・確定・最重要】** `src/app/api/report/today/route.ts` L66-70:
`const today = new Date()` はサーバー時刻(Vercel=UTC)。`reportDate`はそのUTC日付で作られるため、**JST 0:00〜8:59の間は「前日」のレポートが返り続ける**。日本のユーザーは朝9時まで日付が変わらない。「夜に見て、翌朝見ても変わらない」の主因。

**原因B【ユニークキー衝突・確定】** 期間タブ(today/week/month/nextMonth)は同一テーブル`daily_reports`の`@@unique([userId, reportDate])`に、期間の代表日(週=月曜/月=1日)をreportDateとして保存する設計。**月曜日はtodayとweekのreportDateが同一**になり、**毎月1日はtodayとmonthが同一**になる。先に生成された行が両タブで返され、「週タブを見ても今日と同じ」「更新されない」が発生する。キーに`period`が含まれていない設計欠陥。

**原因C【旧データ残存・一時的】** 生成済み行は当日中再生成されない(仕様)。スコアリングv3(2026-07-08)デプロイ以前に生成された行が残る日は旧内容が返る。AとBの修正後、自然解消する(恒久対応不要だが、検証時に混同しないこと)。

**参考(仕様・バグではない)**: クライアント`cacheRef`は同一セッション中タブ再切替で再取得しない。日付が変われば新規取得される。変更不要。

## ⑧「UI全体が一瞬拡大」— 原因を特定(高確度の推定)

`globals.css` L1でGoogle Fontsを`@import`+`display=swap`で読込。初回描画はフォールバック(ヒラギノ等)で行われ、**Shippori Mincho / Zen Kaku Gothic New到着時に字幅・行高メトリクスの差でレイアウト全体が広がる**(=「一瞬拡大」に見えるCLS)。特に`text-3xl`の見出しで顕著。`next/font`はオフラインCIでビルド失敗する経緯があり不採用(layout.tsx L7-13の経緯コメント参照)。

## ⑨「生年月日UIの崩れ」— 原因を特定(確定)

`<input type="date">`はOS/ブラウザごとに描画が全く異なる: iOS Safariは値が空のときプレースホルダーも高さも不安定、`appearance-none`(2026-07-08適用)はiOSで標準UIを消し「空欄に見える」副作用がある。**ネイティブdate inputに依存する限り統一UIは不可能**。

---

# 3. UX改善案

## ① ログイン成功のフィードバック
- **Toast方式を採用**(フェード遷移は実装コストと既存ルーティングへの影響が大きい割に伝達力が弱い)。
- ログイン/登録成功 → 遷移先ページ右上に「🎋 おかえりなさい、◯◯さん」トーストを2.5秒表示してフェードアウト。
- 実装: 汎用`Toast`コンポーネント新設+`sessionStorage`キー`itomachi_toast`にメッセージを積み、遷移先の共通レイアウトで消費表示(ページ間で確実に届く方式。URLパラメータは共有時に混入するため不採用)。
- あわせてHeaderの人型アイコンをログイン中はアバター/イニシャル表示にし、状態が常時分かるようにする(auth/meは既にavatar/displayNameを返す)。

## ② 今日の運勢
- **JST基準の日付ユーティリティ`jstToday()`を新設**し、全期間キーをJSTで算出。
- **`daily_reports`に`period`列を追加**し、ユニークを`(userId, reportDate, period)`へ変更(手動SQL)。
- 応答に`reportDate`は既に含まれるので、UI右上に「◯月◯日の運勢」を明示し「更新されていない」不安を解消。

## ③ トークション
- 開催前=**事前入札(指値)期間**とし、入札UIをロックせず「事前入札」ラベルで開放。ルール(1,000円起点・100円刻み・+100円最低)は開催中と完全同一。現在価格・入札数・最高入札額(=現在価格)を開催前から表示。
- 開催日時: **毎週土曜9:00と日曜9:00(JST)開始・各24時間**(実質週末48時間連続)。
- カウントダウンは維持し「開催まで(事前入札受付中)」へ文言変更。

## ④ 広告枠
- `AffSlot`(ui-common.tsx L132)を `min-h-[100px] my-10` → **`min-h-[66px] my-6`**(約2/3)。全ページ共通コンポーネントのため1箇所の変更で全画面に反映。
- SDK調査結果: 現状は枠のみでSDK未導入。導入候補のGoogle AdSense/GAMはレスポンシブ広告(`data-ad-format="auto"` / fluid)を公式サポートし、**枠側をレスポンシブにすれば広告側も追従可能**。導入時は`AffSlot`に`ins.adsbygoogle`を差し込むだけで済むよう、propsに`slot?: string`を予約しておく。

## ⑤⑥⑦ 診断3ページの共通再設計 — 「読むページ」から「一瞬で分かるページ」へ
共通6セクション構成(詳細は§4指示書F参照)。**guest/member/paidの3段階ゲートは現行仕様を踏襲**(非登録: S1-S3+S4以降ロック / 登録: S1-S5 / 有料: 全部+深掘り)。

## ⑨ 生年月日
- ネイティブdate inputを廃止し、**年/月/日の3セレクト共通コンポーネント`BirthDateSelect`を新設**(全OSで同一描画・確実に崩れない)。self/work/report/love(必要箇所)/signupで共用。

## ⑩ 記事一覧
- `/shrines`(縁のある神社)は`/articles?category=shrine`へ**301リダイレクト**で温存(SEO資産・被リンク保護)。既存の神社詳細は記事へ移管。
- カテゴリ(マーケ03章のキーワード調査に基づく優先度順): **仕事・適職(ブルーオーシャン/S)・恋愛・相性(S)・神社・参拝(S/CEO一次情報)・開運・運気(A)・四柱推命(A/EEAT)・算命学(A)・九星気学(B)・金運(B)・人間関係(B)**。

---

# 4. Sonnet 5への実装指示書(Phase別・このまま実装可能な粒度)

## Phase 1(P0修正)

### 指示A: 今日の運勢の日付・キー修正【要件②】

1. **`src/lib/jst.ts`新設**:
```ts
/** JST(UTC+9)基準の「今日」を、UTC 0時のDateとして返す。daily_reportsのキー用 */
export function jstToday(now: Date = new Date()): Date {
  const jst = new Date(now.getTime() + 9 * 3600_000);
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()));
}
```
2. `src/app/api/report/today/route.ts`: `const today = new Date()`以降の`reportDate`算出を`jstToday()`起点に変更(week=JST週初の月曜/month=JST月初/nextMonth=JST翌月初。既存の算術はgetUTC系のまま流用可能 — jstToday()がUTC正規化済みのため)。`generateDailyReport`へ渡す`date`も同値。
3. **DB変更(手動SQL・`prisma/manual_report_period.sql`新設)**:
```sql
-- 期間タブのユニークキー衝突修正(2026-07-11 要件②原因B)
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS period TEXT NOT NULL DEFAULT 'today';
ALTER TABLE daily_reports DROP CONSTRAINT IF EXISTS daily_reports_user_id_report_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS daily_reports_user_period_key ON daily_reports (user_id, report_date, period);
```
4. `schema.prisma`の`DailyReport`: `period String @default("today")`追加、`@@unique([userId, reportDate])`→`@@unique([userId, reportDate, period])`へ変更し`prisma generate`。routeのfindUnique/create/upsert箇所を複合キー`userId_reportDate_period`へ書き換え(3箇所: existing取得/新規create/raced取得)。
5. `ReportPageClient.tsx`: 結果ヘッダー付近に`{report.reportDate}`をJST表記(「◯月◯日の運勢」)で表示。
6. **検証**: `TZ=UTC`で`jstToday`の単体確認(UTC 2026-07-11T20:00 → JST 7/12を返すこと)。月曜・月初相当のperiod組合せでキー衝突しないことをローカルAPIで確認。

### 指示B: フォントによる初期拡大の解消【要件⑧】

1. `globals.css`: `@import`のURLに`&display=optional`は使わない(swapのまま)。代わりに**メトリクス調整済みフォールバックを定義**:
```css
@font-face {
  font-family: "Shippori Fallback";
  src: local("Hiragino Mincho ProN"), local("Yu Mincho");
  size-adjust: 106%; ascent-override: 88%; descent-override: 24%; line-gap-override: 0%;
}
@font-face {
  font-family: "Zen Kaku Fallback";
  src: local("Hiragino Kaku Gothic ProN"), local("Yu Gothic");
  size-adjust: 102%;
}
```
2. `:root`の`--font-shippori`/`--font-zenkaku`のフォールバック先頭に上記Fallbackファミリーを挿入。
3. `layout.tsx`の`<head>`に`<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />`と`fonts.googleapis.com`のpreconnectを追加(到着を早めて切替時間自体を短縮)。
4. **検証**: DevToolsのNetworkでフォントをSlow 3Gにし、切替時に見出しの行折返しが変わらない(CLSが目視でほぼゼロ)こと。オフラインビルドが壊れないこと(`npm run build`)。size-adjust値は上記を初期値とし、目視で1回だけ微調整可(±4%以内)。

### 指示C: BirthDateSelect共通コンポーネント【要件⑨】

1. `src/components/BirthDateSelect.tsx`新設(client)。props: `{ value: string; onChange: (v: string) => void; minYear?: number }`。value形式は既存互換の`YYYY-MM-DD`(未確定時は`""`)。
   - 年(今年→minYear=1940降順)/月(1-12)/日(選択中の年月の実日数で動的生成)の3つの`<select>`を`grid grid-cols-3 gap-2`で横並び。
   - 各selectのクラス: `h-12 w-full rounded-xl border border-ink-700 bg-ink-950 px-3 text-sm text-paper-100 outline-none focus:border-gold-500`(既存トーン踏襲)。
   - 3つ揃った時のみonChangeで`YYYY-MM-DD`を発火。月/年変更で日が実日数を超える場合は日をリセット。
2. 置換箇所(4ファイル): `self/SelfPageClient.tsx`・`work/WorkPageClient.tsx`・`report/ReportPageClient.tsx`(入力ステップ)・`auth/signup/page.tsx`の`<input type="date">`をすべて`<BirthDateSelect />`へ。既存のstate(`birthDate: string`)はそのまま使える。
3. **検証**: 4画面で選択→送信→結果が出ること。うるう年(2000-02-29)が選べること。

## Phase 2(P1改善)

### 指示D: ログイン成功Toast+Header状態表示【要件①】

1. `src/components/Toast.tsx`新設(client): マウント時に`sessionStorage.getItem("itomachi_toast")`を読み、あれば右上fixed(`top-16 right-4 z-50`)にカード表示(`bg-ink-900/90 border border-gold-500/40 backdrop-blur`)→2.5秒後フェードアウト(opacity transition 300ms)→キー削除。`aria-live="polite"`必須。
2. `layout.tsx`の`<main>`直前に`<Toast />`を配置(全ページ共通)。
3. `auth/login/page.tsx`・`auth/signup/page.tsx`: 成功時`router.push`の直前に`sessionStorage.setItem("itomachi_toast", "🎋 おかえりなさい" or "🎋 ようこそ、錦糸町へ")`。displayNameが応答にあれば「◯◯さん」を付ける。
4. `Header.tsx`: `/api/auth/me`をクライアントで1回fetchし、ログイン中はavatar(あれば画像/なければdisplayName先頭1文字の丸バッジ)を人型アイコンの代わりに表示。リンク先は`/mypage`へ。
5. **検証**: ログイン→ホームでトースト表示→自然消滅。未ログインでは何も出ない。

### 指示E: 広告枠縮小【要件④】+ トークション仕様変更【要件③】

**E-1 広告**: `ui-common.tsx`の`AffSlot`を`my-6 min-h-[66px]`へ変更(1箇所で全ページ反映)。props に`slot?: string`を追加だけしておく(未使用でOK・SDK導入時の予約)。

**E-2 トークション** (対象: `src/lib/talkauction.ts`・`api/billing/auction/bid/route.ts`・`app/auction/page.tsx`):
1. `nextScheduleWindows()`のスケジュール定義を**土曜9:00 JST開始・24時間**と**日曜9:00 JST開始・24時間**の2窓へ変更(現行の月7:00/金20:00定義を置換。JST算出は既存実装の方式を踏襲)。ファイル冒頭コメントと`auction/page.tsx`内の開催案内文言(「毎週 月曜7:00〜 と 金曜20:00〜」等)、`docs/design/08_talkauction/talkauction_spec.md`の該当記述、FAQの該当回答も同時に更新。
2. bid API: `if (ticket.status !== "open")`型の開催中チェックを`!["open", "scheduled"].includes(ticket.status)`に緩和(**scheduled中の入札=事前入札を許可**)。closesAt超過チェックは維持。それ以外のルール(100円刻み・最低額・同意2チェック・楽観ロック)は一切変更しない。auditLogのmetadataに`phase: ticket.status`を追加。
3. `auction/page.tsx`: preOpen時のロックボタンを**入札ボタン(有効)**に差し替え、ラベル「事前入札する(開始前から価格に反映されます)」。価格欄はpreOpenでも`現在価格`表示(事前入札があれば動く。0件時は開始価格)。`🔥現在◯件の入札`もpreOpenで表示(status APIは既にbidCountを返す)。「最高入札額」=現在価格として`最高入札額 ◯円`を価格欄サブテキストで明示。開催前ポーリング: 一覧30秒に加えstatusポーリング(5秒)をscheduledチケットにも回す(現行はopenのみ→条件を緩和)。
4. **検証**: scheduledチケットに入札→currentPrice反映→開催時刻到達→openへ自動遷移後も価格・履歴が連続していること。100円刻み違反が引き続き409になること。

## Phase 3(P2再設計)

### 指示F: 診断3ページの6セクション共通再設計【要件⑤⑥⑦】

**共通コンポーネント**(`src/components/reading/`配下に新設):
- `ScoreHero.tsx`: S1用。ScoreOrb+1センテンス概要+「注意点」「Next Action」の2チップ(アクセント: 注意=torii-500系/行動=gold系)。props: `{ score, summary, caution, nextAction }`
- `ParamBars.tsx`: S2用。5項目の横棒(ラベル+0-100バー、gold gradient)。props: `{ items: {label, value}[] }`
- `CategoryCards.tsx`: S3用。カテゴリ別カード(絵文字+タイトル+2行テキスト)のグリッド。
- `MonthlyBarChart.tsx`: S4用。30日分の縦棒グラフ(SVG手描き・ライブラリ追加禁止)。`future: boolean`な棒は`blur-[6px] opacity-60`+上に「もっと占う」CTAオーバーレイ。
- `MosaicTeaser.tsx`: S5用。最初2行表示+残りGlassMosaic(既存コンポーネント流用)。
- `PremiumPreview.tsx`: S6用。横スクロール(`overflow-x-auto snap-x`)のデモカード3枚(有料で見られる項目の見本・ダミーテキスト固定でよい)。

**API拡張**(3エンドポイント共通の追加フィールド。既存フィールドは削除しない=後方互換):
- `/api/self/reading`: 追加`{ scoreOverall: number(=wave), params: {label,value}[5](姓名判断の五格を0-100正規化: 天格/人格/地格/外格/総格), categories: {key,title,lines[2]}[6](総合/恋愛/仕事/金運/健康/人間関係 — 既存sectionsの各項目から先頭2文を抽出), monthly: {date,score,future}[30](calculateDailyScoreをJST今日±15日で算出。future=日付>今日), destiny: {title,body}(sanmei star.core+career), premiumItems: string[] }`
- love/workも同型(loveは相性スコア・2名の五格比較をparamsに、workはsanmei適職をcategoriesに割当)。
- **ゲート**: guest=S1-S3のみ(S4以降のデータはサーバーで送らない+`memberLocked:true`)/member=S1-S5/paid=+S6実データ。自分のことの既存3段階実装のパターンを踏襲。
- monthlyの30日計算はリクエスト毎に約30回のcalculateDailyScore(純計算・DB不要)。パフォーマンス問題なし(実測1回<1ms)。

**ページ構成(3ページ共通・上から)**: S1 ScoreHero → S2 ParamBars → S3 CategoryCards → (guestはここでGlassMosaic→signup) → S4 MonthlyBarChart(未来モザイク+もっと占う→/plans) → S5 MosaicTeaser(宿命/人生テーマ/未来) → S6 PremiumPreview → AffSlot。**占術根拠(grounding)ブロックはS1直下に維持**(要件6の資産・削除禁止)。既存の10セクション詳細文はS3カードのタップで開く`<details>`に格納(情報は捨てない・初期表示を軽くする)。

**⑥恋愛の最適化(マーケ04章/GPT6準拠)**: S1の概要は「ふたりの関係を一言で」(シェアされやすい断定短文=SNS導線)。S3カテゴリ=相性総合/相手の本音/進展タイミング/すれ違い注意/連絡の取り方/長期相性。シェア文言は「【相性短冊】◯◯と◯◯、縁の強さ◯点」。
**⑦仕事の最適化(マーケ03章Dブルーオーシャン準拠)**: S3カテゴリ=適職/転機/年収の流れ/人間関係/転職タイミング/伸ばすスキル。SEOタイトルを「適職診断 生年月日 無料」系キーワードへ寄せる(metadata更新)。

### 指示G: 記事一覧【要件⑩】

1. **コンテンツ基盤**: `content/articles/*.md`(front matter: `title/slug/category/description/date/image/related[]`)。ビルド時読込ユーティリティ`src/lib/articles.ts`(fs+gray-matterは追加依存になるため、**front matterは自前パース**(`---`区切りをsplitする20行程度の関数)で実装。依存追加禁止)。
2. ルート: `/articles`(一覧+カテゴリタブ)・`/articles/[slug]`(詳細)。カテゴリは§3⑩の9種を`src/lib/article-categories.ts`に定数化。
3. **記事テンプレート**(詳細ページの描画順): ヒーロー画像(なければ天の川背景のグラデカード)→タイトル(h1)→メタ(カテゴリ/日付)→**目次(h2見出しから自動生成・ページ内リンク)**→本文(mdは見出し/段落/リスト/太字のみの軽量レンダラを自前実装。HTMLエスケープ必須)→**CTA(カテゴリ連動**: 恋愛→/love、仕事→/work、他→/self)→関連記事3件(front matterのrelated優先、不足分は同カテゴリ新着)。`Article` JSON-LD埋め込み。
4. ナビ: Header L22の`{ href: "/shrines", label: "縁のある神社" }`を`{ href: "/articles", label: "記事一覧", note: "開運コラム・占術解説" }`へ差替。`next.config.mjs`に`/shrines`→`/articles?category=shrine`、`/shrines/:id`→`/articles`の**301 redirects**を追加。sitemapへ/articlesと各記事を追加。既存`/shrines`配下ページとその専用コード(`shrines/page.tsx`等)は削除し、掲載済み神社情報は`content/articles/shrine-*.md`へ2本だけ移植(残りはコンテンツ制作フェーズ)。
5. 初期記事: マーケ10章のS優先度に従い**「四柱推命とは(diagnosis)」「正しい参拝方法(shrine)」「適職診断とキャリア(work)」の3本の骨子**(見出し構成+各200字程度)を作成しplaceholderフラグを付ける(本文の完成はコンテンツ制作フェーズ。※SEO品質のため薄い記事を量産しないこと)。

---

# 5. BLUEPRINT更新内容(実装完了時に`docs/BLUEPRINT.md`末尾へ追記する文面)

- 今日の運勢: 日付キーをJST基準(`lib/jst.ts`)へ修正。`daily_reports`に`period`列を追加しユニークを(userId, reportDate, period)へ変更(манual_report_period.sql)。
- トークション: 開催を**毎週土曜・日曜 9:00 JST開始/各24時間**へ変更(旧: 月7:00/金20:00)。開催前は**事前入札(指値)期間**とし、入札ルールは開催中と同一、現在価格・入札数・最高入札額を開催前から表示。
- 認証UX: ログイン/登録成功時にToast表示(`itomachi_toast`)。Headerにログイン状態(アバター)表示。
- フォント: メトリクス調整済みローカルフォールバック(@font-face size-adjust)でロード時のレイアウト拡大を解消。
- 入力: 生年月日は共通`BirthDateSelect`(年月日3セレクト)へ統一。ネイティブdate input廃止。
- 診断3ページ: 6セクション共通構成(ScoreHero/ParamBars/CategoryCards/MonthlyBarChart/MosaicTeaser/PremiumPreview)。3段階ゲート踏襲。詳細文はS3内details格納。
- 記事: `/shrines`廃止(301→/articles)。`content/articles/*.md`ベースの記事基盤+9カテゴリ+テンプレート(画像/目次/本文/CTA/関連記事/Article JSON-LD)。
- 広告: AffSlotを2/3サイズへ(min-h 66px)。レスポンシブ広告SDK(AdSense auto)対応可能な構造を確認済み。

# 6. 影響範囲

| 領域 | 内容 |
|---|---|
| DB | `daily_reports`のみ(period列+ユニーク差替)。**本番適用SQL必須**。他テーブル変更なし |
| API | report/today(キー変更)・self/love/work reading(フィールド追加・後方互換)・auction bid(scheduled許可) |
| ルーティング | 新設: /articles, /articles/[slug]。廃止: /shrines(301)。他は不変 |
| 共通UI | AffSlot(全ページ)・Header(ナビ+ログイン表示)・フォント(全ページ)・Toast(全ページ)・BirthDateSelect(4画面) |
| 既存資産の保護 | 占術根拠ブロック/3段階ゲート/100円刻み入札/ストリーク/FAQ/llms.txtは変更禁止(削除しないこと) |

# 7. リスク

1. **daily_reportsのユニーク差替**は本番で旧制約DROP→新INDEX作成の順が前後すると重複行who書き込みに失敗する可能性 → SQLの順序厳守+適用はメンテ時間帯(深夜)推奨。ロールバック: 新INDEX DROP+旧制約再作成。
2. 事前入札の解禁で「開催前に高額確定」への心理的抵抗が出る可能性 → UI文言で「開始前でもキャンセル不可」を入札モーダルに明記(既存の同意チェックはそのまま効く)。
3. フォントsize-adjustはOS別に最適値が微妙に異なる → 完全ゼロではなく「目視で気にならない」を合格基準とする。
4. /shrines廃止によるSEO低下 → 301+記事移植で回避。Search Consoleの監視をCEOに依頼。
5. 診断ページ再設計は情報の「見え方」が大きく変わる → 既存10セクションの本文はdetails内に全量残し、情報削除ゼロで実施(不評時の戻しが容易)。

# 8. 実装順序(依存関係順)

1. Phase1-A(②JST/period) → 2. Phase1-B(⑧フォント) → 3. Phase1-C(⑨BirthDateSelect) → 4. Phase2-D(①Toast) → 5. Phase2-E(④広告/③トークション) → 6. Phase3-F(⑤自分のこと→⑥恋愛→⑦仕事の順。共通コンポーネントは⑤で作り⑥⑦は流用) → 7. Phase3-G(⑩記事)
各Phase完了ごとに: tsc / next lint / build / next start実機スモーク(該当API叩き)+コミット。Phase1完了時点で一度push(バグ修正を先に本番へ)。

# 9. 工数見積り(Sonnet 5実装・検証込み)

| Phase | 内容 | 見積 |
|---|---|---|
| 1-A | JST/periodキー修正+SQL | 0.5日 |
| 1-B | フォントCLS対策 | 0.25日 |
| 1-C | BirthDateSelect+4画面置換 | 0.5日 |
| 2-D | Toast+Header状態 | 0.5日 |
| 2-E | 広告縮小+トークション事前入札/土日開催 | 0.75日 |
| 3-F | 診断3ページ再設計(共通6コンポーネント+API拡張+3ページ) | 2.5日 |
| 3-G | 記事基盤+テンプレート+301+初期3本骨子 | 1.0日 |
| — | 総合検証・BLUEPRINT反映・報告 | 0.5日 |
| **計** | | **6.5日相当** |

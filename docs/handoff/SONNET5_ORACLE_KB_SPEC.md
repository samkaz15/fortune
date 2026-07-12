# Sonnet 5 実装指示書 — 師匠知見ベース(Oracle KB)運用・拡張

作成: Principal Product Architect(Fable 5) / 実装担当: Sonnet 5 / 作成日: 2026-07-12
SSoT: `docs/oracle_knowledge_guide.md`(CEO向け)+ 本書(実装者向け)
原則: 既存設計を壊さない・CEOの言葉への忠実性を最優先・不明点は本書§8の判断基準に従う(追加質問不要)

---

# 1. 背景(30秒で把握する)

Oracle KB =「錦糸町の少年」側の記憶。人生カルテ(ユーザー側の記憶)と対を成す。
CEO(寒川さん)の実鑑定ノウハウ(例: 財布ブランド×運気)を`knowledge/oracle/*.json`に構造化蓄積し、
チャットパイプラインが発言に関連する知見をタグ検索で想起→system promptに「少年の独自見解」として注入する。
**CEOが知見を出すほどAIの回答が独自化する**のが本システムの価値。君の仕事はその蓄積を正確・安全に回すこと。

## 実装済みコンポーネント(触る前に必ず読む)

| パス | 役割 |
|---|---|
| `knowledge/oracle/wallets.json` | 知見データ第1号(財布6ブランド)。**フォーマットの正** |
| `src/lib/oracle/knowledge-base.ts` | ローダ+タグ検索+prompt整形。破損JSONはスキップする設計 |
| `src/lib/karte/keywords.ts` | 検索キーワード抽出(純粋関数・共用) |
| `src/lib/chat/pipeline.ts` | 注入箇所(`searchOracleKnowledge`→`formatOracleForPrompt`) |
| `src/lib/fortune-engine/__tests__/golden.test.ts` | Oracle KBテスト(test 20) |
| `docs/oracle_knowledge_guide.md` | CEO向け更新ガイド(仕様変更時は必ず同期更新) |

---

# 2. 作業タイプ(依頼はこの5型のどれかに正規化して着手する)

## T1: 知見の追加(最頻・CEOの自然文→JSON)
CEOから「ロエベは人脈」「〇〇は△△」のような自然文が来る。
1. 既存テーマ(topic)に属するか判定 → 属するなら該当ファイルのentriesへ追加
2. `id`は`{テーマ英語}-{対象ローマ字}`(例: `wallet-loewe`)。既存と衝突不可
3. `tags`設計は§4準拠。`insight`は§5の忠実性ルール準拠
4. ファイルの`updatedAt`を当日に、`version`を+1

## T2: 新テーマファイルの作成
既存topicに属さない知見(例: 腕時計、オフィスの方角、色)は新ファイル。
1. ファイル名は英小文字複数形(`watches.json`, `office-directions.json`)
2. `wallets.json`の構造を完全踏襲(topic/version/updatedAt/source/commonPrinciple/expressionGuideline/entries)
3. `commonPrinciple`と`expressionGuideline`はCEOの発言から抽出。無ければ`expressionGuideline`に
   最低限「占術的見解でありブランド・商品の品質評価ではないことを踏まえて語る」を入れる
4. golden.test.tsに新テーマの想起テストを1本追加(§6のDoD)

## T3: 既存知見の更新
「エルメスの見解が深まった」等。entriesの該当`insight`を**上書き**(履歴はgitが持つ)。
新旧併記はしない。`updatedAt`/`version`更新。

## T4: タグ拡充(想起漏れの修正)
「チャットで〇〇と聞いたのに知見が出なかった」という報告への対処。
1. `extractKeywords(報告された質問文)`の出力を確認(tsxワンライナーで可)
2. 出力キーワードと既存tagsの不一致を特定し、tagsに**ユーザーが実際に使った語**を追加
3. 検索ロジック(knowledge-base.ts)側の変更は原則行わない(§7参照)

## T5: 表面の拡張(明示指示があった場合のみ)
decision-report・free-readingへのOracle注入等。chat/pipeline.tsの注入パターンを踏襲し、
system promptの肥大に注意(注入は関連ヒット時のみ・上位3件まで、が既定)。

---

# 3. 作業手順(全タイプ共通)

```
1. git pull(mainを最新化)
2. 変更実施
3. npm test                     … golden全通過(既存19+追加分)。Oracle関連はtest 20以降
4. npx tsc --noEmit             … 新規エラーゼロ(@/generated/prisma由来の既存エラーは無視してよい)
5. node -e "JSON.parse(require('fs').readFileSync('knowledge/oracle/<対象>.json','utf8'))" … JSON妥当性
6. commit: "feat(oracle): <テーマ> — <要約>" / 更新は "chore(oracle): ..."
7. push(認証はCEOから都度受領。トークンをファイル・設定に保存しない)
```

---

# 4. タグ設計原則(検索品質の生命線)

- **ユーザーの語彙で書く**。正式名称と俗称を両方入れる(例: `ルイヴィトン`と`ヴィトン`)
- テーマ語(`財布`)+対象語(ブランド名)+効能語(`金運` `人脈` `恋愛運`)の3層を必ず含める
- 表記ゆれ: カタカナ表記を主とし、よくある誤記も許容として追加してよい
  (実例: CEOは「エルベス」と書いたことがある→`エルメス`と`エルベス`を両方tagsに入れる)
- 1entryのtagsは4〜8個。10個超は検索ノイズになるため分割を検討
- extractKeywordsは助詞分割方式のため、**タグは助詞を含まない名詞形**にする(「財布の金運」×→「財布」「金運」○)

# 5. 忠実性ルール(最重要)

1. **insightの内容はCEOの発言のみを源泉とする。占術的解釈の創作・一般論による水増しは禁止**
2. CEOの言い回しの特徴的な部分(「労働集約モデル内でのアップ」「一発の獲得単価」等)は
   言い換えずに保持する。これが独自性の正体
3. 文章として整える際に足してよいのは接続語と主語の明確化のみ。**意味の追加は不可**
4. CEOの発言が曖昧な場合(例: ベルルッティの「各色で効果が違う」の色別詳細が未提供)は、
   **不明部分を埋めずに**「色ごとの見立ては個別鑑定で確認」のように未確定と明示する

# 6. 完了条件(DoD)

- [ ] `npm test`全通過(新テーマはT2-4のテスト追加込み)
- [ ] JSON構文チェック通過
- [ ] tags§4準拠 / insight§5準拠
- [ ] `updatedAt`/`version`更新済み
- [ ] 新テーマの場合: `docs/oracle_knowledge_guide.md`のファイル一覧に追記
- [ ] 動作確認: `npx tsx -e`で`searchOracleKnowledge("<想定質問文>")`がヒットすることを確認しcommitメッセージに質問文を記載

# 7. 禁止事項

- Layer0/Layer1プロンプト(`prompts/consulting/`, `prompts/chat/system_prompt.*`)の変更(別権限)
- `knowledge-base.ts`の検索アルゴリズム変更(タグで解決できない想起漏れが3件溜まったらFable5へ報告)
- ガードレール領域の知見登録: 医療・疾病、法的リスク、投資の個別銘柄への断定はentries化しない
  (CEOから来ても、その部分は除外して登録し、除外した旨をcommitメッセージに記す — Layer0 §5が上位)
- 実在ブランドを**貶める**表現の登録(「〇〇は運気が下がる」型)。効果の方向性の違い(恋愛運は遠のく等)は可
- 「動物占い」等の登録商標のタグ・本文への使用

# 8. 判断基準(迷ったらこれ)

| 状況 | 既定の判断 |
|---|---|
| 既存テーマか新テーマか曖昧 | entriesが3件未満で済むなら既存へ、独立した世界観なら新テーマ |
| CEOの発言が2つの知見を含む | entriesを2つに分ける(1entry=1見解) |
| 同じ対象への矛盾する新見解 | 新しい方で上書き(T3)。旧見解は残さない |
| タグを増やすか検索ロジックを直すか | 常にタグ(§7) |
| ヒット件数の上限 | searchOracleKnowledgeの既定limit=3を変えない |

# 9. 変換例(正)

**CEO入力**: 「シャネルは高貴と1段階上のランクへ上がる。そして金運の最大化が起こる」

**出力entry**:
```json
{
  "id": "wallet-chanel",
  "brand": "シャネル",
  "tags": ["財布", "シャネル", "金運", "格", "ランクアップ", "高貴"],
  "insight": "高貴さをまとい、1段階上のランクへ上がる財布。付き合う人の層・扱う金額の桁が一つ上がるイメージ。そして金運の最大化が起こる。『今の自分より少し上の世界』へ引き上げられたい局面で持つと効く。"
}
```
※「付き合う人の層…」の補足文はCEOの「1段階上のランク」の具体化であり意味の追加ではない範囲。
　これ以上の膨らませ(例: 具体的な色・シリーズへの言及)は§5違反。

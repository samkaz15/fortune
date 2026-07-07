# 10. Backlog — 施策一覧(GitHub Issue化済み)

作成日: 2026-07-07 / 総施策数: 105件 / **全件GitHub Issue化完了**(Issue #3〜#107)

リポジトリ https://github.com/samkaz15/fortune の Issues タブから全件確認可能。ラベルは`enhancement`を使用(fine-grained PATの権限制約によりカスタムラベルは作成不可のため、優先度・チャネル・工数・依存関係はIssue本文に明記する方式を採用)。

---

## 優先度別サマリ

| 優先度 | 件数 |
|---|---|
| S | 29 |
| A | 38 |
| B | 34 |
| C | 4 |

## チャネル別サマリ

| チャネル | 件数 |
|---|---|
| SNS | 49 |
| SEO | 17 |
| Infra | 15 |
| Referral | 8 |
| Influencer | 5 |
| Content | 5 |
| LINE | 3 |
| Roadmap | 3 |

---

## 全施策一覧(Issue番号付き)

| ID | Issue# | タイトル | 優先度 | チャネル | 工数 | 依存関係 |
|---|---|---|---|---|---|---|
| Marketing-001 | [#3](https://github.com/samkaz15/fortune/issues/3) | TikTok公式アカウント開設 | S | SNS | 0.5日 | - |
| Marketing-002 | [#4](https://github.com/samkaz15/fortune/issues/4) | Instagram公式アカウント開設 | S | SNS | 0.5日 | - |
| Marketing-003 | [#5](https://github.com/samkaz15/fortune/issues/5) | X公式アカウント開設 | S | SNS | 0.5日 | - |
| Marketing-004 | [#6](https://github.com/samkaz15/fortune/issues/6) | YouTube公式チャンネル開設 | A | SNS | 0.5日 | - |
| Marketing-005 | [#7](https://github.com/samkaz15/fortune/issues/7) | Threads公式アカウント開設 | B | SNS | 0.3日 | Marketing-003 |
| Marketing-006 | [#8](https://github.com/samkaz15/fortune/issues/8) | Pinterest公式アカウント開設 | B | SNS | 0.3日 | - |
| Marketing-007 | [#9](https://github.com/samkaz15/fortune/issues/9) | SNS共通プロフィール文・世界観ガイドライン策定 | S | SNS | 1日 | - |
| Marketing-008 | [#10](https://github.com/samkaz15/fortune/issues/10) | OGP画像自動生成機能の実装 | S | Infra | 3日 | - |
| Marketing-009 | [#11](https://github.com/samkaz15/fortune/issues/11) | シェア専用コピー自動生成機能 | S | Infra | 2日 | Marketing-008 |
| Marketing-010 | [#12](https://github.com/samkaz15/fortune/issues/12) | シェアボタンの露出強化(全診断結果画面に統一配置) | A | Infra | 1日 | Marketing-009 |
| Marketing-011 | [#13](https://github.com/samkaz15/fortune/issues/13) | 紹介制度の再設計・要件定義 | S | Referral | 1日 | - |
| Marketing-012 | [#14](https://github.com/samkaz15/fortune/issues/14) | 紹介制度のUI実装 | S | Referral | 3日 | Marketing-011 |
| Marketing-013 | [#15](https://github.com/samkaz15/fortune/issues/15) | 紹介制度のAPI実装 | S | Referral | 2日 | Marketing-011 |
| Marketing-014 | [#16](https://github.com/samkaz15/fortune/issues/16) | 連続利用ストリーク表示の実装 | A | Referral | 2日 | - |
| Marketing-015 | [#17](https://github.com/samkaz15/fortune/issues/17) | 実績バッジ機能の実装 | B | Referral | 3日 | Marketing-014 |
| Marketing-016 | [#18](https://github.com/samkaz15/fortune/issues/18) | 診断コラム記事(四柱推命とは)執筆 | S | SEO | 1日 | - |
| Marketing-017 | [#19](https://github.com/samkaz15/fortune/issues/19) | 診断コラム記事(相性診断の仕組み)執筆 | S | SEO | 1日 | - |
| Marketing-018 | [#20](https://github.com/samkaz15/fortune/issues/20) | 診断コラム記事(適職診断とキャリア)執筆 | S | SEO | 1日 | - |
| Marketing-019 | [#21](https://github.com/samkaz15/fortune/issues/21) | 開運コラム記事(ラッキーカラー2026)執筆 | A | SEO | 0.5日 | - |
| Marketing-020 | [#22](https://github.com/samkaz15/fortune/issues/22) | 開運コラム記事(運気アップの方法)執筆 | A | SEO | 0.5日 | - |
| Marketing-021 | [#23](https://github.com/samkaz15/fortune/issues/23) | 開運コラム記事(開運神社の選び方)執筆 | A | SEO | 0.5日 | - |
| Marketing-022 | [#24](https://github.com/samkaz15/fortune/issues/24) | 開運コラム記事(風水 間取り基本)執筆 | B | SEO | 0.5日 | - |
| Marketing-023 | [#25](https://github.com/samkaz15/fortune/issues/25) | 神社レビュー記事第1弾 | S | SEO | 1日 | CEO一次情報 |
| Marketing-024 | [#26](https://github.com/samkaz15/fortune/issues/26) | 神社レビュー記事第2〜5弾 | A | SEO | 3日 | Marketing-023 |
| Marketing-025 | [#27](https://github.com/samkaz15/fortune/issues/27) | 参詣作法コラム(正しい参拝方法)執筆 | S | SEO | 1日 | - |
| Marketing-026 | [#28](https://github.com/samkaz15/fortune/issues/28) | お守りの選び方コラム執筆 | A | SEO | 0.5日 | - |
| Marketing-027 | [#29](https://github.com/samkaz15/fortune/issues/29) | FAQページの作成 | A | SEO | 1日 | - |
| Marketing-028 | [#30](https://github.com/samkaz15/fortune/issues/30) | ピラーページ「占いで人生の決断を後悔しないための完全ガイド」作成 | S | SEO | 2日 | Marketing-016,017,018 |
| Marketing-029 | [#31](https://github.com/samkaz15/fortune/issues/31) | 構造化データ(Article)実装 | A | Infra | 1日 | - |
| Marketing-030 | [#32](https://github.com/samkaz15/fortune/issues/32) | 構造化データ(Quiz/WebApplication)実装 | B | Infra | 1日 | - |
| Marketing-031 | [#33](https://github.com/samkaz15/fortune/issues/33) | 構造化データ(LocalBusiness)実装 | B | Infra | 1日 | - |
| Marketing-032 | [#34](https://github.com/samkaz15/fortune/issues/34) | sitemap.xml整備・Search Console登録 | S | SEO | 0.5日 | - |
| Marketing-033 | [#35](https://github.com/samkaz15/fortune/issues/35) | TikTok投稿(今日の運勢シリーズ)制作フロー確立 | S | SNS | 継続 | Marketing-001 |
| Marketing-034 | [#36](https://github.com/samkaz15/fortune/issues/36) | TikTok投稿(恋愛運が上がる仕草3選)制作 | A | SNS | 0.5日 | Marketing-001 |
| Marketing-035 | [#37](https://github.com/samkaz15/fortune/issues/37) | TikTok投稿(仕事で迷ったときの一言)制作 | A | SNS | 0.5日 | Marketing-001 |
| Marketing-036 | [#38](https://github.com/samkaz15/fortune/issues/38) | TikTok投稿(糸町の少年キャラ紹介回)制作 | S | SNS | 0.5日 | Marketing-001 |
| Marketing-037 | [#39](https://github.com/samkaz15/fortune/issues/39) | TikTok投稿(診断あるある)制作 | A | SNS | 0.5日 | Marketing-001 |
| Marketing-038 | [#40](https://github.com/samkaz15/fortune/issues/40) | TikTok投稿(四柱推命を10秒で)制作 | A | SNS | 0.5日 | Marketing-001 |
| Marketing-039 | [#41](https://github.com/samkaz15/fortune/issues/41) | TikTok投稿(相性診断やってみた実演)制作 | S | SNS | 0.5日 | Marketing-001 |
| Marketing-040 | [#42](https://github.com/samkaz15/fortune/issues/42) | TikTok投稿(運気が下がるNG集)制作 | B | SNS | 0.5日 | Marketing-001 |
| Marketing-041 | [#43](https://github.com/samkaz15/fortune/issues/43) | TikTok投稿(ユーザーコメント紹介)制作 | A | SNS | 0.5日 | Marketing-001 |
| Marketing-042 | [#44](https://github.com/samkaz15/fortune/issues/44) | TikTok投稿(神社参拝作法豆知識)制作 | B | SNS | 0.5日 | Marketing-001 |
| Marketing-043 | [#45](https://github.com/samkaz15/fortune/issues/45) | TikTok投稿(開運カラー週替わり)制作 | B | SNS | 継続 | Marketing-001 |
| Marketing-044 | [#46](https://github.com/samkaz15/fortune/issues/46) | TikTok投稿(占い信じる?信じない?)制作 | B | SNS | 0.5日 | Marketing-001 |
| Marketing-045 | [#47](https://github.com/samkaz15/fortune/issues/47) | TikTok投稿(相性デュエット企画)制作 | B | SNS | 0.5日 | Marketing-001 |
| Marketing-046 | [#48](https://github.com/samkaz15/fortune/issues/48) | TikTok投稿(仕事診断リアクション)制作 | B | SNS | 0.5日 | Marketing-001 |
| Marketing-047 | [#49](https://github.com/samkaz15/fortune/issues/49) | TikTok投稿(糸町の少年の1日)制作 | B | SNS | 0.5日 | Marketing-001 |
| Marketing-048 | [#50](https://github.com/samkaz15/fortune/issues/50) | TikTok投稿(初詣あるある・季節企画)制作 | C | SNS | 0.5日 | Marketing-001 |
| Marketing-049 | [#51](https://github.com/samkaz15/fortune/issues/51) | TikTok投稿(運勢が良い日にやるべきこと)制作 | B | SNS | 0.5日 | Marketing-001 |
| Marketing-050 | [#52](https://github.com/samkaz15/fortune/issues/52) | TikTok投稿(転職を考えている人へ)制作 | B | SNS | 0.5日 | Marketing-001 |
| Marketing-051 | [#53](https://github.com/samkaz15/fortune/issues/53) | Instagram投稿(今週の運勢カルーセル)制作フロー確立 | S | SNS | 継続 | Marketing-002 |
| Marketing-052 | [#54](https://github.com/samkaz15/fortune/issues/54) | Instagram投稿(神社参拝マナー保存版)制作 | A | SNS | 0.5日 | Marketing-002 |
| Marketing-053 | [#55](https://github.com/samkaz15/fortune/issues/55) | Instagram投稿(開運アイテムまとめ)制作 | B | SNS | 0.5日 | Marketing-002 |
| Marketing-054 | [#56](https://github.com/samkaz15/fortune/issues/56) | Instagram投稿(糸町の少年世界観アート)制作 | B | SNS | 0.5日 | Marketing-002 |
| Marketing-055 | [#57](https://github.com/samkaz15/fortune/issues/57) | Instagram投稿(ユーザー結果紹介・許可制)制作 | A | SNS | 継続 | Marketing-002 |
| Marketing-056 | [#58](https://github.com/samkaz15/fortune/issues/58) | Instagram Reels(診断の使い方15秒デモ)制作 | S | SNS | 0.5日 | Marketing-002 |
| Marketing-057 | [#59](https://github.com/samkaz15/fortune/issues/59) | Instagramストーリーズ(今日の運勢クイズ形式)運用開始 | A | SNS | 継続 | Marketing-002 |
| Marketing-058 | [#60](https://github.com/samkaz15/fortune/issues/60) | YouTube Shorts(Pick a card: 今週のメッセージ)制作 | S | SNS | 1日 | Marketing-004 |
| Marketing-059 | [#61](https://github.com/samkaz15/fortune/issues/61) | YouTube Shorts(Pick a card: 恋愛運)制作 | A | SNS | 1日 | Marketing-004 |
| Marketing-060 | [#62](https://github.com/samkaz15/fortune/issues/62) | YouTube Shorts(Pick a card: 仕事運)制作 | A | SNS | 1日 | Marketing-004 |
| Marketing-061 | [#63](https://github.com/samkaz15/fortune/issues/63) | YouTube長尺(四柱推命を5分で解説)制作 | B | SNS | 2日 | Marketing-004 |
| Marketing-062 | [#64](https://github.com/samkaz15/fortune/issues/64) | YouTube長尺(開運神社の参拝方法)制作 | B | SNS | 2日 | Marketing-004 |
| Marketing-063 | [#65](https://github.com/samkaz15/fortune/issues/65) | X投稿(朝の一言運勢)毎日運用開始 | S | SNS | 継続 | Marketing-003 |
| Marketing-064 | [#66](https://github.com/samkaz15/fortune/issues/66) | X投稿(週間占いスレッド)運用開始 | A | SNS | 継続 | Marketing-003 |
| Marketing-065 | [#67](https://github.com/samkaz15/fortune/issues/67) | X投稿(ユーザーとの掛け合いリプライ運用ルール策定) | A | SNS | 0.5日 | Marketing-003 |
| Marketing-066 | [#68](https://github.com/samkaz15/fortune/issues/68) | X投稿(リポスト企画設計) | B | SNS | 0.5日 | Marketing-003 |
| Marketing-067 | [#69](https://github.com/samkaz15/fortune/issues/69) | Threads投稿運用開始(X転用フロー確立) | B | SNS | 継続 | Marketing-005 |
| Marketing-068 | [#70](https://github.com/samkaz15/fortune/issues/70) | Pinterestピン(開運インフォグラフィック)制作 | B | SNS | 1日 | Marketing-006 |
| Marketing-069 | [#71](https://github.com/samkaz15/fortune/issues/71) | Pinterestピン(五行相性チャート)制作 | B | SNS | 1日 | Marketing-006 |
| Marketing-070 | [#72](https://github.com/samkaz15/fortune/issues/72) | Pinterestピン(神社参拝マナーまとめ画像)制作 | C | SNS | 1日 | Marketing-006 |
| Marketing-071 | [#73](https://github.com/samkaz15/fortune/issues/73) | マイクロインフルエンサー候補リストアップ(占星術・タロット系) | A | Influencer | 1日 | - |
| Marketing-072 | [#74](https://github.com/samkaz15/fortune/issues/74) | マイクロインフルエンサー候補リストアップ(恋愛・キャリア系) | A | Influencer | 1日 | - |
| Marketing-073 | [#75](https://github.com/samkaz15/fortune/issues/75) | インフルエンサー依頼テンプレート確定・送付準備 | A | Influencer | 0.5日 | Marketing-071,072 |
| Marketing-074 | [#76](https://github.com/samkaz15/fortune/issues/76) | インフルエンサーギフティング打診第1弾(5名) | A | Influencer | 1日 | Marketing-073 |
| Marketing-075 | [#77](https://github.com/samkaz15/fortune/issues/77) | インフルエンサーコラボ効果測定の計測設計 | A | Influencer | 1日 | Marketing-074 |
| Marketing-076 | [#78](https://github.com/samkaz15/fortune/issues/78) | LINE公式アカウントの日次配信フォーマット設計 | S | LINE | 1日 | - |
| Marketing-077 | [#79](https://github.com/samkaz15/fortune/issues/79) | LINE公式配信の1週間分コンテンツ制作 | S | LINE | 2日 | Marketing-076 |
| Marketing-078 | [#80](https://github.com/samkaz15/fortune/issues/80) | LINE友だち限定コンテンツの企画 | A | LINE | 1日 | Marketing-076 |
| Marketing-079 | [#81](https://github.com/samkaz15/fortune/issues/81) | プッシュ通知/LINE通知の高度化設計 | A | Referral | 2日 | - |
| Marketing-080 | [#82](https://github.com/samkaz15/fortune/issues/82) | 週次振り返り通知(「今週はどうだった」)の実装 | A | Referral | 2日 | Marketing-079 |
| Marketing-081 | [#83](https://github.com/samkaz15/fortune/issues/83) | 月次サマリー通知の実装 | B | Referral | 2日 | Marketing-079 |
| Marketing-082 | [#84](https://github.com/samkaz15/fortune/issues/84) | UTMパラメータ運用ルールの策定 | S | Infra | 0.5日 | - |
| Marketing-083 | [#85](https://github.com/samkaz15/fortune/issues/85) | 診断完了イベントの計測実装 | S | Infra | 1日 | - |
| Marketing-084 | [#86](https://github.com/samkaz15/fortune/issues/86) | シェアボタン押下イベントの計測実装 | S | Infra | 1日 | Marketing-008 |
| Marketing-085 | [#87](https://github.com/samkaz15/fortune/issues/87) | 紹介コード経由登録イベントの計測実装 | A | Infra | 1日 | Marketing-013 |
| Marketing-086 | [#88](https://github.com/samkaz15/fortune/issues/88) | 週次KPIダッシュボードの整備 | A | Infra | 2日 | Marketing-082,083 |
| Marketing-087 | [#89](https://github.com/samkaz15/fortune/issues/89) | 月次KPIレポートテンプレート作成 | B | Infra | 1日 | Marketing-086 |
| Marketing-088 | [#90](https://github.com/samkaz15/fortune/issues/90) | SNS運用ガイドライン(炎上リスク対応含む)策定 | S | SNS | 1日 | - |
| Marketing-089 | [#91](https://github.com/samkaz15/fortune/issues/91) | コンテンツカレンダー(季節イベント)90日分作成 | A | Content | 1日 | - |
| Marketing-090 | [#92](https://github.com/samkaz15/fortune/issues/92) | ユーザー体験談インタビュー記事第1弾 | B | Content | 2日 | - |
| Marketing-091 | [#93](https://github.com/samkaz15/fortune/issues/93) | 「占いは背中を押すもの」ブランドメッセージ投稿シリーズ企画 | B | Content | 1日 | - |
| Marketing-092 | [#94](https://github.com/samkaz15/fortune/issues/94) | 今年の運勢(年間サマリー)機能の需要検証メモ作成 | C | Content | 0.5日 | - |
| Marketing-093 | [#95](https://github.com/samkaz15/fortune/issues/95) | 金運診断コンテンツ需要検証メモ作成 | C | Content | 0.5日 | - |
| Marketing-094 | [#96](https://github.com/samkaz15/fortune/issues/96) | 指名検索(「糸町の少年」)のモニタリング設計 | B | SEO | 0.5日 | - |
| Marketing-095 | [#97](https://github.com/samkaz15/fortune/issues/97) | 競合SNSアカウントの定点観測リスト作成 | B | SNS | 0.5日 | - |
| Marketing-096 | [#98](https://github.com/samkaz15/fortune/issues/98) | SNS投稿の週次パフォーマンスレビュー運用開始 | A | SNS | 継続 | Marketing-033,051,058,063 |
| Marketing-097 | [#99](https://github.com/samkaz15/fortune/issues/99) | Google Search Console定点モニタリング運用開始 | A | SEO | 継続 | Marketing-032 |
| Marketing-098 | [#100](https://github.com/samkaz15/fortune/issues/100) | バイラル係数(K-factor)算出ロジックの実装 | B | Infra | 2日 | Marketing-085 |
| Marketing-099 | [#101](https://github.com/samkaz15/fortune/issues/101) | チャーン率算出・可視化の実装 | B | Infra | 1日 | - |
| Marketing-100 | [#102](https://github.com/samkaz15/fortune/issues/102) | LTV算出ロジックの設計・実装 | B | Infra | 2日 | Marketing-099 |
| Marketing-101 | [#103](https://github.com/samkaz15/fortune/issues/103) | 90日ロードマップ Week4振り返りミーティング設計 | A | Roadmap | 0.5日 | - |
| Marketing-102 | [#104](https://github.com/samkaz15/fortune/issues/104) | 90日ロードマップ Week8振り返りミーティング設計 | A | Roadmap | 0.5日 | - |
| Marketing-103 | [#105](https://github.com/samkaz15/fortune/issues/105) | 90日総括レポート・次期90日計画テンプレート作成 | A | Roadmap | 1日 | - |
| Marketing-104 | [#106](https://github.com/samkaz15/fortune/issues/106) | occult_analysis_base等の占術解説をSEO記事向けに一般化する方針整理 | B | SEO | 1日 | - |
| Marketing-105 | [#107](https://github.com/samkaz15/fortune/issues/107) | 神社ページのSNSリンク(既存media列)運用開始 | B | SNS | 0.5日 | - |

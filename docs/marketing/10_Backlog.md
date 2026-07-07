# 10. Backlog — 施策一覧(GitHub Issue化元台帳)
作成日: 2026-07-07 / 総施策数: 105件
全件をGitHub Issueとして作成済み(Issue番号は本リポジトリの実際の発行順)。本ドキュメントはその一覧・優先順位・依存関係の台帳として保守する。

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

## 全施策一覧

| ID | タイトル | 優先度 | チャネル | 工数 | 依存関係 |
|---|---|---|---|---|---|
| Marketing-001 | TikTok公式アカウント開設 | S | SNS | 0.5日 | - |
| Marketing-002 | Instagram公式アカウント開設 | S | SNS | 0.5日 | - |
| Marketing-003 | X公式アカウント開設 | S | SNS | 0.5日 | - |
| Marketing-004 | YouTube公式チャンネル開設 | A | SNS | 0.5日 | - |
| Marketing-005 | Threads公式アカウント開設 | B | SNS | 0.3日 | Marketing-003 |
| Marketing-006 | Pinterest公式アカウント開設 | B | SNS | 0.3日 | - |
| Marketing-007 | SNS共通プロフィール文・世界観ガイドライン策定 | S | SNS | 1日 | - |
| Marketing-008 | OGP画像自動生成機能の実装 | S | Infra | 3日 | - |
| Marketing-009 | シェア専用コピー自動生成機能 | S | Infra | 2日 | Marketing-008 |
| Marketing-010 | シェアボタンの露出強化(全診断結果画面に統一配置) | A | Infra | 1日 | Marketing-009 |
| Marketing-011 | 紹介制度の再設計・要件定義 | S | Referral | 1日 | - |
| Marketing-012 | 紹介制度のUI実装 | S | Referral | 3日 | Marketing-011 |
| Marketing-013 | 紹介制度のAPI実装 | S | Referral | 2日 | Marketing-011 |
| Marketing-014 | 連続利用ストリーク表示の実装 | A | Referral | 2日 | - |
| Marketing-015 | 実績バッジ機能の実装 | B | Referral | 3日 | Marketing-014 |
| Marketing-016 | 診断コラム記事(四柱推命とは)執筆 | S | SEO | 1日 | - |
| Marketing-017 | 診断コラム記事(相性診断の仕組み)執筆 | S | SEO | 1日 | - |
| Marketing-018 | 診断コラム記事(適職診断とキャリア)執筆 | S | SEO | 1日 | - |
| Marketing-019 | 開運コラム記事(ラッキーカラー2026)執筆 | A | SEO | 0.5日 | - |
| Marketing-020 | 開運コラム記事(運気アップの方法)執筆 | A | SEO | 0.5日 | - |
| Marketing-021 | 開運コラム記事(開運神社の選び方)執筆 | A | SEO | 0.5日 | - |
| Marketing-022 | 開運コラム記事(風水 間取り基本)執筆 | B | SEO | 0.5日 | - |
| Marketing-023 | 神社レビュー記事第1弾 | S | SEO | 1日 | CEO一次情報 |
| Marketing-024 | 神社レビュー記事第2〜5弾 | A | SEO | 3日 | Marketing-023 |
| Marketing-025 | 参詣作法コラム(正しい参拝方法)執筆 | S | SEO | 1日 | - |
| Marketing-026 | お守りの選び方コラム執筆 | A | SEO | 0.5日 | - |
| Marketing-027 | FAQページの作成 | A | SEO | 1日 | - |
| Marketing-028 | ピラーページ「占いで人生の決断を後悔しないための完全ガイド」作成 | S | SEO | 2日 | Marketing-016,017,018 |
| Marketing-029 | 構造化データ(Article)実装 | A | Infra | 1日 | - |
| Marketing-030 | 構造化データ(Quiz/WebApplication)実装 | B | Infra | 1日 | - |
| Marketing-031 | 構造化データ(LocalBusiness)実装 | B | Infra | 1日 | - |
| Marketing-032 | sitemap.xml整備・Search Console登録 | S | SEO | 0.5日 | - |
| Marketing-033 | TikTok投稿(今日の運勢シリーズ)制作フロー確立 | S | SNS | 継続 | Marketing-001 |
| Marketing-034 | TikTok投稿(恋愛運が上がる仕草3選)制作 | A | SNS | 0.5日 | Marketing-001 |
| Marketing-035 | TikTok投稿(仕事で迷ったときの一言)制作 | A | SNS | 0.5日 | Marketing-001 |
| Marketing-036 | TikTok投稿(糸町の少年キャラ紹介回)制作 | S | SNS | 0.5日 | Marketing-001 |
| Marketing-037 | TikTok投稿(診断あるある)制作 | A | SNS | 0.5日 | Marketing-001 |
| Marketing-038 | TikTok投稿(四柱推命を10秒で)制作 | A | SNS | 0.5日 | Marketing-001 |
| Marketing-039 | TikTok投稿(相性診断やってみた実演)制作 | S | SNS | 0.5日 | Marketing-001 |
| Marketing-040 | TikTok投稿(運気が下がるNG集)制作 | B | SNS | 0.5日 | Marketing-001 |
| Marketing-041 | TikTok投稿(ユーザーコメント紹介)制作 | A | SNS | 0.5日 | Marketing-001 |
| Marketing-042 | TikTok投稿(神社参拝作法豆知識)制作 | B | SNS | 0.5日 | Marketing-001 |
| Marketing-043 | TikTok投稿(開運カラー週替わり)制作 | B | SNS | 継続 | Marketing-001 |
| Marketing-044 | TikTok投稿(占い信じる?信じない?)制作 | B | SNS | 0.5日 | Marketing-001 |
| Marketing-045 | TikTok投稿(相性デュエット企画)制作 | B | SNS | 0.5日 | Marketing-001 |
| Marketing-046 | TikTok投稿(仕事診断リアクション)制作 | B | SNS | 0.5日 | Marketing-001 |
| Marketing-047 | TikTok投稿(糸町の少年の1日)制作 | B | SNS | 0.5日 | Marketing-001 |
| Marketing-048 | TikTok投稿(初詣あるある・季節企画)制作 | C | SNS | 0.5日 | Marketing-001 |
| Marketing-049 | TikTok投稿(運勢が良い日にやるべきこと)制作 | B | SNS | 0.5日 | Marketing-001 |
| Marketing-050 | TikTok投稿(転職を考えている人へ)制作 | B | SNS | 0.5日 | Marketing-001 |
| Marketing-051 | Instagram投稿(今週の運勢カルーセル)制作フロー確立 | S | SNS | 継続 | Marketing-002 |
| Marketing-052 | Instagram投稿(神社参拝マナー保存版)制作 | A | SNS | 0.5日 | Marketing-002 |
| Marketing-053 | Instagram投稿(開運アイテムまとめ)制作 | B | SNS | 0.5日 | Marketing-002 |
| Marketing-054 | Instagram投稿(糸町の少年世界観アート)制作 | B | SNS | 0.5日 | Marketing-002 |
| Marketing-055 | Instagram投稿(ユーザー結果紹介・許可制)制作 | A | SNS | 継続 | Marketing-002 |
| Marketing-056 | Instagram Reels(診断の使い方15秒デモ)制作 | S | SNS | 0.5日 | Marketing-002 |
| Marketing-057 | Instagramストーリーズ(今日の運勢クイズ形式)運用開始 | A | SNS | 継続 | Marketing-002 |
| Marketing-058 | YouTube Shorts(Pick a card: 今週のメッセージ)制作 | S | SNS | 1日 | Marketing-004 |
| Marketing-059 | YouTube Shorts(Pick a card: 恋愛運)制作 | A | SNS | 1日 | Marketing-004 |
| Marketing-060 | YouTube Shorts(Pick a card: 仕事運)制作 | A | SNS | 1日 | Marketing-004 |
| Marketing-061 | YouTube長尺(四柱推命を5分で解説)制作 | B | SNS | 2日 | Marketing-004 |
| Marketing-062 | YouTube長尺(開運神社の参拝方法)制作 | B | SNS | 2日 | Marketing-004 |
| Marketing-063 | X投稿(朝の一言運勢)毎日運用開始 | S | SNS | 継続 | Marketing-003 |
| Marketing-064 | X投稿(週間占いスレッド)運用開始 | A | SNS | 継続 | Marketing-003 |
| Marketing-065 | X投稿(ユーザーとの掛け合いリプライ運用ルール策定) | A | SNS | 0.5日 | Marketing-003 |
| Marketing-066 | X投稿(リポスト企画設計) | B | SNS | 0.5日 | Marketing-003 |
| Marketing-067 | Threads投稿運用開始(X転用フロー確立) | B | SNS | 継続 | Marketing-005 |
| Marketing-068 | Pinterestピン(開運インフォグラフィック)制作 | B | SNS | 1日 | Marketing-006 |
| Marketing-069 | Pinterestピン(五行相性チャート)制作 | B | SNS | 1日 | Marketing-006 |
| Marketing-070 | Pinterestピン(神社参拝マナーまとめ画像)制作 | C | SNS | 1日 | Marketing-006 |
| Marketing-071 | マイクロインフルエンサー候補リストアップ(占星術・タロット系) | A | Influencer | 1日 | - |
| Marketing-072 | マイクロインフルエンサー候補リストアップ(恋愛・キャリア系) | A | Influencer | 1日 | - |
| Marketing-073 | インフルエンサー依頼テンプレート確定・送付準備 | A | Influencer | 0.5日 | Marketing-071,072 |
| Marketing-074 | インフルエンサーギフティング打診第1弾(5名) | A | Influencer | 1日 | Marketing-073 |
| Marketing-075 | インフルエンサーコラボ効果測定の計測設計 | A | Influencer | 1日 | Marketing-074 |
| Marketing-076 | LINE公式アカウントの日次配信フォーマット設計 | S | LINE | 1日 | - |
| Marketing-077 | LINE公式配信の1週間分コンテンツ制作 | S | LINE | 2日 | Marketing-076 |
| Marketing-078 | LINE友だち限定コンテンツの企画 | A | LINE | 1日 | Marketing-076 |
| Marketing-079 | プッシュ通知/LINE通知の高度化設計 | A | Referral | 2日 | - |
| Marketing-080 | 週次振り返り通知(「今週はどうだった」)の実装 | A | Referral | 2日 | Marketing-079 |
| Marketing-081 | 月次サマリー通知の実装 | B | Referral | 2日 | Marketing-079 |
| Marketing-082 | UTMパラメータ運用ルールの策定 | S | Infra | 0.5日 | - |
| Marketing-083 | 診断完了イベントの計測実装 | S | Infra | 1日 | - |
| Marketing-084 | シェアボタン押下イベントの計測実装 | S | Infra | 1日 | Marketing-008 |
| Marketing-085 | 紹介コード経由登録イベントの計測実装 | A | Infra | 1日 | Marketing-013 |
| Marketing-086 | 週次KPIダッシュボードの整備 | A | Infra | 2日 | Marketing-082,083 |
| Marketing-087 | 月次KPIレポートテンプレート作成 | B | Infra | 1日 | Marketing-086 |
| Marketing-088 | SNS運用ガイドライン(炎上リスク対応含む)策定 | S | SNS | 1日 | - |
| Marketing-089 | コンテンツカレンダー(季節イベント)90日分作成 | A | Content | 1日 | - |
| Marketing-090 | ユーザー体験談インタビュー記事第1弾 | B | Content | 2日 | - |
| Marketing-091 | 「占いは背中を押すもの」ブランドメッセージ投稿シリーズ企画 | B | Content | 1日 | - |
| Marketing-092 | 今年の運勢(年間サマリー)機能の需要検証メモ作成 | C | Content | 0.5日 | - |
| Marketing-093 | 金運診断コンテンツ需要検証メモ作成 | C | Content | 0.5日 | - |
| Marketing-094 | 指名検索(「糸町の少年」)のモニタリング設計 | B | SEO | 0.5日 | - |
| Marketing-095 | 競合SNSアカウントの定点観測リスト作成 | B | SNS | 0.5日 | - |
| Marketing-096 | SNS投稿の週次パフォーマンスレビュー運用開始 | A | SNS | 継続 | Marketing-033,051,058,063 |
| Marketing-097 | Google Search Console定点モニタリング運用開始 | A | SEO | 継続 | Marketing-032 |
| Marketing-098 | バイラル係数(K-factor)算出ロジックの実装 | B | Infra | 2日 | Marketing-085 |
| Marketing-099 | チャーン率算出・可視化の実装 | B | Infra | 1日 | - |
| Marketing-100 | LTV算出ロジックの設計・実装 | B | Infra | 2日 | Marketing-099 |
| Marketing-101 | 90日ロードマップ Week4振り返りミーティング設計 | A | Roadmap | 0.5日 | - |
| Marketing-102 | 90日ロードマップ Week8振り返りミーティング設計 | A | Roadmap | 0.5日 | - |
| Marketing-103 | 90日総括レポート・次期90日計画テンプレート作成 | A | Roadmap | 1日 | - |
| Marketing-104 | occult_analysis_base等の占術解説をSEO記事向けに一般化する方針整理 | B | SEO | 1日 | - |
| Marketing-105 | 神社ページのSNSリンク(既存media列)運用開始 | B | SNS | 0.5日 | - |

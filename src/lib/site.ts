/**
 * サイト共通定数(リニューアル計画 2026-07-11)。
 * サービス名は56ファイルに文字列で散在していたため、ここへ一元化を開始する。
 * 新規・変更コードは必ずこの定数を参照すること(リファクタリング計画§4)。
 */
export const SITE_NAME = "錦糸町の少年";
export const SITE_NAME_EN = "KINSHICHO NO SHONEN"; // 正式な英語ブランド表記(ローマ字)。日本語への翻訳ではなく音写。OGP/SEO/メタ情報で統一使用する
export const SITE_TAGLINE = "大丈夫。必ずうまくいく。";
export const SITE_URL = "https://fortune-kinshicho.vercel.app"; // 実際のデプロイ先ドメインと異なる場合は要更新(layout.tsxのmetadataBaseはAPP_URL環境変数を別途参照)

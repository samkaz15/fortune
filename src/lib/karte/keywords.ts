/**
 * RAG検索用キーワード抽出(純粋関数・DB非依存 / 2026-07-12)
 *
 * 【背景・結合テストでの発見】pg_trgmはDBのlc_ctypeがUTF-8系でないと日本語の
 * トライグラムを一切生成しない(Cロケールではsimilarity=0)。similarity単独に
 * 依存するとRAGが環境次第で無音で全滅するため、ロケール非依存のILIKE中間一致を
 * OR条件で併用する。その検索語をここで抽出する。
 * 形態素解析は使わず、助詞・語尾での分割による簡易抽出(依存ゼロ・決定論的)。
 */
export function extractKeywords(text: string, max = 4): string[] {
  const tokens = text
    .split(/[をはがにへでとのやかもねだよなあらしくすればしたいですますんかっ、。・…!?！？\s]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && t.length <= 12);
  return [...new Set(tokens)].sort((a, b) => b.length - a.length).slice(0, max);
}

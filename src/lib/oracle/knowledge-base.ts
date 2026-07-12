/**
 * 師匠知見ベース(Oracle Knowledge Base) — 2026-07-12
 *
 * 【これは何か】人生カルテが「ユーザー側の記憶」なら、これは「錦糸町の少年側の記憶」。
 * CEOの実鑑定から生まれた独自ノウハウ(例: 財布ブランド×運気)を構造化して蓄積し、
 * チャットや鑑定で関連する話題が出たときに「錦糸町の少年の見解」として展開する。
 * CEOが知見を追加するほど、AIの回答がニッチで独自性の高いものになっていく仕組み。
 *
 * 【データの置き場所】knowledge/oracle/*.json(リポジトリ内・git管理)
 *  - デプロイに同梱されるためDBもRedisも不要。バージョン管理・レビュー・ロールバックが効く
 *  - 更新方法は docs/oracle_knowledge_guide.md 参照(GitHub上で直接編集→自動デプロイが最短)
 *
 * 【検索】人生カルテと同じ思想: extractKeywords(助詞分割)によるタグ/本文マッチ。
 * 決定論的・依存ゼロ。エントリ数が数百を超えたらスコアリング強化を検討する。
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { extractKeywords } from "@/lib/karte/keywords";

export interface OracleEntry {
  id: string;
  topic: string; // 属するファイルのtopic
  brand?: string;
  tags: string[];
  insight: string;
  commonPrinciple?: string; // ファイル共通の原則(該当時に一緒に渡す)
  expressionGuideline?: string; // 表現上の注意(LLMへの指示として渡す)
  source: string;
  updatedAt: string;
}

interface OracleFile {
  topic: string;
  version: number;
  updatedAt: string;
  source: string;
  commonPrinciple?: string;
  expressionGuideline?: string;
  entries: Array<{ id: string; brand?: string; tags: string[]; insight: string }>;
}

let cache: OracleEntry[] | null = null;

/** knowledge/oracle/ 配下の全JSONを読み込む(プロセス内キャッシュ) */
export function loadOracleKnowledge(): OracleEntry[] {
  if (cache) return cache;
  const dir = path.join(process.cwd(), "knowledge", "oracle");
  const entries: OracleEntry[] = [];
  try {
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".json")) continue;
      try {
        const data = JSON.parse(readFileSync(path.join(dir, file), "utf-8")) as OracleFile;
        for (const e of data.entries ?? []) {
          entries.push({
            ...e,
            topic: data.topic,
            commonPrinciple: data.commonPrinciple,
            expressionGuideline: data.expressionGuideline,
            source: data.source,
            updatedAt: data.updatedAt,
          });
        }
      } catch (err) {
        // 1ファイルのJSON破損で全体を止めない(壊れたファイルはログだけ残しスキップ)
        console.error(`[oracle-kb] failed to load ${file}:`, err);
      }
    }
  } catch {
    // knowledge/oracle が無い環境(テスト等)は空で返す
  }
  cache = entries;
  return entries;
}

/** テスト・ホットリロード用 */
export function clearOracleCache(): void {
  cache = null;
}

/**
 * ユーザーの発言に関連する知見を検索する。
 * タグ完全一致=2点、タグ/本文への部分一致=1点で採点し、スコア順に上位を返す。
 */
export function searchOracleKnowledge(queryText: string, limit = 3): OracleEntry[] {
  const keywords = extractKeywords(queryText, 6);
  if (keywords.length === 0) return [];
  const scored: Array<{ entry: OracleEntry; score: number }> = [];
  for (const entry of loadOracleKnowledge()) {
    let score = 0;
    for (const kw of keywords) {
      if (entry.tags.includes(kw)) score += 2;
      else if (entry.tags.some((t) => t.includes(kw) || kw.includes(t))) score += 1;
      else if (entry.insight.includes(kw) || (entry.brand ?? "").includes(kw)) score += 1;
    }
    if (score > 0) scored.push({ entry, score });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.entry);
}

/** チャットのsystem promptへ注入する形式に整形する */
export function formatOracleForPrompt(entries: OracleEntry[]): string {
  if (entries.length === 0) return "";
  const guidelines = [...new Set(entries.map((e) => e.expressionGuideline).filter(Boolean))];
  const principles = [...new Set(entries.map((e) => e.commonPrinciple).filter(Boolean))];
  return [
    "# 錦糸町の少年の独自見解(師匠直伝の知見ベース。関連する質問にはこの見立てを自分の見解として語ってよい)",
    ...entries.map((e) => `- 【${e.brand ?? e.topic}】${e.insight}`),
    ...(principles.length > 0 ? [`共通原則: ${principles.join(" / ")}`] : []),
    ...(guidelines.length > 0 ? [`表現上の注意: ${guidelines.join(" / ")}`] : []),
  ].join("\n");
}

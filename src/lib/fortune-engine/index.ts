import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * キャラクタープロンプトは /prompts/chat/system_prompt.v2.5.md から読み込む(v2.5: 具体性・寄り添い・根拠の原則を追補)
 * (コードにハードコードしない方針はGPT3の申し送り通り維持)。
 * ※ディレクトリ名は歴史的経緯で prompts/chat/ のままだが、チャット機能自体は
 *   2026-07-08の要件⑦で完全廃止済み。このプロンプトは意思決定レポート(decision-report)や
 *   無料占い(self/reading)など、キャラクターの言葉で語る全機能の共通人格定義として現役。
 * v2.0(スタイル統合前)・v1.0(ツクヨミ・不採用)は履歴として prompts/chat/ に残している。
 */
function loadCharacterPrompt(): string {
  const promptPath = path.join(process.cwd(), "prompts", "chat", "system_prompt.v2.5.md");
  try {
    return readFileSync(promptPath, "utf-8");
  } catch {
    // ファイルが見つからない実行環境(一部のエッジランタイム等)向けの最終フォールバック
    return "あなたは占いアプリのキャラクター「錦糸町の少年」です。一人称は「僕」、常にポジティブに、決め打ちで話してください。占術の内訳は開示しないでください。";
  }
}

export const CHARACTER_PROMPT = loadCharacterPrompt();

/** 占術分析の基礎プロンプト(Layer0・UX8)。LLM連携時にキャラ層の上流で客観分析を行う。 */
function loadAnalysisPrompt(): string | undefined {
  try {
    return readFileSync(path.join(process.cwd(), "prompts", "analysis", "occult_analysis_base.v1.md"), "utf-8");
  } catch {
    return undefined;
  }
}
export const ANALYSIS_PROMPT = loadAnalysisPrompt();

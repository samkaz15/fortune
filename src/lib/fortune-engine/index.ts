import { calculateSeimei, calculateCompatibilityFromNames, SeimeiScore } from "./seimei";
import { calculateShichu, ShichuSummary } from "./shichu";
import { calculateSanmei, SanmeiSummary } from "./sanmei";
import { calculateHoroscope, HoroscopeResult } from "./horoscope";
import { callSakanaAI } from "./sakana-ai-adapter";
import type { ConsultCategory } from "@/generated/prisma/enums";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * キャラクタープロンプトは /prompts/chat/system_prompt.v2.1.md から読み込む
 * (コードにハードコードしない方針はGPT3の申し送り通り維持)。
 * v2.2は連投廃止(1メッセージ集約)+事実ベース導入を反映。v2.1以前のスタイル抽出は
 * (docs/design/02_brand_strategy/CEO_STYLE_conversation_guide.md)を統合したもの。
 * v2.0(スタイル統合前)・v1.0(ツクヨミ・不採用)は履歴として prompts/chat/ に残している。
 */
function loadCharacterPrompt(): string {
  const promptPath = path.join(process.cwd(), "prompts", "chat", "system_prompt.v2.3.md");
  try {
    return readFileSync(promptPath, "utf-8");
  } catch {
    // ファイルが見つからない実行環境(一部のエッジランタイム等)向けの最終フォールバック
    return "あなたは占いアプリのキャラクター「糸町の少年」です。一人称は「僕」、常にポジティブに、決め打ちで話してください。占術の内訳は開示しないでください。";
  }
}

export const CHARACTER_PROMPT = loadCharacterPrompt();

export interface UserProfileInput {
  familyName: string;
  givenName: string;
  birthDate: Date;
  birthTime?: string;
  gender?: string;
}

export interface GenerateFortuneParams {
  category: ConsultCategory;
  profile: UserProfileInput;
  /** 相性診断時のみ相手情報を渡す */
  partnerProfile?: UserProfileInput;
  /** チャットでユーザーが実際に入力した相談内容 */
  userQuestion: string;
  /** 天気連携(CL12)の結果があれば渡す。低気圧等の情報を結果に反映する */
  weatherContext?: { pressureHpa?: number; isLowPressure?: boolean } | null;
}

export interface FortuneEngineOutput {
  message: string;
  summary: string;
  nextActions: [string, string, string];
  overallScore: number;
  seimeiScore?: SeimeiScore;
  sanmeiSummary?: SanmeiSummary;
  shichuSummary?: ShichuSummary;
  horoscope?: HoroscopeResult;
  compatibilityScore?: number;
}

/**
 * CEO1(占術統合ロジック監修, 2026-07-03)で確定したカテゴリ別の占術固定割当。
 * ブレンド方式ではなく、相談カテゴリごとに使用する占術を決め打ちする。
 * 詳細: docs/design/00_ceo_decisions/CEO1_divination_logic_assignment.md
 *
 *   BUSINESS                  → 算命学のみ
 *   SELF / TODAY               → ホロスコープ + 四柱推命
 *   RELATIONSHIP / COMPATIBILITY → 姓名判断のみ
 */
type DivinationSystem = "seimei" | "sanmei" | "shichu" | "horoscope";

function systemsForCategory(category: ConsultCategory): DivinationSystem[] {
  switch (category) {
    case "BUSINESS":
      return ["sanmei"];
    case "SELF":
    case "TODAY":
      return ["horoscope", "shichu"];
    case "RELATIONSHIP":
    case "COMPATIBILITY":
      return ["seimei"];
    default:
      return ["horoscope", "shichu"]; // フォールバック(未知カテゴリはSELF/TODAY相当扱い)
  }
}

/**
 * 相談カテゴリに応じて必要な占術のみを実行し、Sakana AIへ渡して
 * キャラクターの言葉に変換してもらうメインエントリーポイント。
 * API Route(/api/chat)からはこの関数だけを呼べばよい。
 *
 * 全占術を常に計算していた旧実装から、CEO1決定に基づくカテゴリ別ルーティングに変更した
 * (2026-07-03)。ユーザーへはどの占術を使っているか開示しない方針のため、
 * このルーティング自体もシステムプロンプト側では言及しない。
 */
export async function generateFortune(params: GenerateFortuneParams): Promise<FortuneEngineOutput> {
  const { category, profile, partnerProfile, userQuestion, weatherContext } = params;
  const systems = systemsForCategory(category);

  const seimeiScore = systems.includes("seimei") ? calculateSeimei(profile.familyName, profile.givenName) : undefined;
  const sanmeiSummary = systems.includes("sanmei") ? calculateSanmei(profile.birthDate) : undefined;
  const shichuSummary = systems.includes("shichu") ? calculateShichu(profile.birthDate) : undefined;
  const horoscope = systems.includes("horoscope") ? calculateHoroscope(profile.birthDate) : undefined;

  const compatibilityScore =
    category === "COMPATIBILITY" && partnerProfile
      ? calculateCompatibilityFromNames(
          { familyName: profile.familyName, givenName: profile.givenName },
          { familyName: partnerProfile.familyName, givenName: partnerProfile.givenName }
        )
      : undefined;

  const aiResponse = await callSakanaAI({
    category,
    characterPrompt: CHARACTER_PROMPT,
    userQuestion,
    signals: {
      seimei: seimeiScore ?? null,
      sanmei: sanmeiSummary ?? null,
      shichu: shichuSummary ?? null,
      horoscope: horoscope ?? null,
      compatibilityScore: compatibilityScore ?? null,
      weather: weatherContext ?? null,
    },
  });

  return {
    message: aiResponse.message,
    summary: aiResponse.summary,
    nextActions: aiResponse.nextActions,
    overallScore: aiResponse.overallScore,
    seimeiScore,
    sanmeiSummary,
    shichuSummary,
    horoscope,
    compatibilityScore,
  };
}

export { calculateSeimei, calculateSanmei, calculateShichu, calculateHoroscope };

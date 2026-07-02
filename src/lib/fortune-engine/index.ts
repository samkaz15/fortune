import { calculateSeimei, calculateCompatibilityFromNames, SeimeiScore } from "./seimei";
import { calculateShichu, ShichuSummary } from "./shichu";
import { calculateSanmei, SanmeiSummary } from "./sanmei";
import { calculateHoroscope, HoroscopeResult } from "./horoscope";
import { callSakanaAI } from "./sakana-ai-adapter";
import type { ConsultCategory } from "@prisma/client";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * キャラクタープロンプトは GPT3(チャットAIプロンプト・口調設計)の申し送り事項に従い、
 * コードにハードコードせず /prompts/chat/system_prompt.v1.0.md から読み込む。
 * キャラクター「ツクヨミ」の人格・禁止事項・crisis対応方針はこのファイルが正。
 * バージョンを上げる場合は system_prompt.v1.1.md 等を追加し、
 * このファイル名の参照だけを差し替える(A/Bテスト時はPhase2でルーティングを追加する)。
 */
function loadCharacterPrompt(): string {
  const promptPath = path.join(process.cwd(), "prompts", "chat", "system_prompt.v1.0.md");
  try {
    return readFileSync(promptPath, "utf-8");
  } catch {
    // ファイルが見つからない実行環境(一部のエッジランタイム等)向けの最終フォールバック
    return "あなたは占いアプリのAIキャラクター「ツクヨミ」です。共感的に、断定を避けて答えてください。";
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
  seimeiScore: SeimeiScore;
  sanmeiSummary: SanmeiSummary;
  shichuSummary: ShichuSummary;
  horoscope: HoroscopeResult;
  compatibilityScore?: number;
}

/**
 * 4占術(姓名判断/算命学/四柱推命/ホロスコープ)を統合し、
 * Sakana AIへ渡してキャラクターの言葉に変換してもらうメインエントリーポイント。
 * API Route(/api/chat)からはこの関数だけを呼べばよい。
 */
export async function generateFortune(params: GenerateFortuneParams): Promise<FortuneEngineOutput> {
  const { category, profile, partnerProfile, userQuestion, weatherContext } = params;

  const seimeiScore = calculateSeimei(profile.familyName, profile.givenName);
  const sanmeiSummary = calculateSanmei(profile.birthDate);
  const shichuSummary = calculateShichu(profile.birthDate);
  const horoscope = calculateHoroscope(profile.birthDate);

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
      seimei: seimeiScore,
      sanmei: sanmeiSummary,
      shichu: shichuSummary,
      horoscope,
      compatibilityScore,
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

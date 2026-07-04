/**
 * 意思決定レポート ②外部環境分析層
 *
 * 仕様(CEO_UPDATE)の最重要ルール:
 * 「今日は低気圧なので」等の気象説明は禁止。外部環境は必ず人間行動キーワードへ翻訳する。
 *
 * この層の設計意図: LLMには気圧の生値を渡さず、翻訳済みキーワードのみを渡す。
 * これにより気象用語がユーザー向け文章に混入することをシステム的に不可能にする。
 */
import type { WeatherContext } from "@/lib/weather";

export interface EnvironmentFeatures {
  /** ②-b に表示する代表キーワード1つ */
  keyword: string;
  /** LLMに渡す補助キーワード群 */
  supportKeywords: string[];
  /** ルールベーススコアリングへの補正値 */
  scoreModifier: number;
}

/** 気圧帯 → 人間行動キーワードの翻訳テーブル(production_design.md §2) */
const PRESSURE_TRANSLATIONS: Array<{
  test: (hpa: number) => boolean;
  keyword: string;
  support: string[];
  modifier: number;
}> = [
  {
    test: (hpa) => hpa < 1005,
    keyword: "疲労",
    support: ["判断を急ぎやすい空気", "周囲も余裕がなくなりやすい", "集中の波"],
    modifier: -8,
  },
  {
    test: (hpa) => hpa < 1010,
    keyword: "焦り",
    support: ["集中力のムラ", "情報過多になりやすい"],
    modifier: -4,
  },
  {
    test: (hpa) => hpa <= 1020,
    keyword: "落ち着き",
    support: ["平常運転", "淡々と進めやすい"],
    modifier: 0,
  },
  {
    test: () => true, // >1020
    keyword: "冴え",
    support: ["頭が冴える", "行動しやすい空気"],
    modifier: +5,
  },
];

/** 曜日 → 補正(週初めの慌ただしさ・週末の開放感) */
function weekdayAdjustment(date: Date): { support: string[]; modifier: number } {
  const dow = date.getDay(); // 0=Sun
  if (dow === 1) return { support: ["週初めの慌ただしさ", "情報過多"], modifier: -2 };
  if (dow === 5) return { support: ["開放感", "週の締めくくり"], modifier: +2 };
  return { support: [], modifier: 0 };
}

export function analyzeEnvironment(
  weather: WeatherContext | null,
  date: Date = new Date()
): EnvironmentFeatures {
  const hpa = weather?.pressureHpa ?? 1013; // 天気取得失敗時は標準気圧として扱う(機能を止めない)
  const pressure = PRESSURE_TRANSLATIONS.find((t) => t.test(hpa))!;
  const weekday = weekdayAdjustment(date);

  return {
    keyword: pressure.keyword,
    supportKeywords: [...pressure.support, ...weekday.support],
    scoreModifier: pressure.modifier + weekday.modifier,
  };
}

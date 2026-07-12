/**
 * 数秘術モジュール (マルチインデックス拡張 / 2026-07-12)
 *
 * - 現代数秘術: 生年月日の全桁を還元したライフパスナンバー(1-9)。
 *   マスターナンバー 11・22・33 は還元途中で出た場合そのまま採用する(現代流の一般則)。
 * - カバラ数秘術: 同じ計算だがマスターナンバーは 11・22 のみ採用(33は還元)という
 *   広く用いられる区別で実装。※流派差が大きい領域のため対応関係は要監修。
 *
 * 計算は完全に決定論的(LLM不使用)。意味テキストはLLMの物語生成の素材として
 * キーワードのみ持つ(長文はLayer0/1のプロンプトが担う)。
 */

export interface NumerologyResult {
  lifePathModern: number; // 現代数秘術(11/22/33残し)
  lifePathKabbalah: number; // カバラ数秘術(11/22残し)
  keywordsModern: string[];
  keywordsKabbalah: string[];
}

const NUMBER_KEYWORDS: Record<number, string[]> = {
  1: ["開拓", "自立", "リーダーシップ"],
  2: ["調和", "受容", "サポート"],
  3: ["創造", "表現", "楽観"],
  4: ["構築", "堅実", "継続"],
  5: ["変化", "自由", "冒険"],
  6: ["愛情", "責任", "調停"],
  7: ["探究", "分析", "精神性"],
  8: ["実現", "権威", "豊かさ"],
  9: ["共感", "包容", "完成"],
  11: ["直感", "霊感", "インスピレーション"],
  22: ["大器", "構想力", "現実化"],
  33: ["無償の愛", "献身", "教導"],
};

/** 桁和を取りながら還元する。keepMastersに含まれる数は途中で出たら確定 */
function reduce(n: number, keepMasters: number[]): number {
  while (n > 9 && !keepMasters.includes(n)) {
    n = String(n)
      .split("")
      .reduce((s, d) => s + Number(d), 0);
  }
  return n;
}

export function calculateNumerology(birthDate: Date): NumerologyResult {
  // birthDateはUTC深夜の暦日として保存されている(このリポジトリの慣例)
  const y = birthDate.getUTCFullYear();
  const m = birthDate.getUTCMonth() + 1;
  const d = birthDate.getUTCDate();
  const digitsSum = `${y}${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}`
    .split("")
    .reduce((s, c) => s + Number(c), 0);

  const modern = reduce(digitsSum, [11, 22, 33]);
  const kabbalah = reduce(digitsSum, [11, 22]);

  return {
    lifePathModern: modern,
    lifePathKabbalah: kabbalah,
    keywordsModern: NUMBER_KEYWORDS[modern] ?? [],
    keywordsKabbalah: NUMBER_KEYWORDS[kabbalah] ?? [],
  };
}

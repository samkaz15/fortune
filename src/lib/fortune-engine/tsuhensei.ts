/**
 * 通変星・十二運・算命学スターマッピング (CEO1 D-11 案B / 2026-07-12)
 *
 * 案B方針(CEO決定): 算命学の星は独自のフルスクラッチ命式計算ではなく、
 * 四柱推命エンジン(shichu.ts / setsuiri.ts)の干支から通変星・十二運を求め、
 * 高尾学館系で用いられる十大主星・十二大従星の名称へ対応づけて導出する。
 * (対応関係は一般に公刊されている標準的なもの: 貫索=比肩, 石門=劫財, 鳳閣=食神,
 *  調舒=傷官, 禄存=偏財, 司禄=正財, 車騎=偏官, 牽牛=正官, 龍高=偏印, 玉堂=印綬 /
 *  天貴=長生, 天恍=沐浴, 天南=冠帯, 天禄=建禄, 天将=帝旺, 天堂=衰, 天胡=病,
 *  天極=死, 天庫=墓, 天馳=絶, 天報=胎, 天印=養)
 *
 * ※蔵干(地支に含まれる十干)を用いた人体星図の完全再現はPhase2。
 *   本モジュールは天干どうし・天干×地支の範囲で導出する(監修者確認事項)。
 * 検証: lunar-pythonの十神・地勢計算との突き合わせ(golden.test.ts)。
 */

/** 十干の五行(0=木,1=火,2=土,3=金,4=水)と陰陽(true=陽) */
const STEM_ELEMENT = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4] as const;
const STEM_YANG = [true, false, true, false, true, false, true, false, true, false] as const;

export const TSUHENSEI_NAMES = [
  "比肩", "劫財", "食神", "傷官", "偏財", "正財", "偏官", "正官", "偏印", "印綬",
] as const;
export type TsuhenseiName = (typeof TSUHENSEI_NAMES)[number];

export const JUUNIUN_NAMES = [
  "長生", "沐浴", "冠帯", "建禄", "帝旺", "衰", "病", "死", "墓", "絶", "胎", "養",
] as const;
export type JuuniunName = (typeof JUUNIUN_NAMES)[number];

/**
 * 通変星: 日干から見た相手の干の関係。
 * 同じ五行=比肩/劫財、日干が生じる=食神/傷官、日干が剋す=偏財/正財、
 * 日干を剋す=偏官/正官、日干を生じる=偏印/印綬(いずれも同陰陽が前者)。
 */
export function tsuhenseiOf(dayStem: number, otherStem: number): TsuhenseiName {
  const de = STEM_ELEMENT[dayStem];
  const oe = STEM_ELEMENT[otherStem];
  const samePolarity = STEM_YANG[dayStem] === STEM_YANG[otherStem];
  const rel = ((oe - de) % 5 + 5) % 5; // 0=同,1=日干が生じる,2=日干が剋す,3=日干を剋す,4=日干を生じる
  const base = ([0, 2, 4, 6, 8] as const)[rel]; // 比肩,食神,偏財,偏官,偏印
  return TSUHENSEI_NAMES[base + (samePolarity ? 0 : 1)];
}

/**
 * 十二運: 日干×地支。陽干は長生から順行、陰干は逆行。
 * 長生の位置: 甲=亥, 丙=寅, 戊=寅, 庚=巳, 壬=申 / 乙=午, 丁=酉, 己=酉, 辛=子, 癸=卯
 * (火土同根の立場を採用。土を水と同視する流派もあるため要監修確認)
 */
const CHOUSEI_BRANCH = [11, 6, 2, 9, 2, 9, 5, 0, 8, 3] as const; // 十干順

export function juuniunOf(dayStem: number, branch: number): JuuniunName {
  const start = CHOUSEI_BRANCH[dayStem];
  const step = STEM_YANG[dayStem] ? branch - start : start - branch;
  return JUUNIUN_NAMES[((step % 12) + 12) % 12];
}

// ---------------- 算命学(高尾学館系の一般名称)へのマッピング ----------------

export const TSUHENSEI_TO_SHUSEI: Record<TsuhenseiName, string> = {
  比肩: "貫索星", 劫財: "石門星", 食神: "鳳閣星", 傷官: "調舒星", 偏財: "禄存星",
  正財: "司禄星", 偏官: "車騎星", 正官: "牽牛星", 偏印: "龍高星", 印綬: "玉堂星",
};

export const JUUNIUN_TO_JUUSEI: Record<JuuniunName, string> = {
  長生: "天貴星", 沐浴: "天恍星", 冠帯: "天南星", 建禄: "天禄星", 帝旺: "天将星",
  衰: "天堂星", 病: "天胡星", 死: "天極星", 墓: "天庫星", 絶: "天馳星",
  胎: "天報星", 養: "天印星",
};

/** 日干から見た他干の十大主星名 */
export function shuseiOf(dayStem: number, otherStem: number): string {
  return TSUHENSEI_TO_SHUSEI[tsuhenseiOf(dayStem, otherStem)];
}

/** 日干×地支の十二大従星名 */
export function juuseiOf(dayStem: number, branch: number): string {
  return JUUNIUN_TO_JUUSEI[juuniunOf(dayStem, branch)];
}

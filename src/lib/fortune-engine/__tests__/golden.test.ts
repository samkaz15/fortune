/**
 * 占術エンジン ゴールデンテスト (CEO1 D-0b / 2026-07-12)
 *
 * 実行: npm test  (node:test + tsx。CI・監修後の差し替え時に必ず通すこと)
 *
 * データの出自:
 * - 日柱(shichu): 独立した暦実装2系統(lunar-python 1.x / cnlunar 0.x)の完全一致値を採用。
 *   2系統が食い違ったケースは存在しない(生成スクリプトはassertで保証)。
 *   ※監修者には市販の万年暦での抜き取り確認を依頼中(D-9)。
 * - 姓名判断(seimei)・算命学(sanmei): 監修者の検証ケース(各10件)待ち。
 *   届き次第 SUPERVISOR_CASES を置き換え、test.todo を実テストへ昇格させる。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { JIKKAN, JUNISHI, stemBranchIndexFromDate } from "../shichu";

/** 甲子=0 とする60干支表記へ変換 */
function ganZhiOf(idx: number): string {
  return JIKKAN[idx % 10] + JUNISHI[idx % 12];
}

// ---- 日柱ゴールデンデータ(2系統の暦実装で相互検証済み・2026-07-12生成) ----
const DAY_PILLAR_GOLDEN: Array<{ date: string; expected: string }> = [
  { date: "1924-02-15", expected: "甲子" }, // 60年前の甲子日(長周期整合)
  { date: "1960-09-19", expected: "庚戌" },
  { date: "1984-01-30", expected: "癸亥" }, // 基準日前日
  { date: "1984-01-31", expected: "甲子" }, // ★日柱EPOCH(D-9で確定)
  { date: "1984-02-01", expected: "乙丑" }, // 基準日翌日
  { date: "1984-02-02", expected: "丙寅" }, // 旧EPOCH(誤り)がこの日。回帰防止
  { date: "1989-01-08", expected: "戊辰" },
  { date: "1995-08-24", expected: "丁亥" },
  { date: "2000-01-01", expected: "戊午" },
  { date: "2011-03-11", expected: "乙丑" },
  { date: "2024-05-01", expected: "乙丑" },
  { date: "2026-07-12", expected: "丁亥" },
];

test("日柱: ゴールデンデータ12件と一致する(D-9)", () => {
  for (const { date, expected } of DAY_PILLAR_GOLDEN) {
    const [y, m, d] = date.split("-").map(Number);
    const idx = stemBranchIndexFromDate(new Date(Date.UTC(y, m - 1, d)));
    assert.equal(ganZhiOf(idx), expected, `${date} の日柱`);
  }
});

test("日柱: 60日周期で完全に循環する", () => {
  const base = new Date(Date.UTC(1984, 0, 31));
  const later = new Date(Date.UTC(1984, 0, 31 + 60 * 100)); // 6000日後
  assert.equal(stemBranchIndexFromDate(base), stemBranchIndexFromDate(later));
});

// ---- 監修者ケース待ち(届き次第、実テストへ昇格) ----
test.todo("姓名判断: 監修者検証ケース10件(熊崎式・旧字体画数・霊数) — D-1〜D-4確定後");
test.todo("四柱推命: 年柱・月柱の節入り切替(立春前後の境界ケース) — D-6実装後");
test.todo("四柱推命: 時柱(出生時間あり)の検証ケース — D-7実装後");
test.todo("算命学: 方針確定(D-11 案A/B)後に検証ケースを定義");

// ---------------- D-6/D-7: 四柱(節入り・五虎遁・五鼠遁)ゴールデンテスト ----------------
// 出自: lunar-python の八字計算(sect=2)との突き合わせ(2026-07-12生成)。
// lunar-pythonはCST壁時計基準・本エンジンはJST壁時計基準だが、節入り境界から
// 1時間以上離れた日時なら同じ壁時計入力で四柱は一致する(下記ケースはすべて該当)。
import { calculateFourPillars } from "../shichu";
import { setsuiriOf, sexagenaryYearIndex, jstMomentOf } from "../setsuiri";

const FOUR_PILLAR_GOLDEN = [
  { y: 1984, m: 6, d: 15, h: 10, mi: 30, expected: { year: "甲子", month: "庚午", day: "庚辰", hour: "辛巳" } },
  { y: 1990, m: 11, d: 3, h: 23, mi: 30, expected: { year: "庚午", month: "丙戌", day: "壬申", hour: "壬子" } }, // 夜子時→日柱繰上げ
  { y: 1995, m: 2, d: 20, h: 0, mi: 15, expected: { year: "乙亥", month: "戊寅", day: "壬午", hour: "庚子" } }, // 早子時
  { y: 2000, m: 8, d: 8, h: 14, mi: 0, expected: { year: "庚辰", month: "甲申", day: "戊戌", hour: "己未" } },
  { y: 1975, m: 4, d: 10, h: 6, mi: 45, expected: { year: "乙卯", month: "庚辰", day: "丙戌", hour: "辛卯" } },
  { y: 2010, m: 12, d: 31, h: 12, mi: 0, expected: { year: "庚寅", month: "戊子", day: "乙卯", hour: "壬午" } }, // 年末=子月
  { y: 1988, m: 1, d: 15, h: 18, mi: 20, expected: { year: "丁卯", month: "癸丑", day: "己巳", hour: "癸酉" } }, // 立春前=前年扱い
  { y: 2026, m: 7, d: 12, h: 9, mi: 0, expected: { year: "丙午", month: "乙未", day: "丁亥", hour: "乙巳" } },
];

test("四柱: lunar-python検証済み8ケースと一致する(D-6/D-7)", () => {
  for (const c of FOUR_PILLAR_GOLDEN) {
    // birthDateは「UTC深夜の暦日」で保存される慣例に合わせる
    const birthDate = new Date(Date.UTC(c.y, c.m - 1, c.d));
    const birthTime = `${String(c.h).padStart(2, "0")}:${String(c.mi).padStart(2, "0")}`;
    const fp = calculateFourPillars(birthDate, birthTime);
    const label = `${c.y}-${c.m}-${c.d} ${birthTime}`;
    assert.equal(fp.year.stem + fp.year.branch, c.expected.year, `${label} 年柱`);
    assert.equal(fp.month.stem + fp.month.branch, c.expected.month, `${label} 月柱`);
    assert.equal(fp.day.stem + fp.day.branch, c.expected.day, `${label} 日柱`);
    assert.equal((fp.hour?.stem ?? "") + (fp.hour?.branch ?? ""), c.expected.hour, `${label} 時柱`);
  }
});

test("年柱: 立春の節入り時刻を1分またぐと年が切り替わる(JST境界)", () => {
  const risshun = setsuiriOf(2026, "立春"); // 2026-02-04T05:02:08+09:00
  assert.ok(risshun);
  const before = jstMomentOf(new Date(risshun!.getTime() - 60_000));
  const after = jstMomentOf(new Date(risshun!.getTime() + 60_000));
  assert.equal(sexagenaryYearIndex(before), (2025 - 1984) % 60, "立春1分前は乙巳(2025)年");
  assert.equal(sexagenaryYearIndex(after), (2026 - 1984) % 60, "立春1分後は丙午(2026)年");
});

test("時柱なし(出生時間未入力)は三柱として扱われる", () => {
  const fp = calculateFourPillars(new Date(Date.UTC(1990, 5, 15)));
  assert.equal(fp.hour, null);
  assert.equal(fp.dayAdvancedByLateRatHour, false);
});

// ---------------- D-2/D-3: 姓名判断(辞書引き・霊数)の機械検証 ----------------
// ※吉凶判定(D-4)と康熙補正の妥当性は監修者ケース待ち(上のtodo)。ここでは
//   「辞書の画数が正しく引けて五格の算式どおり合算されるか」の機械的検証のみ行う。
import { calculateSeimei } from "../seimei";

test("姓名判断: 旧字体変換込みで画数辞書から五格が計算される(D-2)", () => {
  // 山田太郎: 山3+田5 / 太4+郎9 (旧字体変換なし)
  const r = calculateSeimei("山田", "太郎");
  assert.equal(r.tenkaku, 8);
  assert.equal(r.chikaku, 13);
  assert.equal(r.jinkaku, 9); // 田5+太4
  assert.equal(r.soukaku, 21);
  assert.equal(r.gaikaku, 12); // 8+13-9
  assert.deepEqual(r.unknownChars, []);
  assert.deepEqual(r.reisuuApplied, { family: false, given: false });

  // 広沢恵→廣澤惠(旧字体変換): 廣15+澤16 / 惠12
  const k = calculateSeimei("広沢", "恵");
  assert.equal(k.tenkaku, 31); // 15+16
  assert.equal(k.chikaku, 12 + 1, "一字名は霊数+1(D-3)");
  assert.equal(k.soukaku, 43, "総格は霊数を含まない実画数");
  assert.equal(k.reisuuApplied.given, true);
});

test("姓名判断: 辞書に無い文字はunknownCharsに列挙される", () => {
  const r = calculateSeimei("山田", "太𩸽"); // 𩸽(ほっけ)は人名用外
  assert.ok(r.unknownChars.includes("𩸽"));
});

// ---------------- D-11案B: 通変星・十二運の機械検証 ----------------
// 出自: lunar-pythonの十神(ShiShen)・地勢(DiShi)計算との突き合わせ(2026-07-12生成)
import { tsuhenseiOf, juuniunOf } from "../tsuhensei";

const TSUHENSEI_GOLDEN = [
  { y: 1984, m: 6, d: 15, h: 10, mi: 30,
    yearShishen: "偏財", monthShishen: "比肩", timeShishen: "劫財",
    yearDishi: "死", monthDishi: "沐浴", dayDishi: "養" },
  { y: 1990, m: 11, d: 3, h: 14, mi: 30,
    yearShishen: "偏印", monthShishen: "偏財", timeShishen: "正財",
    yearDishi: "胎", monthDishi: "冠帯", dayDishi: "長生" },
  { y: 1995, m: 2, d: 20, h: 8, mi: 15,
    yearShishen: "傷官", monthShishen: "偏官", timeShishen: "食神",
    yearDishi: "建禄", monthDishi: "病", dayDishi: "胎" },
  { y: 2000, m: 8, d: 8, h: 14, mi: 0,
    yearShishen: "食神", monthShishen: "偏官", timeShishen: "劫財",
    yearDishi: "冠帯", monthDishi: "病", dayDishi: "墓" },
  { y: 1975, m: 4, d: 10, h: 6, mi: 45,
    yearShishen: "印綬", monthShishen: "偏財", timeShishen: "正財",
    yearDishi: "沐浴", monthDishi: "冠帯", dayDishi: "墓" },
  { y: 1988, m: 1, d: 15, h: 18, mi: 20,
    yearShishen: "偏印", monthShishen: "偏財", timeShishen: "偏財",
    yearDishi: "病", monthDishi: "墓", dayDishi: "帝旺" },
];

test("通変星・十二運: lunar-python検証済み6ケースと一致する(D-11案B)", () => {
  for (const c of TSUHENSEI_GOLDEN) {
    const birthDate = new Date(Date.UTC(c.y, c.m - 1, c.d));
    const birthTime = `${String(c.h).padStart(2, "0")}:${String(c.mi).padStart(2, "0")}`;
    const fp = calculateFourPillars(birthDate, birthTime);
    const ds = fp.day.index % 10;
    const label = `${c.y}-${c.m}-${c.d}`;
    assert.equal(tsuhenseiOf(ds, fp.year.index % 10), c.yearShishen, `${label} 年干通変星`);
    assert.equal(tsuhenseiOf(ds, fp.month.index % 10), c.monthShishen, `${label} 月干通変星`);
    assert.equal(tsuhenseiOf(ds, fp.hour!.index % 10), c.timeShishen, `${label} 時干通変星`);
    assert.equal(juuniunOf(ds, fp.year.index % 12), c.yearDishi, `${label} 年支十二運`);
    assert.equal(juuniunOf(ds, fp.month.index % 12), c.monthDishi, `${label} 月支十二運`);
    assert.equal(juuniunOf(ds, fp.day.index % 12), c.dayDishi, `${label} 日支十二運`);
  }
});

// ---------------- D-10: 大運の機械検証 ----------------
// 出自: lunar-pythonの大運計算との突き合わせ(2026-07-12生成)。
// 起運年月は日単位精度の差で±1ヶ月の揺れを許容(年は完全一致を要求)。
import { calculateTaiun } from "../taiun";

const TAIUN_GOLDEN = [
  { y: 1984, m: 6, d: 15, h: 10, mi: 30, gender: "male", forward: true, startYears: 7, startMonths: 3, first3: ["辛未", "壬申", "癸酉"] },
  { y: 1990, m: 11, d: 3, h: 14, mi: 30, gender: "female", forward: false, startYears: 8, startMonths: 6, first3: ["乙酉", "甲申", "癸未"] },
  { y: 1995, m: 2, d: 20, h: 8, mi: 15, gender: "male", forward: false, startYears: 5, startMonths: 2, first3: ["丁丑", "丙子", "乙亥"] },
  { y: 2000, m: 8, d: 8, h: 14, mi: 0, gender: "female", forward: false, startYears: 0, startMonths: 4, first3: ["癸未", "壬午", "辛巳"] },
  { y: 1988, m: 1, d: 15, h: 18, mi: 20, gender: "male", forward: false, startYears: 3, startMonths: 1, first3: ["壬子", "辛亥", "庚戌"] },
  { y: 1975, m: 4, d: 10, h: 6, mi: 45, gender: "female", forward: true, startYears: 8, startMonths: 9, first3: ["辛巳", "壬午", "癸未"] },
];

test("大運: lunar-python検証済み6ケースと一致する(D-10)", () => {
  for (const c of TAIUN_GOLDEN) {
    const birthDate = new Date(Date.UTC(c.y, c.m - 1, c.d));
    const birthTime = `${String(c.h).padStart(2, "0")}:${String(c.mi).padStart(2, "0")}`;
    const r = calculateTaiun(birthDate, birthTime, c.gender);
    const label = `${c.y}-${c.m}-${c.d} ${c.gender}`;
    assert.ok(r, `${label} 大運が計算できる`);
    assert.equal(r!.forward, c.forward, `${label} 順逆`);
    assert.equal(r!.startYears, c.startYears, `${label} 立運(年)`);
    assert.ok(Math.abs(r!.startMonths - c.startMonths) <= 1, `${label} 立運(月) ${r!.startMonths}≒${c.startMonths}`);
    assert.deepEqual(r!.pillars.slice(0, 3).map((p) => p.stem + p.branch), c.first3, `${label} 大運干支列`);
  }
});

test("大運: 性別不明の場合はnull(順逆が定義できない)", () => {
  assert.equal(calculateTaiun(new Date(Date.UTC(1990, 5, 15)), null, "other"), null);
  assert.equal(calculateTaiun(new Date(Date.UTC(1990, 5, 15)), null, null), null);
});

// ---------------- マルチインデックス(2026-07-12): 新指標の機械検証 ----------------
import { calculateNumerology } from "../indexes/numerology";
import { calculateAnimal, calculateGogyoBalance } from "../indexes/animal-gogyo";
import { calculateShibi } from "../indexes/shibi";
import { buildMultiIndexReading } from "../multi-index";

test("数秘術: 桁和還元とマスターナンバーの扱い(現代=11/22/33残し、カバラ=11/22残し)", () => {
  // 1990-11-03: 1+9+9+0+1+1+0+3=24 → 6
  const a = calculateNumerology(new Date(Date.UTC(1990, 10, 3)));
  assert.equal(a.lifePathModern, 6);
  assert.equal(a.lifePathKabbalah, 6);
  // 1990-11-08: 合計29 → 11(マスター。両流派とも残す)
  const b = calculateNumerology(new Date(Date.UTC(1990, 10, 8)));
  assert.equal(b.lifePathModern, 11);
  assert.equal(b.lifePathKabbalah, 11);
  // 1980-09-06: 合計33 → 現代=33残し / カバラ=3+3=6へ還元
  const c = calculateNumerology(new Date(Date.UTC(1980, 8, 6)));
  assert.equal(c.lifePathModern, 33);
  assert.equal(c.lifePathKabbalah, 6);
});

test("五行バランス: 1990-11-03 14:30 は火が最多・木が欠け", () => {
  // 庚午年 丙戌月 壬申日 丁未時 → 火3(丙丁午) 土2(戌未) 金2(庚申) 水1(壬) 木0
  const g = calculateGogyoBalance(new Date(Date.UTC(1990, 10, 3)), "14:30");
  assert.deepEqual(g.counts, { 木: 0, 火: 3, 土: 2, 金: 2, 水: 1 });
  assert.equal(g.dominant, "火");
  assert.equal(g.lacking, "木");
});

test("動物アーキタイプ: 壬申日(壬の長生=申)はこじか", () => {
  const a = calculateAnimal(new Date(Date.UTC(1990, 10, 3)));
  assert.equal(a.stage, "長生");
  assert.equal(a.animal, "こじか");
});

test("紫微斗数(簡易): 命宮・身宮の起宮式と旧暦月テーブル", () => {
  // 1990-11-03 = 旧暦9月(lunar-python検証値)。14:30 = 未時(7)
  // 命宮 = (寅2 + (9-1) - 7) mod 12 = 3 = 卯 / 身宮 = (2 + 8 + 7) mod 12 = 5 = 巳
  const s = calculateShibi(new Date(Date.UTC(1990, 10, 3)), "14:30");
  assert.ok(s);
  assert.equal(s!.lunarMonth, 9);
  assert.equal(s!.meiguu, "卯");
  assert.equal(s!.shinguu, "巳");
  // 出生時間なしはnull(時刻必須の占術)
  assert.equal(calculateShibi(new Date(Date.UTC(1990, 10, 3)), null), null);
});

test("マルチインデックス統合: 9指標が束ねられ、欠けても他が返る", () => {
  const full = buildMultiIndexReading({
    birthDate: new Date(Date.UTC(1990, 10, 3)),
    birthTime: "14:30",
    familyName: "山田",
    givenName: "太郎",
  });
  assert.equal(full.shichu.dayPillar, "壬申");
  assert.ok(full.shibi);
  assert.ok(full.indexCount >= 8);

  // 最小情報(生年月日のみ)でも落ちずに返る
  const minimal = buildMultiIndexReading({ birthDate: new Date(Date.UTC(1990, 10, 3)) });
  assert.equal(minimal.seimei, null);
  assert.equal(minimal.shibi, null); // 時刻なし
  assert.ok(minimal.indexCount >= 6);
});

// ---------------- Oracle KB + ビジネス占い(2026-07-12)の機械検証 ----------------
import { searchOracleKnowledge, clearOracleCache } from "../../oracle/knowledge-base";
import { buildShoubuCalendar, businessPartnerCompatibility, independenceTiming } from "../../business-fortune";

test("Oracle KB: 財布の質問でCEO直伝の知見がヒットする", () => {
  clearOracleCache();
  const hits = searchOracleKnowledge("ヴィトンの財布を買おうか迷ってるんですが金運どうですか");
  assert.ok(hits.length >= 1, "財布知見がヒットすること");
  assert.ok(hits.some((h) => h.brand === "ルイ・ヴィトン"));
  // 無関係な質問ではヒットしない
  assert.equal(searchOracleKnowledge("おはようございます").length, 0);
});

test("ビジネス占い: 勝負所カレンダーが根拠付きで月内の日を返す", () => {
  const days = buildShoubuCalendar(new Date(Date.UTC(1990, 10, 3)), 2026, 7);
  assert.ok(days.length >= 10, "1ヶ月で10日以上は何らかの判定が付く");
  for (const d of days) {
    assert.ok(d.reason.length > 0, "全日に占術根拠がある(GM9インサイト準拠)");
    assert.ok(["best", "good", "caution"].includes(d.rating));
  }
  assert.ok(days.some((d) => d.rating === "best" || d.rating === "good"));
});

test("ビジネス占い: パートナー相性が決定論的に力学の型を返す", () => {
  const a = businessPartnerCompatibility({
    myBirthDate: new Date(Date.UTC(1990, 10, 3)),
    myFamilyName: "山田", myGivenName: "太郎",
    partnerBirthDate: new Date(Date.UTC(1984, 5, 15)),
    partnerFamilyName: "広沢", partnerGivenName: "恵",
  });
  assert.ok(a.score >= 30 && a.score <= 96);
  assert.ok(a.dynamics.endsWith("型"));
  assert.match(a.reason, /日干の五行関係/);
  // 同一入力で同一出力(決定論)
  const b = businessPartnerCompatibility({
    myBirthDate: new Date(Date.UTC(1990, 10, 3)),
    myFamilyName: "山田", myGivenName: "太郎",
    partnerBirthDate: new Date(Date.UTC(1984, 5, 15)),
    partnerFamilyName: "広沢", partnerGivenName: "恵",
  });
  assert.deepEqual(a, b);
});

test("ビジネス占い: 独立タイミング診断が大運に基づく推奨を返す", () => {
  const t = independenceTiming(new Date(Date.UTC(1990, 10, 3)), "14:30", "female");
  assert.ok(t);
  assert.ok(["attack", "prepare", "hold"].includes(t!.recommendation));
  assert.match(t!.reason, /10年運/);
  assert.equal(independenceTiming(new Date(Date.UTC(1990, 10, 3)), null, "other"), null, "性別不明はnull(大運が立てられない)");
});

// ---------------- ヒーロー画像セレクタ(2026-07-12)の機械検証 ----------------
import { selectHeroImage, HERO_MANIFEST, HERO_FALLBACK } from "../../hero-image";

test("ヒーロー画像: 決定論的選択・全スコア帯で候補が存在・範囲外はフォールバック", () => {
  const noon = new Date(Date.UTC(2026, 6, 12, 3, 0)); // JST12時
  // 同じ日・同じスコアは常に同じ画像(チラつき防止)
  assert.equal(selectHeroImage(85, "2026-07-12", noon), selectHeroImage(85, "2026-07-12", noon));
  // 0-100の全スコアで、どの時間帯でも必ず何かが選ばれる(フォールバック含む)
  for (const h of [5, 12, 22]) {
    const t = new Date(Date.UTC(2026, 6, 12, (h - 9 + 24) % 24, 0));
    for (let s = 0; s <= 100; s += 10) {
      const img = selectHeroImage(s, "2026-07-12", t);
      assert.ok(img.startsWith("/character/"), `${s}点/${h}時: ${img}`);
    }
  }
  // マニフェストの整合: ファイル名重複なし
  assert.equal(new Set(HERO_MANIFEST.map((e) => e.file)).size, HERO_MANIFEST.length);
  assert.ok(HERO_FALLBACK.length > 0);
});

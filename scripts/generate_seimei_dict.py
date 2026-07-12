#!/usr/bin/env python3
"""
姓名判断用データ生成スクリプト (CEO1 D-2 / 2026-07-12)

生成物(src/lib/fortune-engine/data/):
  - kanji-strokes.json : 文字→画数。教育(grade1-6)+常用(8)+人名用(9,10)漢字と、その旧字体
  - kyujitai-map.json  : 新字体→旧字体(異なる場合のみ。419件)
  - seimei-review.json : 監修レビュー用の注記(画数フォールバックした旧字体の一覧など)

データソース:
  - 画数: KANJIDIC2派生の公開データ(github.com/davidluzgouveia/kanji-data)
  - 旧字体変換: kyujipy(常用漢字表・人名用漢字表ベースのBSDライセンス辞書)

既知の限界(監修者レビュー対象):
  1. KANJIDIC2の画数は現代の字典基準。熊崎式で用いる康熙字典基準の部首画数
     (氵=水4画、忄=心4画、阝(右)=邑7画、阝(左)=阜8画、辶=辵7画、艹=艸6画 等)の
     補正は未適用。補正が必要な字は radical-adjustments.json に監修者提供の値を
     投入すれば反映される構造(seimei.ts側で辞書より優先して参照)。
  2. 互換用コードポイントの旧字体(內・戶・靑など34字)は画数データが無いため
     新字体と同画数として扱う(seimei-review.json に列挙)。

再生成: python3 scripts/generate_seimei_dict.py
(要: pip install kyujipy / kanji.json をカレントに配置)
"""
import json
import kyujipy

KANJI_JSON = "kanji.json"  # KANJIDIC2派生データ
KANJIVG_DIR = "kanjivg-master/kanji"  # KanjiVG(筆順SVG)。1画=1<path>要素
OUT_DIR = "src/lib/fortune-engine/data"

import os
import re

def kanjivg_strokes(ch: str) -> int | None:
    """KanjiVGのSVGから実際の筆画数を数える(独立ソースによる検品用)"""
    path = os.path.join(KANJIVG_DIR, f"{ord(ch):05x}.svg")
    if not os.path.exists(path):
        return None
    return len(re.findall(r"<path ", open(path, encoding="utf-8").read()))

def main() -> None:
    kanji = json.load(open(KANJI_JSON))
    conv = kyujipy.KyujitaiConverter()

    targets = {ch: v for ch, v in kanji.items() if v.get("grade") in (1, 2, 3, 4, 5, 6, 8, 9, 10)}

    kyu_map: dict[str, str] = {}
    strokes: dict[str, int] = {}
    fallback_kyujitai: list[dict] = []
    kanjivg_overrides: list[dict] = []  # KANJIDICとKanjiVGの不一致(KanjiVG採用)

    def resolve(ch: str, kanjidic_val: int | None, shin_base: int | None) -> int:
        """検品ルール: ①KanjiVGの筆画数を最優先 ②KanjiVGが無い旧字体で
        KANJIDIC値が新字体から3画以上乖離する場合は康熙式混入を疑い新字体値へ
        フォールバック(要監修) ③それ以外はKANJIDIC値"""
        kvg = kanjivg_strokes(ch)
        if kvg is not None:
            if kanjidic_val is not None and kvg != kanjidic_val:
                kanjivg_overrides.append({"char": ch, "kanjidic": kanjidic_val, "adopted_kanjivg": kvg})
            return kvg
        if kanjidic_val is None:
            fallback_kyujitai.append({"kyujitai": ch, "assumedStrokes": shin_base, "reason": "no_data"})
            return shin_base or 0
        if shin_base is not None and abs(kanjidic_val - shin_base) >= 3:
            fallback_kyujitai.append({"kyujitai": ch, "kanjidic": kanjidic_val, "assumedStrokes": shin_base,
                                      "reason": "suspected_kouki_count"})
            return shin_base
        return kanjidic_val

    # パス1: 新旧マッピングを先に確定(郞のように旧字体自身が人名用漢字として
    # targetsに含まれるケースがあるため、逆引き表を作ってから解決する)
    for ch in targets:
        kyu = conv.shinjitai_to_kyujitai(ch)
        if kyu != ch and len(kyu) == 1:
            kyu_map[ch] = kyu
    reverse = {kyu: shin for shin, kyu in kyu_map.items()}

    # パス2: 新字体(=どの字の旧字体でもない文字)を先に解決
    for ch, v in targets.items():
        if ch in reverse:
            continue
        strokes[ch] = resolve(ch, v["strokes"], None)

    # パス3: 旧字体を、対応する新字体の画数をshin_baseとして解決
    for shin, kyu in kyu_map.items():
        strokes[kyu] = resolve(kyu, kanji.get(kyu, {}).get("strokes"), strokes.get(shin))

    review = {
        "generatedAt": "2026-07-12",
        "note": "監修者レビュー用。fallbackKyujitaiのassumedStrokesは新字体からのフォールバック値、"
                "kanjivgOverridesはKANJIDICとKanjiVG(筆順データ)の不一致でKanjiVG筆画数を採用した文字。"
                "いずれも正しい画数が異なる場合は radical-adjustments.json へ記入すれば最優先で反映される。",
        "fallbackKyujitai": fallback_kyujitai,
        "kanjivgOverrides": kanjivg_overrides,
    }

    json.dump(kyu_map, open(f"{OUT_DIR}/kyujitai-map.json", "w"), ensure_ascii=False, indent=0, sort_keys=True)
    json.dump(strokes, open(f"{OUT_DIR}/kanji-strokes.json", "w"), ensure_ascii=False, indent=0, sort_keys=True)
    json.dump(review, open(f"{OUT_DIR}/seimei-review.json", "w"), ensure_ascii=False, indent=1)
    print(f"kanji-strokes: {len(strokes)}字 / kyujitai-map: {len(kyu_map)}件 / "
          f"フォールバック: {len(fallback_kyujitai)}件 / KanjiVG補正: {len(kanjivg_overrides)}件")

if __name__ == "__main__":
    main()

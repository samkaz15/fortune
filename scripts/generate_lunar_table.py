#!/usr/bin/env python3
"""
旧暦月テーブル生成スクリプト (紫微斗数・簡易実装用 / 2026-07-12)

生成物: src/lib/fortune-engine/data/lunar-months-1900-2100.json
  [{ "start": "1900-01-31", "year": 1900, "month": 1, "leap": false }, ...]
  各旧暦月の開始日(新暦)・旧暦年・旧暦月番号・閏月フラグ。

用途: 紫微斗数の命宮・身宮の算出には「旧暦の生まれ月」が必要(節入りベースの
四柱の月とは異なる)。このテーブルで新暦生年月日→旧暦月を引く。
閏月の扱いは流派差があるため(前月扱い/月の前半後半で分割等)、簡易実装では
「閏月は本月と同じ月番号として扱う」— 要監修事項。

データソース: lunar-python(生成時にcnlunarと突き合わせ検証)。
再生成: python3 scripts/generate_lunar_table.py
"""
import json
import datetime as dt
from lunar_python import Lunar, Solar

OUT = "src/lib/fortune-engine/data/lunar-months-1900-2100.json"

def main() -> None:
    rows = []
    # 1900/1/1から2101/2/1まで日を歩き、旧暦月が変わる日を記録する
    d = dt.date(1900, 1, 1)
    end = dt.date(2101, 2, 1)
    prev_key = None
    while d < end:
        lunar = Solar.fromYmd(d.year, d.month, d.day).getLunar()
        month = lunar.getMonth()  # 閏月は負値で返る
        key = (lunar.getYear(), month)
        if key != prev_key:
            rows.append({
                "start": d.isoformat(),
                "year": lunar.getYear(),
                "month": abs(month),
                "leap": month < 0,
            })
            prev_key = key
        d += dt.timedelta(days=1)
    json.dump(rows, open(OUT, "w"), ensure_ascii=False, indent=0)
    print(f"{len(rows)}ヶ月分を生成")

if __name__ == "__main__":
    main()

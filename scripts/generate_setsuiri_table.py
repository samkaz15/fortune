#!/usr/bin/env python3
"""
節入りテーブル生成スクリプト (CEO1 D-6 / 2026-07-12)

生成物: src/lib/fortune-engine/data/setsuiri-1900-2100.json
  { "1900": { "小寒": "1900-01-06T...+09:00", ..., "大雪": "..." }, ... }
  各年12節(小寒・立春・啓蟄・清明・立夏・芒種・小暑・立秋・白露・寒露・立冬・大雪)。
  中気(雨水・春分等)は月切替に使わないため含めない。

データソース: lunar-python(6tail氏の暦計算ライブラリ)。
  同ライブラリは中国標準時(CST=UTC+8)基準のため、+1時間して日本標準時(JST=UTC+9)へ変換。
  ※節入り時刻が23時台の場合、CST→JSTで日付が翌日に繰り上がるケースがあり、
    この変換を怠ると日本基準の四柱と1日ズレる。監修者には市販の運命暦との
    抜き取り照合を依頼する(特に日付繰り上がりが発生する年)。

再生成: python3 scripts/generate_setsuiri_table.py (要: pip install lunar_python)
"""
import json
import datetime as dt
from lunar_python import Solar

# lunar-python(簡体字)→ 日本語名
NAME_MAP = {
    "小寒": "小寒", "立春": "立春", "惊蛰": "啓蟄", "清明": "清明",
    "立夏": "立夏", "芒种": "芒種", "小暑": "小暑", "立秋": "立秋",
    "白露": "白露", "寒露": "寒露", "立冬": "立冬", "大雪": "大雪",
}
OUT = "src/lib/fortune-engine/data/setsuiri-1900-2100.json"

def main() -> None:
    result: dict[str, dict[str, str]] = {}
    carry_over_days = 0
    for year in range(1900, 2101):
        table = Solar.fromYmd(year, 7, 1).getLunar().getJieQiTable()
        entry: dict[str, str] = {}
        for cn, ja in NAME_MAP.items():
            if cn not in table:
                raise RuntimeError(f"{year}: {cn} が節気テーブルに無い")
            s = table[cn]
            cst = dt.datetime(s.getYear(), s.getMonth(), s.getDay(), s.getHour(), s.getMinute(), s.getSecond())
            jst = cst + dt.timedelta(hours=1)
            if jst.date() != cst.date():
                carry_over_days += 1
            entry[ja] = jst.strftime("%Y-%m-%dT%H:%M:%S+09:00")
        # 小寒は当該暦年1月のものであることを検証(前年12月や翌年のものを拾っていないか)
        assert entry["小寒"].startswith(f"{year}-01"), (year, entry["小寒"])
        assert entry["立春"].startswith(f"{year}-02"), (year, entry["立春"])
        result[str(year)] = entry
    json.dump(result, open(OUT, "w"), ensure_ascii=False, indent=0)
    print(f"{len(result)}年分を生成 / CST→JST変換で日付が繰り上がった節入り: {carry_over_days}件")

if __name__ == "__main__":
    main()

"use client";

/**
 * 生年月日入力の共通コンポーネント(2026-07-11 Phase1指示C・要件⑨)。
 *
 * 背景: ネイティブ<input type="date">はOS/ブラウザごとに描画が大きく異なり
 * (iOS Safariは空値時の高さ・プレースホルダーが不安定、appearance-noneは
 * 標準UIごと消えて空欄に見える等)、統一されたUIを保証できなかった。
 * 年/月/日を独立したセレクトボックスにすることで、全OS・全ブラウザで
 * 同一の見た目を保証する。
 */
import { useMemo } from "react";

export interface BirthDateSelectProps {
  /** "YYYY-MM-DD" 形式。未確定(一部未選択)の場合は "" */
  value: string;
  onChange: (value: string) => void;
  /** 選択可能な最古年(デフォルト1940) */
  minYear?: number;
  className?: string;
}

const SELECT_CLASS =
  "h-12 w-full rounded-xl border border-ink-700 bg-ink-950 px-3 text-sm text-paper-100 outline-none focus:border-gold-500";

function daysInMonth(year: number, month: number): number {
  // month: 1-12。0日目=前月末日を利用した標準的な日数取得
  return new Date(year, month, 0).getDate();
}

export function BirthDateSelect({ value, onChange, minYear = 1940, className }: BirthDateSelectProps) {
  const currentYear = new Date().getFullYear();

  const [yStr, mStr, dStr] = value ? value.split("-") : ["", "", ""];
  const y = yStr ? Number(yStr) : null;
  const m = mStr ? Number(mStr) : null;
  const d = dStr ? Number(dStr) : null;

  const years = useMemo(() => {
    const arr: number[] = [];
    for (let year = currentYear; year >= minYear; year--) arr.push(year);
    return arr;
  }, [currentYear, minYear]);

  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);

  const days = useMemo(() => {
    const maxDay = y && m ? daysInMonth(y, m) : 31;
    return Array.from({ length: maxDay }, (_, i) => i + 1);
  }, [y, m]);

  function emit(nextY: number | null, nextM: number | null, nextD: number | null) {
    // 月/年の変更で日が実日数を超える場合はリセット(要件⑨の仕様どおり)
    let safeD = nextD;
    if (nextY && nextM && nextD) {
      const max = daysInMonth(nextY, nextM);
      if (nextD > max) safeD = null;
    }
    if (nextY && nextM && safeD) {
      const mm = String(nextM).padStart(2, "0");
      const dd = String(safeD).padStart(2, "0");
      onChange(`${nextY}-${mm}-${dd}`);
    } else {
      onChange("");
    }
  }

  return (
    <div className={`grid grid-cols-3 gap-2 ${className ?? ""}`}>
      <select
        aria-label="生まれ年"
        className={SELECT_CLASS}
        value={y ?? ""}
        onChange={(e) => emit(e.target.value ? Number(e.target.value) : null, m, d)}
      >
        <option value="">年</option>
        {years.map((year) => (
          <option key={year} value={year}>
            {year}年
          </option>
        ))}
      </select>
      <select
        aria-label="生まれ月"
        className={SELECT_CLASS}
        value={m ?? ""}
        onChange={(e) => emit(y, e.target.value ? Number(e.target.value) : null, d)}
      >
        <option value="">月</option>
        {months.map((month) => (
          <option key={month} value={month}>
            {month}月
          </option>
        ))}
      </select>
      <select
        aria-label="生まれ日"
        className={SELECT_CLASS}
        value={d ?? ""}
        onChange={(e) => emit(y, m, e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">日</option>
        {days.map((day) => (
          <option key={day} value={day}>
            {day}日
          </option>
        ))}
      </select>
    </div>
  );
}

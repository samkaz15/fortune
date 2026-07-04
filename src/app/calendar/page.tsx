"use client";

import { useEffect, useState } from "react";

interface DayScore {
  date: string;
  wave: number;
}

interface CalendarData {
  year: number;
  month: number;
  days: DayScore[];
  monthlyAverage: number;
  monthlyAdvice: string;
}

function scoreColor(wave: number): string {
  if (wave >= 80) return "bg-gold-500 text-ink-950";
  if (wave >= 50) return "bg-ink-700 text-paper-100";
  return "bg-ink-800 text-paper-400";
}

/**
 * 画面遷移設計書 Level2「運気カレンダー」の実装(CL16)。
 * 月次の運気推移を一覧表示し、「毎月やるべきこと」を1文で添える。
 */
export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/calendar?year=${year}&month=${month}`)
      .then(async (res) => {
        if (res.status === 401) {
          setError("ログインすると、あなた専用のカレンダーが見られるよ。");
          return null;
        }
        if (res.status === 409) {
          setError("プロフィール(生年月日)の登録が必要だよ。");
          return null;
        }
        return res.json();
      })
      .then((d) => d && setData(d))
      .finally(() => setLoading(false));
  }, [year, month]);

  function changeMonth(delta: number) {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    }
    setMonth(newMonth);
    setYear(newYear);
  }

  return (
    <div className="flex flex-col gap-5 px-5 pt-4">
      <div className="flex items-center justify-between">
        <button onClick={() => changeMonth(-1)} className="px-2 text-paper-400">
          ＜
        </button>
        <h1 className="font-display text-lg text-paper-50">
          {year}年 {month}月の運気カレンダー
        </h1>
        <button onClick={() => changeMonth(1)} className="px-2 text-paper-400">
          ＞
        </button>
      </div>

      {loading && <p className="text-center text-sm text-paper-400">読み込み中…</p>}
      {error && (
        <div className="rounded-card border border-gold-500/40 bg-ink-900/70 p-4 text-center text-sm text-paper-200">
          {error}
        </div>
      )}

      {data && (
        <>
          <div className="rounded-card border border-gold-500/40 bg-ink-900/60 p-4">
            <p className="mb-1 text-xs text-paper-400">今月のやるべきこと</p>
            <p className="text-sm leading-relaxed text-paper-100">{data.monthlyAdvice}</p>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {data.days.map((d) => {
              const day = Number(d.date.slice(-2));
              return (
                <div
                  key={d.date}
                  className={`flex aspect-square flex-col items-center justify-center rounded-lg text-xs ${scoreColor(d.wave)}`}
                >
                  <span>{day}</span>
                  <span className="text-[9px] opacity-80">{d.wave}</span>
                </div>
              );
            })}
          </div>

          <p className="text-center text-xs text-paper-600">月間平均 {data.monthlyAverage}点</p>
        </>
      )}
    </div>
  );
}

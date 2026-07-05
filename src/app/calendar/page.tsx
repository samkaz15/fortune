"use client";

/**
 * 風水カレンダー画面(CEO要求 2026-07-05)
 * - 暦注下段 × 本人の四柱推命で日別判定(/api/calendar/fengshui)
 * - 月内いちばんの吉日=黄色 / 心が揺れやすい注意日=淡い赤 / 注意日を含む週=薄赤の行
 * - 日タップで暦の吉日名+「あなたへのポイント」を表示。凡例をカレンダー下に記載
 */
import { useEffect, useState, useCallback } from "react";

interface FDay {
  date: string;
  kanshi: string;
  good: string[];
  bad: string[];
  personalPoints: string[];
  personalCautions: string[];
  score: number;
  isBest: boolean;
  isCaution: boolean;
}
interface FMonth {
  month: string;
  days: FDay[];
  cautionWeeks: number[];
}

const WD = ["日", "月", "火", "水", "木", "金", "土"];

export default function FengshuiCalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<FMonth | null>(null);
  const [selected, setSelected] = useState<FDay | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const res = await fetch(`/api/calendar/fengshui?year=${year}&month=${month}`);
    const d = await res.json();
    if (res.ok) {
      setData(d);
      setSelected(null);
    } else if (d.error === "AUTH_REQUIRED") {
      setError("風水カレンダーを見るにはログインしてください。");
    } else if (d.error === "PROFILE_REQUIRED") {
      setError("生年月日の登録が必要です。マイページから登録してください。");
    } else {
      setError("読み込みに失敗しました。");
    }
  }, [year, month]);

  useEffect(() => {
    load();
  }, [load]);

  function move(diff: number) {
    let m = month + diff;
    let y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setYear(y); setMonth(m);
  }

  const firstDow = new Date(year, month - 1, 1).getDay();
  const cells: (FDay | null)[] = data ? [...Array(firstDow).fill(null), ...data.days] : [];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (FDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 pb-24 pt-8 text-paper-100">
      <h1 className="mb-1 text-center text-lg font-bold text-gold-400">風水カレンダー</h1>
      <p className="mb-5 text-center text-[11px] text-paper-500">
        暦の吉日と、あなたの生まれ持った流れを重ねて
        <br />
        「あなたにとって」いい日を見ています
      </p>

      {error && <p className="mb-4 rounded-card border border-ink-700 bg-ink-900/60 p-4 text-center text-xs text-paper-300">{error}</p>}

      {data && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <button onClick={() => move(-1)} className="rounded-full border border-ink-700 px-4 py-1.5 text-xs text-paper-300">←</button>
            <p className="text-sm font-bold text-paper-100">{year}年 {month}月</p>
            <button onClick={() => move(1)} className="rounded-full border border-ink-700 px-4 py-1.5 text-xs text-paper-300">→</button>
          </div>

          <div className="rounded-card border border-ink-700 bg-ink-900/60 p-2">
            <div className="grid grid-cols-7 text-center">
              {WD.map((w, i) => (
                <span key={w} className={`py-1 text-[10px] font-bold ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-300" : "text-paper-500"}`}>{w}</span>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} className={`grid grid-cols-7 rounded-lg ${data.cautionWeeks.includes(wi) ? "bg-red-500/5" : ""}`}>
                {week.map((d, di) =>
                  d ? (
                    <button
                      key={d.date}
                      onClick={() => setSelected(d)}
                      className={`m-0.5 flex h-11 flex-col items-center justify-center rounded-lg text-xs font-bold transition ${
                        d.isBest
                          ? "bg-yellow-400 text-ink-950 shadow-[0_0_10px_-2px_rgba(250,204,21,.7)]"
                          : d.isCaution
                            ? "bg-red-400/25 text-red-200"
                            : "text-paper-200 hover:bg-ink-800"
                      } ${selected?.date === d.date ? "ring-2 ring-gold-500" : ""}`}
                    >
                      {Number(d.date.slice(-2))}
                      {d.good.length > 0 && !d.isBest && <span className="text-[8px] leading-none text-gold-400">●</span>}
                    </button>
                  ) : (
                    <span key={`e${wi}-${di}`} />
                  )
                )}
              </div>
            ))}
          </div>

          {/* 凡例(CEO要求: 黄色と赤色の説明を下に記載) */}
          <div className="mt-3 rounded-card border border-ink-700 bg-ink-900/40 p-4 text-[11px] leading-relaxed text-paper-400">
            <p className="flex items-center gap-2">
              <span className="inline-block h-3.5 w-3.5 flex-none rounded bg-yellow-400" />
              <span><b className="text-paper-200">黄色</b> … 暦の吉日とあなたの流れが重なった、この月いちばんの開運日。新しいこと・大事なことはこの日に。</span>
            </p>
            <p className="mt-2 flex items-center gap-2">
              <span className="inline-block h-3.5 w-3.5 flex-none rounded bg-red-400/40" />
              <span><b className="text-paper-200">淡い赤</b> … 心が揺れやすい注意日(薄い赤の行は、その日を含む注意の週)。大事な決断は避けて、休息と準備の日に。</span>
            </p>
          </div>

          {/* 日別詳細 */}
          {selected && (
            <div className="mt-3 rounded-card border border-ink-700 bg-ink-900/60 p-5">
              <p className="text-sm font-bold text-paper-100">
                {Number(selected.date.slice(5, 7))}月{Number(selected.date.slice(-2))}日
                {selected.isBest && <span className="ml-2 rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] text-ink-950">この月いちばんの開運日</span>}
                {selected.isCaution && <span className="ml-2 rounded-full bg-red-400/30 px-2 py-0.5 text-[10px] text-red-200">注意日</span>}
              </p>
              {selected.good.length > 0 && (
                <p className="mt-2 text-xs text-gold-300">暦の吉日: {selected.good.join(" / ")}</p>
              )}
              {selected.bad.length > 0 && (
                <p className="mt-1 text-xs text-red-300">暦の注意: {selected.bad.join(" / ")}</p>
              )}
              {selected.personalPoints.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] font-bold text-paper-500">あなたへのポイント</p>
                  {selected.personalPoints.map((p) => (
                    <p key={p} className="mt-1 text-xs leading-relaxed text-paper-200">・{p}</p>
                  ))}
                </div>
              )}
              {selected.personalCautions.map((p) => (
                <p key={p} className="mt-2 text-xs leading-relaxed text-red-200">・{p}</p>
              ))}
              {selected.good.length === 0 && selected.bad.length === 0 && selected.personalPoints.length === 0 && selected.personalCautions.length === 0 && (
                <p className="mt-2 text-xs text-paper-400">特別な印のない、穏やかな一日です。淡々と積み上げるのに向いています。</p>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}

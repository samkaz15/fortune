"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ScoreOrb } from "@/components/ScoreOrb";

interface Report {
  reportDate: string;
  score: number;
  stars: number;
  keywords: { userTheme: string; environment: string; fortune: string };
  summary: string;
  cautions: string[];
  advice: string;
  todayAction: string;
}

/**
 * 「今日の意思決定レポート」画面(CEO_UPDATE 2026-07-03の6項目フォーマット)。
 * ①スコア(★+100点) ②キーワード3つ ③総合要約 ④注意3項目 ⑤総合アドバイス ⑥今日やるべき1つの行動
 */
export default function ReportPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<{ message: string; href: string; label: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 位置情報は任意(拒否されてもレポートは生成される)
    const fetchReport = (coords?: { lat: number; lon: number }) => {
      const qs = coords ? `?lat=${coords.lat}&lon=${coords.lon}` : "";
      fetch(`/api/report/today${qs}`)
        .then(async (res) => {
          if (res.status === 401) {
            setError({ message: "レポートを見るにはログインが必要だよ。", href: "/auth/login", label: "ログインする" });
            return null;
          }
          if (res.status === 409) {
            setError({ message: "先に名前と生年月日の登録が必要だよ。", href: "/auth/signup", label: "登録する" });
            return null;
          }
          return res.json();
        })
        .then((d) => d && setReport(d))
        .finally(() => setLoading(false));
    };

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchReport({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => fetchReport(),
        { timeout: 3000 }
      );
    } else {
      fetchReport();
    }
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 pt-24">
        <p className="animate-pulse text-sm text-paper-400">今日のレポートをまとめてるよ…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 px-5 pt-24 text-center">
        <p className="text-sm text-paper-200">{error.message}</p>
        <Link href={error.href} className="rounded-full bg-gold-500 px-6 py-2.5 text-sm font-bold text-ink-950">
          {error.label}
        </Link>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="flex flex-col gap-6 px-5 pt-4 pb-8">
      <h1 className="font-display text-lg text-paper-50">今日の意思決定レポート</h1>

      {/* ① 運勢スコア */}
      <section className="flex flex-col items-center gap-2">
        <ScoreOrb score={report.score} size={130} />
        <p className="text-lg tracking-widest text-gold-400" aria-label={`5段階中${report.stars}`}>
          {"★".repeat(report.stars)}
          <span className="text-ink-700">{"★".repeat(5 - report.stars)}</span>
        </p>
      </section>

      {/* ② キーワード3つ */}
      <section className="grid grid-cols-3 gap-2">
        <KeywordCard label="あなたのテーマ" value={report.keywords.userTheme} />
        <KeywordCard label="今日の空気" value={report.keywords.environment} />
        <KeywordCard label="運気" value={report.keywords.fortune} />
      </section>

      {/* ③ 総合要約 */}
      <section className="rounded-card border border-gold-500/40 bg-ink-900/60 p-5 shadow-lantern">
        <h2 className="mb-2 text-xs font-bold text-gold-400">今日の行動方針</h2>
        <p className="text-sm leading-relaxed text-paper-100">{report.summary}</p>
      </section>

      {/* ④ 注意ポイント3つ */}
      <section className="rounded-card border border-torii-500/40 bg-ink-900/50 p-5">
        <h2 className="mb-3 text-xs font-bold text-torii-500">今日、気をつけること</h2>
        <ul className="space-y-2">
          {report.cautions.map((c, i) => (
            <li key={i} className="flex gap-2 text-sm text-paper-100">
              <span className="text-torii-500">・</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ⑤ 総合アドバイス */}
      <section className="rounded-card border border-ink-700 bg-ink-900/50 p-5">
        <h2 className="mb-2 text-xs font-bold text-paper-400">糸町の少年からのアドバイス</h2>
        <p className="text-sm leading-relaxed text-paper-100">{report.advice}</p>
      </section>

      {/* ⑥ 今日やるべき行動(1つだけ) */}
      <section className="rounded-card border-2 border-gold-500 bg-ink-900/70 p-5 text-center">
        <h2 className="mb-2 text-xs font-bold text-gold-400">今日やるべき、たった1つのこと</h2>
        <p className="font-display text-base leading-relaxed text-paper-50">{report.todayAction}</p>
      </section>

      <Link
        href="/consult"
        className="rounded-full border border-gold-500/50 py-3 text-center text-sm font-bold text-gold-400"
      >
        もっと詳しく相談する
      </Link>
    </div>
  );
}

function KeywordCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-card border border-ink-700 bg-ink-900/40 px-2 py-3">
      <span className="text-[10px] text-paper-600">{label}</span>
      <span className="font-display text-sm text-paper-50">{value}</span>
    </div>
  );
}

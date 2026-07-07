"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ScoreOrb } from "@/components/ScoreOrb";
import { GlassMosaic, ScrollProgress, ShareRow, AffSlot, DramaticLoading, PrimaryButton } from "@/components/ui-common";

interface Report {
  reportDate: string;
  score: number;
  stars: number;
  keywords: { userTheme: string; environment: string; fortune: string };
  summary: string;
  cautions: string[];
  advice: string;
  todayAction: string;
  remainingFreeQuota?: number;
  isSubscribed?: boolean;
}

/**
 * 「今日の意思決定レポート」画面(CEO_UPDATE 2026-07-03の6項目フォーマット)。
 * ①スコア(★+100点) ②キーワード3つ ③総合要約 ④注意3項目 ⑤総合アドバイス ⑥今日やるべき1つの行動
 */
export default function ReportPageClient() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<{ message: string; href: string; label: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"today" | "week" | "month" | "nextMonth">("today");
  // 期間ごとの取得結果をキャッシュ(タブ切替を即時反応に / 2026-07-07 速度改善)
  const cacheRef = useRef<Record<string, Report>>({});

  useEffect(() => {
    const cached = cacheRef.current[period];
    if (cached) {
      setReport(cached);
      setLoading(false);
      return; // 再フェッチ不要(日付が変わるまで結果は不変)
    }
    // 位置情報は任意(拒否されてもレポートは生成される)
    setLoading(true);
    const startedAt = Date.now(); // 最低表示時間の計測開始(監査Phase1 Critical対応)
    const MIN_LOADING_MS = 2000;
    const fetchReport = (coords?: { lat: number; lon: number }) => {
      const qs = coords
        ? `?period=${period}&lat=${coords.lat}&lon=${coords.lon}`
        : `?period=${period}`;
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
          if (!res.ok) {
            // 500等: クラッシュさせず再試行を案内(2026-07-07 障害対応)
            setError({ message: "レポートの生成に失敗しました。少し時間をおいて、もう一度開いてみてください。", href: "/report", label: "再読み込み" });
            return null;
          }
          return res.json();
        })
        .then((d) => {
          // 想定形かを検証してから表示(不正データでの真っ白クラッシュを防ぐ)
          if (d && d.keywords && typeof d.score === "number") { cacheRef.current[period] = d; setReport(d); }
          else if (d) setError({ message: "レポートの生成に失敗しました。少し時間をおいて、もう一度開いてみてください。", href: "/report", label: "再読み込み" });
        })
        .catch(() => setError({ message: "通信に失敗しました。電波の良いところで再読み込みしてください。", href: "/report", label: "再読み込み" }))
        .finally(() => {
          // API応答が速くても最低2秒は演出を見せ、遅い場合は待たずにすぐ結果を表示する
          const elapsed = Date.now() - startedAt;
          const remaining = Math.max(0, MIN_LOADING_MS - elapsed);
          setTimeout(() => setLoading(false), remaining);
        });
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
  }, [period]);

  if (loading) {
    return <DramaticLoading messages={["糸をたどっています、、", "今日の流れと重ねています（65%）", "見えました。"]} />;
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
      <ScrollProgress />
      {/* 今日の運勢ヒーロー(CEO指定画像 2026-07-07) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/character/report_hero.jpg" alt="糸町の少年" className="mb-3 h-36 w-full rounded-card border border-ink-700 object-cover shadow-lantern" style={{ objectPosition: "center 30%" }} />
      <h1 className="font-display text-lg text-paper-50">今日の運勢</h1>
      <p className="mt-1 text-center text-[11px] text-paper-500">今日の運勢を占って自分を確認</p>
      {/* 期間タブ(UI仕様v5): 同UI・同ロジック。有料会員のみ全文、無料部分以降はモザイク */}
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {(["today", "week", "month", "nextMonth"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`rounded-full border py-1.5 text-[11px] font-bold transition ${period === p ? "border-gold-500 bg-gold-500/10 text-gold-400" : "border-ink-700 text-paper-400"}`}
          >
            {p === "today" ? "今日" : p === "week" ? "今週" : p === "month" ? "今月" : "来月"}
          </button>
        ))}
      </div>

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

      <AffSlot label="AD SLOT 2" />

      {/* ⑤⑥ 詳細部: 有料会員のみ全文。無料/非会員はGlassモザイク(UI仕様v5) */}
      {report.isSubscribed ? (
        <>
          <section className="rounded-card border border-ink-700 bg-ink-900/50 p-5">
            <h2 className="mb-2 text-xs font-bold text-paper-400">糸町の少年からのアドバイス</h2>
            <p className="text-sm leading-relaxed text-paper-100">{report.advice}</p>
          </section>
          <section className="rounded-card border-2 border-gold-500 bg-ink-900/70 p-5 text-center">
            <h2 className="mb-2 text-xs font-bold text-gold-400">今日やるべき、たった1つのこと</h2>
            <p className="font-display text-base leading-relaxed text-paper-50">{report.todayAction}</p>
          </section>
        </>
      ) : (
        <GlassMosaic
          message="ここから先(アドバイスと、やるべきたった1つのこと)は会員限定です。"
          ctaLabel="もっと占う"
          ctaHref="/plans"
          note="※初月500円 月額980円"
        >
          <p className="text-sm leading-relaxed">{report.advice}</p>
          <p className="mt-3 text-sm leading-relaxed">{report.todayAction}</p>
        </GlassMosaic>
      )}

      <ShareRow text={`今日の運勢は${report.score}点。「${report.keywords.userTheme}」の日 — 糸町の少年`} />

      {/* CV1: ここから先の核心(モザイク寸止め) + CV3: 感情CTA */}
      <section className="relative overflow-hidden rounded-card border border-gold-500/40" style={{ minHeight: 210 }}>
        <div className="p-5 text-sm leading-relaxed text-paper-200 blur-[7px] select-none">
          この先、あなたの流れが大きく動く日が今月の中にあります。その少し前に、ある人からの連絡が判断の決め手になりそうです。具体的にいうと——
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-end bg-gradient-to-b from-transparent via-ink-950/70 to-ink-950/95 p-5 text-center">
          <p className="mb-3 text-[11px] font-bold text-gold-400">✦ ここから先は、直接お話しします</p>
          <PrimaryButton href="/consult" size="sm" textSize="text-sm">
            この先を、僕から聞く
          </PrimaryButton>
          <p className="mt-2 text-[10px] text-paper-500">
            {typeof report.remainingFreeQuota === "number"
              ? `今日はあと ${report.remainingFreeQuota}回 話せます`
              : "今日の無料相談から聞けます"}
          </p>
        </div>
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

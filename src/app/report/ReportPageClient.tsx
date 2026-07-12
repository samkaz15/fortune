"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ScoreOrb } from "@/components/ScoreOrb";
import { GlassMosaic, ScrollProgress, ShareRow, AffSlot, DramaticLoading, PrimaryButton } from "@/components/ui-common";
import { saveFortuneInput, loadFortuneInput } from "@/lib/fortune-input";
import { BirthDateSelect } from "@/components/BirthDateSelect";
import { ChatWindow } from "@/components/ChatWindow";
import { SakuraPetals } from "@/components/SakuraPetals";

interface DetailItem {
  text: string;
  reason: string;
}
interface ReportDetails {
  grounding?: string[]; // 占術根拠(旧キャッシュ行には無い)
  events: DetailItem[];
  cautionPoints: DetailItem[];
  recommendations: DetailItem[];
  overview: string;
}

interface Report {
  reportDate: string;
  score: number;
  stars: number;
  keywords: { userTheme: string; environment: string; fortune: string };
  summary: string;
  cautions: string[];
  advice: string;
  todayAction: string;
  streak?: number; // 連続チェック日数(マーケ02章: リテンション可視化)
  details?: ReportDetails | null; // 要件⑤ 2026-07-08の拡充ブロック(旧キャッシュ行はnull)
  remainingFreeQuota?: number;
  isSubscribed?: boolean;
}

/**
 * 「今日の意思決定レポート」画面(CEO_UPDATE 2026-07-03の6項目フォーマット)。
 * ①スコア(★+100点) ②キーワード3つ ③総合要約 ④注意3項目 ⑤総合アドバイス ⑥今日やるべき1つの行動
 */
/** reportDate("YYYY-MM-DD")を「◯月◯日の運勢」表記に(要件②: 更新不安の解消) */
function formatReportDateLabel(reportDate: string, period: "today" | "week" | "month" | "nextMonth"): string {
  const [, m, d] = reportDate.split("-").map(Number);
  const dateLabel = `${m}月${d}日`;
  if (period === "today") return `${dateLabel}の運勢`;
  if (period === "week") return `${dateLabel}の週の運勢`;
  return `${dateLabel}〜の運勢`;
}

export default function ReportPageClient() {
  const [report, setReport] = useState<Report | null>(null);
  const [showPetals, setShowPetals] = useState(false); // 診断結果の花びら演出(2026-07-12)
  const [error, setError] = useState<{ message: string; href: string; label: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<"today" | "week" | "month" | "nextMonth">("today");
  // 入力ファースト(要件③ 2026-07-08): 診断前に必ず名前・生年月日を入力する
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [started, setStarted] = useState(false);
  // ④UX改善(2026-07-08): 初回のみ入力。プロフィール登録済みならワンタップで即結果へ。
  // auth: checking=判定中 / guest=未ログイン / needInput=ログイン済み・初回入力 / ready=登録済み
  const [gate, setGate] = useState<"checking" | "guest" | "needInput" | "ready">("checking");
  // 期間ごとの取得結果をキャッシュ(タブ切替を即時反応に / 2026-07-07 速度改善)
  const cacheRef = useRef<Record<string, Report>>({});

  // 会員登録や他画面からの引き継ぎ入力があればプレフィル(要件⑥: 体験を途切れさせない)
  useEffect(() => {
    const saved = loadFortuneInput();
    if (saved) {
      setName(saved.name);
      setBirthDate(saved.birthDate);
    }
  }, []);

  // ④初回のみ入力(2026-07-08): ログイン済み+プロフィール登録済みなら入力画面を挟まず即診断。
  // 入力情報の保持はサーバー側(UserProfile)+12時間スライディングセッションが担うため、
  // Cookie/キャッシュが消えた場合は未ログイン扱い=再ログイン・再入力(要件④の整合)。
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((d) => {
        if (!d.loggedIn) {
          setGate("guest");
        } else if (d.hasProfile) {
          setGate("ready");
          setStarted(true); // 押した瞬間に結果へ(入力画面を挟まない)
          setLoading(true);
        } else {
          setGate("needInput"); // 初回ログイン時のみ入力
        }
      })
      .catch(() => setGate("needInput"));
  }, []);

  useEffect(() => {
    if (!started) return; // 診断開始前はフェッチしない(入力ファースト)
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
      // 登録済みユーザーはサーバー保存のプロフィールで診断(毎回の入力を廃止・要件④)
      const inputQs = gate === "ready" ? "" : `&name=${encodeURIComponent(name)}&birthDate=${encodeURIComponent(birthDate)}`;
      const base = `?period=${period}${inputQs}`;
      const qs = coords ? `${base}&lat=${coords.lat}&lon=${coords.lon}` : base;
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
          if (d && d.keywords && typeof d.score === "number") { cacheRef.current[period] = d; setReport(d); setShowPetals(true); }
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
    // name/birthDateは診断開始時点の値で固定する(startedがトリガー)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, started]);

  if (gate === "checking") {
    return <div className="px-5 pt-24 text-center text-sm text-paper-500">読み込み中...</div>;
  }

  if (gate === "guest") {
    return (
      <div className="flex flex-col gap-5 px-5 pt-4 pb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/character/report_hero.jpg" alt="錦糸町の少年" className="mb-1 h-36 w-full rounded-card border border-ink-700 object-cover shadow-lantern" style={{ objectPosition: "center 30%" }} />
        <h1 className="font-display text-lg text-paper-50">今日の運勢</h1>
        <p className="text-center text-xs leading-relaxed text-paper-300">
          ログインすると、毎日ワンタップで今日の運勢が見られます。<br />初回に名前と生年月日を登録するだけで、次からは入力不要です。
        </p>
        <Link href="/auth/login" className="rounded-full bg-gold-500 py-3.5 text-center text-sm font-bold text-ink-950">ログインして占う</Link>
        <Link href="/auth/signup?from=/report" className="rounded-full border border-gold-500/50 py-3 text-center text-sm font-bold text-gold-400">はじめての方はこちら(無料登録)</Link>
        <AffSlot />
      </div>
    );
  }

  if (!started) {
    const canStart = name.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(birthDate);
    return (
      <div className="flex flex-col gap-5 px-5 pt-4 pb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/character/report_hero.jpg" alt="錦糸町の少年" className="mb-1 h-36 w-full rounded-card border border-ink-700 object-cover shadow-lantern" style={{ objectPosition: "center 30%" }} />
        <h1 className="font-display text-lg text-paper-50">今日の運勢</h1>
        <p className="text-center text-[11px] text-paper-500">初回のみ、お名前と生年月日をご登録ください。次回からは入力不要で、押した瞬間に結果が出ます</p>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-paper-300">お名前(漢字フルネーム)</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="糸町 蛙太"
            maxLength={40}
            className="rounded-full border border-ink-600 bg-ink-950 px-5 py-3 text-sm text-paper-100 outline-none focus:border-gold-500"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-paper-300">生年月日</span>
          <BirthDateSelect value={birthDate} onChange={setBirthDate} />
        </label>
        <button
          onClick={() => {
            if (!canStart) return;
            saveFortuneInput({ name: name.trim(), birthDate });
            setLoading(true);
            setStarted(true);
          }}
          disabled={!canStart}
          className="mt-2 rounded-full bg-gold-500 py-3.5 text-sm font-bold text-ink-950 shadow-[0_4px_0_#8a6b25] transition active:translate-y-1 active:shadow-none disabled:opacity-40"
        >
          診断を開始する
        </button>
        <AffSlot />
      </div>
    );
  }

  if (loading) {
    return <DramaticLoading messages={["天の川に、糸を渡しています、、", "今日のあなたの星と重ねています（65%）", "見えました。"]} />;
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
      {showPetals && <SakuraPetals />}
      {/* 今日の運勢ヒーロー(CEO指定画像 2026-07-07) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/character/report_hero.jpg" alt="錦糸町の少年" className="mb-3 h-36 w-full rounded-card border border-ink-700 object-cover shadow-lantern" style={{ objectPosition: "center 30%" }} />
      <h1 className="font-display text-lg text-paper-50">今日の運勢</h1>
      <p className="mt-1 text-center text-[11px] text-paper-500">今日の運勢を占って自分を確認</p>

      {/* チャット(Step3 2026-07-12): レポート本体より上に設置(CEO指示) */}
      <ChatWindow />

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
        {/* 2026-07-11 Phase1指示A: 「更新されていない」不安の解消のため対象日を明示 */}
        <p className="text-[11px] text-paper-500">{formatReportDateLabel(report.reportDate, period)}</p>
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

      {/* 今日の星回り: 占術根拠の明示(要件6 2026-07-11。マーケ01章の信頼性懸念対策) */}
      {report.details?.grounding && report.details.grounding.length > 0 && (
        <section className="rounded-card border border-ink-700 bg-ink-900/50 p-5">
          <h2 className="mb-3 text-xs font-bold text-gold-400">🌌 今日の星回り(占いの根拠)</h2>
          <ul className="space-y-2.5">
            {report.details.grounding.map((g, i) => (
              <li key={i} className="flex gap-2 text-xs leading-relaxed text-paper-300">
                <span className="text-gold-500">✦</span>
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ④ 今日起こりやすい出来事(要件⑤ 2026-07-08: 理由付き3項目) */}
      {report.details && (
        <section className="rounded-card border border-ink-700 bg-ink-900/50 p-5">
          <h2 className="mb-3 text-xs font-bold text-gold-400">今日、起こりやすいこと</h2>
          <ul className="space-y-3">
            {report.details.events.map((e, i) => (
              <li key={i}>
                <p className="flex gap-2 text-sm font-bold text-paper-50"><span className="text-gold-400">◆</span><span>{e.text}</span></p>
                <p className="mt-1 pl-5 text-xs leading-relaxed text-paper-400">{e.reason}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ⑤ 注意ポイント3つ(detailsがあれば理由付き、旧キャッシュ行は従来表示) */}
      <section className="rounded-card border border-torii-500/40 bg-ink-900/50 p-5">
        <h2 className="mb-3 text-xs font-bold text-torii-500">今日、気をつけること</h2>
        {report.details ? (
          <ul className="space-y-3">
            {report.details.cautionPoints.map((c, i) => (
              <li key={i}>
                <p className="flex gap-2 text-sm font-bold text-paper-100"><span className="text-torii-500">・</span><span>{c.text}</span></p>
                <p className="mt-1 pl-4 text-xs leading-relaxed text-paper-400">{c.reason}</p>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-2">
            {report.cautions.map((c, i) => (
              <li key={i} className="flex gap-2 text-sm text-paper-100">
                <span className="text-torii-500">・</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ⑥ 今日おすすめの行動(理由付き3項目) */}
      {report.details && (
        <section className="rounded-card border border-gold-500/40 bg-gold-500/5 p-5">
          <h2 className="mb-3 text-xs font-bold text-gold-400">今日、おすすめの行動</h2>
          <ul className="space-y-3">
            {report.details.recommendations.map((r2, i) => (
              <li key={i}>
                <p className="flex gap-2 text-sm font-bold text-paper-50"><span className="text-gold-400">{i + 1}.</span><span>{r2.text}</span></p>
                <p className="mt-1 pl-5 text-xs leading-relaxed text-paper-400">{r2.reason}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <AffSlot label="AD SLOT 2" />

      {/* ⑤⑥ 詳細部: 有料会員のみ全文。無料/非会員はGlassモザイク(UI仕様v5) */}
      {report.isSubscribed ? (
        <>
          <section className="rounded-card border border-ink-700 bg-ink-900/50 p-5">
            <h2 className="mb-2 text-xs font-bold text-paper-400">錦糸町の少年からのアドバイス</h2>
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

      {/* ⑦ 今日の総評(200〜300字・前向きに締める) */}
      {report.details && (
        <section className="rounded-card border-2 border-gold-500/60 bg-ink-900/70 p-5">
          <h2 className="mb-2 text-xs font-bold text-gold-400">今日の総評</h2>
          <p className="text-sm leading-relaxed text-paper-100">{report.details.overview}</p>
        </section>
      )}

      {typeof report.streak === "number" && report.streak >= 2 && (
        <p className="text-center text-xs text-gold-300">🎋 {report.streak}日連続でチェック中。この糸、切らさずにいきましょう</p>
      )}

      <ShareRow text={`【今日の短冊】運勢${report.score}点。「${report.keywords.userTheme}」の日。 #錦糸町の少年 #今日の運勢`} />

      {/* CV1: ここから先の核心(モザイク寸止め) + CV3: 感情CTA */}
      <section className="relative overflow-hidden rounded-card border border-gold-500/40" style={{ minHeight: 210 }}>
        <div className="p-5 text-sm leading-relaxed text-paper-200 blur-[7px] select-none">
          この先、あなたの流れが大きく動く日が今月の中にあります。その少し前に、ある人からの連絡が判断の決め手になりそうです。具体的にいうと——
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-end bg-gradient-to-b from-transparent via-ink-950/70 to-ink-950/95 p-5 text-center">
          <p className="mb-3 text-[11px] font-bold text-gold-400">✦ ここから先は、直接お話しします</p>
          <PrimaryButton href="/auth/signup?from=/report" size="sm" textSize="text-sm">
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
        href="/auth/signup?from=/report"
        className="rounded-full border border-gold-500/50 py-3 text-center text-sm font-bold text-gold-400"
      >
        会員登録して、続きを占う
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

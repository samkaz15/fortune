"use client";

/**
 * 仕事特設ページ（UX7 本実装）— サブスク最適化版 + 算命学ロジック
 * 入力: 名前 + 生年月日 + 現在の状況 → /api/work/reading
 * 無料: 本質＋中長期＋今日の行動 / 有料: 将来の相性を業界×部署で特定（ロック）
 */
import { useState } from "react";
import { MilkyWayBackground } from "@/components/MilkyWayBackground";

type Situation = "うまくいっている" | "少し疲れている" | "判断に迷っている" | "環境を変えたい";

interface Reading {
  name: string;
  essence: { core: string; behaviors: string[]; stress: string | null; ngEnvironment: string };
  stemAction: string;
  midTerm: string;
  future:
    | { locked: false; fitJobs: { industry: string; department: string; grade: string }[]; message: string }
    | { locked: true; preview: string; cta: string };
}

const SITUATIONS: Situation[] = ["うまくいっている", "少し疲れている", "判断に迷っている", "環境を変えたい"];
const MENU = [
  ["あなたの本質(働き方の核)", "生年月日から、生まれ持った行動の型と強みを構造的に見ます"],
  ["いまの仕事の流れ", "中長期で見た、いまが「積む時期」か「動く時期」か"],
  ["消耗の正体", "疲れの原因が量なのか、環境なのか、判断の多さなのか"],
  ["力が出る環境・削られる環境", "あなたの型が活きる条件と、合わない条件"],
  ["将来的に何と相性がいいか ※詳細は有料", "業界だけでなく、その中のどの部署・役割かまで特定します"],
];

export default function WorkPage() {
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [situation, setSituation] = useState<Situation>("少し疲れている");
  const [phase, setPhase] = useState<"input" | "loading" | "result">("input");
  const [reading, setReading] = useState<Reading | null>(null);

  async function run() {
    if (!name || !birthDate) return;
    setPhase("loading");
    const res = await fetch("/api/work/reading", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, birthDate, situation }),
    });
    const data = await res.json();
    setTimeout(() => {
      setReading(data);
      setPhase("result");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 1800);
  }

  return (
    <main className="relative mx-auto min-h-screen max-w-md px-5 pb-24 pt-8 text-paper-200">
      <MilkyWayBackground />
      <div className="relative z-10">
        {phase === "input" && (
          <>
            <div className="py-8 text-center">
              <h1 className="text-xl font-bold text-paper-50">今の仕事の流れを、短く整理します</h1>
              <p className="mt-2 text-xs text-paper-400">あなたの働き方には、一定のリズムがあります</p>
            </div>

            <div className="rounded-card border border-ink-700 bg-ink-900/70 p-5">
              <label className="mb-1 block text-[11px] font-bold text-paper-100">名前<span className="ml-1 font-normal text-paper-500">ニックネームでOK</span></label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="mb-4 w-full rounded-xl border border-ink-700 bg-ink-950 px-4 py-3 text-sm text-paper-100 outline-none focus:border-gold-500" placeholder="糸子" />
              <label className="mb-1 block text-[11px] font-bold text-paper-100">生年月日</label>
              <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="mb-4 w-full rounded-xl border border-ink-700 bg-ink-950 px-4 py-3 text-sm text-paper-100 outline-none focus:border-gold-500" />
              <label className="mb-1 block text-[11px] font-bold text-paper-100">現在の状況</label>
              <div className="mb-4 grid grid-cols-2 gap-2">
                {SITUATIONS.map((s) => (
                  <button key={s} onClick={() => setSituation(s)} className={`rounded-full border px-2 py-2 text-[11px] font-bold transition ${situation === s ? "border-gold-500 bg-gold-500/10 text-gold-400" : "border-ink-700 text-paper-400"}`}>{s}</button>
                ))}
              </div>
              <button onClick={run} disabled={!name || !birthDate} className="w-full rounded-full bg-gold-500 py-3.5 text-sm font-bold text-ink-950 shadow-[0_4px_0_#8a6b25] active:translate-y-1 active:shadow-none disabled:opacity-40">仕事の流れを見る</button>
            </div>

            <div className="my-6 flex h-[100px] items-center justify-center rounded-2xl border border-dashed border-ink-700/50 text-[9px] tracking-widest text-ink-600">
              キャリア参考情報（外部リンク）
            </div>

            <div className="rounded-card border border-ink-700 bg-ink-900/70 p-5">
              <p className="mb-3 text-[10px] font-bold tracking-widest text-gold-400">READING ｜ この占いでわかること</p>
              {MENU.map(([t, d]) => (
                <div key={t} className="border-b border-ink-800 py-2.5 last:border-0">
                  <p className="text-xs font-bold text-paper-100">✦ {t}</p>
                  <p className="mt-0.5 text-[10.5px] text-paper-400">{d}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {phase === "loading" && (
          <div className="py-32 text-center">
            <div className="mx-auto mb-4 h-14 w-14 animate-spin rounded-full border-2 border-ink-700 border-t-gold-500" />
            <p className="text-xs text-paper-300">流れを整理しています、、</p>
          </div>
        )}

        {phase === "result" && reading && (
          <div className="pt-4">
            <div className="mb-4 rounded-card border border-ink-700 bg-ink-900/70 p-5">
              <p className="mb-1 text-[9px] font-bold tracking-widest text-gold-400">01 ｜ あなたの本質</p>
              <p className="text-sm leading-relaxed text-paper-100">{reading.essence.core}</p>
              <ul className="mt-3 space-y-1">
                {reading.essence.behaviors.map((b) => (<li key={b} className="text-xs text-paper-300">・{b}</li>))}
              </ul>
            </div>

            <div className="mb-4 rounded-xl border border-gold-500/25 bg-gold-500/5 p-4 text-center text-xs text-gold-300">この状態は「向いていない」のではなく「整理されていない状態」です。</div>

            <div className="mb-4 rounded-card border border-ink-700 bg-ink-900/70 p-5">
              <p className="mb-1 text-[9px] font-bold tracking-widest text-gold-400">02 ｜ いまの仕事の流れ(中長期)</p>
              <p className="text-sm leading-relaxed text-paper-100">{reading.midTerm}</p>
            </div>

            <div className="mb-4 rounded-card border border-ink-700 bg-ink-900/70 p-5">
              <p className="mb-1 text-[9px] font-bold tracking-widest text-gold-400">03 ｜ 今日の最適行動</p>
              <p className="text-sm leading-relaxed text-paper-100">もし今日ひとつだけやるなら——{reading.stemAction}のがいいと思います。</p>
            </div>

            <div className="mb-4 rounded-xl border border-gold-500/25 bg-gold-500/5 p-4 text-center text-xs text-gold-300">今すぐ結論を出す必要はありませんが、方向性の整理は早いほど有利です。</div>

            {/* 有料: 将来の相性(業界×部署) */}
            {reading.future.locked ? (
              <div className="relative overflow-hidden rounded-card border border-ink-700" style={{ minHeight: 260 }}>
                <div className="p-5 text-sm leading-relaxed text-paper-300 blur-[7px] select-none">
                  あなたの型と相性がいいのは、まず不動産なら売買仕入・用地取得の部門。金融なら法人営業、メーカーなら生産管理。逆に変化の速いスタートアップ初期は——
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-end bg-gradient-to-b from-transparent via-ink-950/75 to-ink-950/95 p-5 text-center">
                  <p className="mb-1 text-[11px] font-bold text-paper-100">将来的に何と相性がいいのか——<br /><span className="text-gold-400">業界と、その中の部署</span>まで特定できています。</p>
                  <p className="mb-3 text-[10px] text-paper-500">この流れは一定期間続きます。ただし、次の転換点はまだ表示されていません。</p>
                  <a href="/plans" className="w-full rounded-full bg-gold-500 py-3 text-xs font-bold text-ink-950 shadow-[0_4px_0_#8a6b25] active:translate-y-1">{reading.future.cta}</a>
                </div>
              </div>
            ) : (
              <div className="rounded-card border border-gold-500/40 bg-gold-500/5 p-5">
                <p className="mb-3 text-[9px] font-bold tracking-widest text-gold-400">FUTURE ｜ 将来的に相性のいい仕事</p>
                <p className="mb-3 text-sm leading-relaxed text-paper-100">{reading.future.message}</p>
                <div className="space-y-2">
                  {reading.future.fitJobs.map((j) => (
                    <div key={`${j.industry}-${j.department}`} className="flex items-center justify-between rounded-xl border border-ink-700 bg-ink-900/60 px-4 py-2.5">
                      <span className="text-xs text-paper-200"><b className="text-paper-50">{j.industry}</b> ／ {j.department}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${j.grade === "best" ? "bg-gold-500 text-ink-950" : "border border-gold-500/40 text-gold-400"}`}>{j.grade === "best" ? "最適" : "good"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="my-6 flex h-[100px] items-center justify-center rounded-2xl border border-dashed border-ink-700/50 text-[9px] tracking-widest text-ink-600">
              キャリア参考情報（外部リンク）
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

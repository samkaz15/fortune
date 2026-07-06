"use client";

/**
 * 恋愛特設ページ（UX6 本実装）— CVR2倍チューニング版（3層構造）
 * 入力: 名前 + 相手の名前 → /api/love/reading
 * 表層(安心)→中層(気づき)→深層(ロック)。深層はサブスクで解放。
 */
import { useState } from "react";
import { MilkyWayBackground } from "@/components/MilkyWayBackground";

interface Reading {
  score: number;
  meters: { closeness: number; talk: number; energy: number };
  layers: {
    surface: string; partner: string; flow: string; action: string;
    gap: string; assist: string; sway: string;
  };
  deep: { locked: false; text: string } | { locked: true; cta: string; note: string };
}

const MENU = [
  ["ふたりの相性", "性格の噛み合い・会話のテンポ・価値観の距離を総合スコアで"],
  ["相手の今の気持ち", "言葉にしていない部分で、相手が何を感じているか"],
  ["進展のタイミング", "関係が動きやすい時期と、待った方がいい時期"],
  ["すれ違いの原因", "ふたりの間にある「小さな誤解」の正体"],
  ["復縁・再会の流れ", "離れている場合、縁がもう一度動くかどうか"],
  ["距離の縮め方", "あなたから動くべきか、待つべきか——次の一手"],
];

export default function LovePage() {
  const [name, setName] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [phase, setPhase] = useState<"input" | "loading" | "result">("input");
  const [reading, setReading] = useState<Reading | null>(null);

  async function run() {
    if (!name || !partnerName) return;
    setPhase("loading");
    const res = await fetch("/api/love/reading", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, partnerName }),
    });
    const data = await res.json();
    setTimeout(() => { setReading(data); setPhase("result"); window.scrollTo({ top: 0, behavior: "smooth" }); }, 1800);
  }

  const Meter = ({ label, v }: { label: string; v: number }) => (
    <div className="mt-2">
      <div className="mb-1 flex justify-between text-[10.5px]"><b className="text-paper-100">{label}</b><span className="text-paper-400">{v}</span></div>
      <div className="h-[7px] overflow-hidden rounded-full bg-ink-800"><div className="h-full rounded-full bg-gradient-to-r from-rose-400 to-rose-300" style={{ width: `${v}%` }} /></div>
    </div>
  );

  return (
    <main className="relative mx-auto min-h-screen max-w-md px-5 pb-24 pt-8 text-paper-200">
      <MilkyWayBackground />
      <div className="relative z-10">
        {phase === "input" && (
          <>
            <div className="py-8 text-center">
              <h1 className="text-xl font-bold text-paper-50">ふたりの関係を、短く整理します</h1>
              <p className="mt-2 text-xs text-paper-400">関係には、まだ言葉になっていない部分があります</p>
            </div>
            <div className="rounded-card border border-ink-700 bg-ink-900/70 p-5">
              <label className="mb-1 block text-[11px] font-bold text-paper-100">あなたの名前<span className="ml-1 font-normal text-paper-500">ニックネームでOK</span></label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="mb-4 w-full rounded-xl border border-ink-700 bg-ink-950 px-4 py-3 text-sm text-paper-100 outline-none focus:border-rose-400" placeholder="糸子" />
              <label className="mb-1 block text-[11px] font-bold text-paper-100">相手の名前<span className="ml-1 font-normal text-paper-500">名前だけでOK</span></label>
              <input value={partnerName} onChange={(e) => setPartnerName(e.target.value)} className="mb-4 w-full rounded-xl border border-ink-700 bg-ink-950 px-4 py-3 text-sm text-paper-100 outline-none focus:border-rose-400" placeholder="太郎" />
              <button onClick={run} disabled={!name || !partnerName} className="w-full rounded-full bg-gold-500 py-3.5 text-sm font-bold text-ink-950 shadow-[0_4px_0_#8a6b25] active:translate-y-1 active:shadow-none disabled:opacity-40">相性を占う</button>
            </div>

            <div className="my-6 flex h-[140px] items-center justify-center rounded-2xl border border-dashed border-ink-700/50 text-[9px] tracking-widest text-ink-600">AFFILIATE SLOT AREA A</div>

            <div className="rounded-card border border-ink-700 bg-ink-900/70 p-5">
              <p className="mb-3 text-[10px] font-bold tracking-widest text-rose-300">READING ｜ この占いでわかること</p>
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
            <div className="mx-auto mb-4 h-14 w-14 animate-spin rounded-full border-2 border-ink-700 border-t-rose-400" />
            <p className="text-xs text-paper-300">ふたりの糸をたどっています、、</p>
          </div>
        )}

        {phase === "result" && reading && (
          <div className="pt-4">
            <div className="mb-4 rounded-card border border-ink-700 bg-ink-900/70 p-5 text-center">
              <p className="text-[9px] font-bold tracking-widest text-rose-300">SCORE ｜ ふたりの縁</p>
              <p className="mt-1 text-4xl font-bold text-rose-300">{reading.score}<span className="text-sm">点</span></p>
              <p className="mt-1 text-[11px] text-paper-400">数字は高めです。ただ、点数より大事なことが下にあります。</p>
              <div className="mt-4 text-left">
                <Meter label="心の距離" v={reading.meters.closeness} />
                <Meter label="会話の噛み合い" v={reading.meters.talk} />
                <Meter label="進展のエネルギー" v={reading.meters.energy} />
              </div>
            </div>

            <div className="mb-4 rounded-card border border-ink-700 bg-ink-900/70 p-5"><p className="text-[9px] font-bold tracking-widest text-rose-300">01 ｜ 現在の関係性</p><p className="mt-2 text-sm leading-relaxed text-paper-100">{reading.layers.surface}</p></div>
            <div className="mb-4 rounded-card border border-ink-700 bg-ink-900/70 p-5"><p className="text-[9px] font-bold tracking-widest text-rose-300">02 ｜ 相手の心理</p><p className="mt-2 text-sm leading-relaxed text-paper-100">{reading.layers.partner}</p></div>

            <div className="my-4 flex h-[100px] items-center justify-center rounded-2xl border border-dashed border-ink-700/50 text-[9px] tracking-widest text-ink-600">AFFILIATE SLOT AREA B</div>

            <div className="mb-4 rounded-card border border-ink-700 bg-ink-900/70 p-5"><p className="text-[9px] font-bold tracking-widest text-rose-300">03 ｜ ふたりの流れ</p><p className="mt-2 text-sm leading-relaxed text-paper-100">{reading.layers.flow}</p></div>
            <div className="mb-4 rounded-card border border-ink-700 bg-ink-900/70 p-5"><p className="text-[9px] font-bold tracking-widest text-rose-300">04 ｜ 次の一手</p><p className="mt-2 text-sm leading-relaxed text-paper-100">{reading.layers.action}</p></div>

            <div className="mb-4 rounded-xl border border-rose-400/25 bg-rose-400/5 p-4 text-center text-xs text-rose-200">{reading.layers.gap}</div>
            <p className="mb-3 px-2 text-center text-[11px] leading-relaxed text-paper-400">{reading.layers.assist}</p>
            <p className="mb-4 px-2 text-center text-sm leading-relaxed text-paper-100">{reading.layers.sway}</p>

            <div className="relative overflow-hidden rounded-card border border-ink-700" style={{ minHeight: 200 }}>
              {reading.deep.locked ? (
                <>
                  <div className="p-5 text-sm leading-relaxed text-paper-300 blur-[7px] select-none">ふたりの間で最初にすれ違いが生まれたのは、実は最近ではありません。相手が「言わないでいること」には理由があって、それは——</div>
                  <div className="absolute inset-0 flex flex-col items-center justify-end bg-gradient-to-b from-transparent via-ink-950/75 to-ink-950/95 p-5 text-center">
                    <p className="mb-3 text-[11px] font-bold text-rose-300">この関係で一番重要な「すれ違いの原因」は、まだここには表示されていません。</p>
                    <a href="/plans" className="w-full rounded-full bg-gold-500 py-3 text-xs font-bold text-ink-950 shadow-[0_4px_0_#8a6b25] active:translate-y-1">{reading.deep.cta}</a>
                    <p className="mt-2 text-[9px] text-paper-500">{reading.deep.note}</p>
                  </div>
                </>
              ) : (
                <div className="p-5"><p className="text-[9px] font-bold tracking-widest text-rose-300">すれ違いの原因</p><p className="mt-2 text-sm leading-relaxed text-paper-100">{reading.deep.text}</p></div>
              )}
            </div>

            <div className="my-6 flex h-[100px] items-center justify-center rounded-2xl border border-dashed border-ink-700/50 text-[9px] tracking-widest text-ink-600">AFFILIATE SLOT AREA C</div>
          </div>
        )}
      </div>
    </main>
  );
}

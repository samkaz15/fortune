"use client";

/**
 * 「自分のこと」特設ページ(UI仕様v5)
 * 構成: 占える内容6項目 → 診断結果サンプル(無料版UI) → 名前 → 生年月日 → 診断開始
 * 結果: ①状態②傾向③注意1つ④行動1つ(Core Mapping Spec固定フォーマット)。深掘りはサブスク。
 */
import { useEffect, useState } from "react";
import { saveFortuneInput, loadFortuneInput } from "@/lib/fortune-input";
import { GlassMosaic, ScrollProgress, ShareRow, FloatingCTA, AffSlot, DramaticLoading, withMinimumDuration, PrimaryButton } from "@/components/ui-common";
import { track } from "@/lib/track-client";

interface Reading {
  name: string;
  state: string;
  tendency: string;
  caution: string;
  action: string;
  elementNote: string | null;
  deep: { locked: true } | { locked: false; behaviors: string[]; ngEnvironment: string };
}

const MENU = [
  ["本来の性格・強み", "生まれ持った行動の型を構造的に見ます"],
  ["いまの運気の波", "今日のあなたの流れを0-100で"],
  ["今日の流れと出来事", "どう動くと噛み合う日か"],
  ["気をつけること", "注意点は1つだけに絞って伝えます"],
  ["今日やるべき行動", "結論は必ず1アクションに収束します"],
  ["合わない環境", "力が削られる条件(会員限定)"],
];

export default function SelfPageClient() {
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  // 会員登録や他画面からの引き継ぎ入力があればプレフィル(要件⑥)
  useEffect(() => {
    const saved = loadFortuneInput();
    if (saved) {
      setName(saved.name);
      setBirthDate(saved.birthDate);
    }
  }, []);
  const [phase, setPhase] = useState<"input" | "loading" | "result">("input");
  const [r, setR] = useState<Reading | null>(null);
  const [submitting, setSubmitting] = useState(false); // 二重実行防止(監査Phase1 Critical対応)

  async function run() {
    if (!name || !birthDate || submitting) return;
    saveFortuneInput({ name, birthDate }); // 会員登録後の続き占いへ引き継ぐ(要件⑥)
    setSubmitting(true);
    setPhase("loading");
    track("free_reading_started", { category: "self" });
    try {
      const data = await withMinimumDuration(
        fetch("/api/self/reading", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, birthDate }),
        }).then((res) => res.json())
      );
      setR(data);
      setPhase("result");
      track("free_reading_completed", { category: "self" });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="px-5 pt-4">
      {phase === "input" && (
        <>
          <div className="py-6 text-center">
            <h1 className="text-xl font-bold text-paper-50">自分のことを、短く整理します</h1>
            <p className="mt-2 text-xs text-paper-400">名前と生年月日だけで大丈夫です</p>
          </div>

          {/* 占える内容(6項目) */}
          <div className="rounded-card border border-ink-700 bg-ink-900/70 p-5">
            <p className="mb-3 text-[10px] font-bold tracking-widest text-gold-400">READING ｜ この占いでわかること</p>
            {MENU.map(([t, d]) => (
              <div key={t} className="border-b border-ink-800 py-2.5 last:border-0">
                <p className="text-xs font-bold text-paper-100">✦ {t}</p>
                <p className="mt-0.5 text-[10.5px] text-paper-400">{d}</p>
              </div>
            ))}
          </div>

          {/* 入力 */}
          <div className="mt-4 rounded-card border border-ink-700 bg-ink-900/70 p-5">
            <label className="mb-1 block text-[11px] font-bold text-paper-100">名前<span className="ml-1 font-normal text-paper-500">ニックネームでOK</span></label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="mb-4 w-full rounded-xl border border-ink-700 bg-ink-950 px-4 py-3 text-sm text-paper-100 outline-none focus:border-gold-500" placeholder="糸子" />
            <label className="mb-1 block text-[11px] font-bold text-paper-100">生年月日</label>
            <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="mb-4 w-full rounded-xl border border-ink-700 bg-ink-950 px-4 py-3 text-sm text-paper-100 outline-none focus:border-gold-500" />
            <PrimaryButton onClick={run} disabled={!name || !birthDate || submitting}>診断をはじめる</PrimaryButton>
          </div>

          {/* 診断前の結果サンプル(無料版UIと同じ) */}
          <p className="mb-2 mt-8 text-center text-[10px] font-bold tracking-widest text-paper-500">SAMPLE ｜ こんな結果が届きます</p>
          <div className="pointer-events-none select-none opacity-80">
            <div className="rounded-card border border-ink-700 bg-ink-900/70 p-5">
              <p className="text-[9px] font-bold tracking-widest text-gold-400">01 ｜ 現在の状態</p>
              <p className="mt-2 text-sm leading-relaxed text-paper-100">いまの糸子さんは「安定・基盤」の流れです。</p>
            </div>
            <div className="mt-3 rounded-card border border-ink-700 bg-ink-900/70 p-5">
              <p className="text-[9px] font-bold tracking-widest text-gold-400">02 ｜ 性質の傾向</p>
              <p className="mt-2 text-sm leading-relaxed text-paper-100">維持・安定・構造化が得意。決めてから積む順番に入ると強い型です。</p>
            </div>
            <div className="mt-3">
              <GlassMosaic message="この先はサンプルです。あなたの結果で見てみてください。" ctaLabel="上に戻って診断する" ctaHref="#" >
                <p className="text-sm">合わない環境と、今日やるべきたった1つのこと——</p>
              </GlassMosaic>
            </div>
          </div>
        </>
      )}

      {phase === "loading" && (
        <DramaticLoading messages={["名前と生年月日を、読み解いています、、", "本質の型と重ねています", "見えました。"]} />
      )}

      {phase === "result" && r && (
        <div className="pb-28 pt-4">
          <ScrollProgress />
          <div className="mb-4 rounded-card border border-ink-700 bg-ink-900/70 p-5">
            <p className="text-[9px] font-bold tracking-widest text-gold-400">01 ｜ 現在の状態</p>
            <p className="mt-2 text-sm leading-relaxed text-paper-100">{r.state}</p>
          </div>
          <div className="mb-4 rounded-card border border-ink-700 bg-ink-900/70 p-5">
            <p className="text-[9px] font-bold tracking-widest text-gold-400">02 ｜ 性質の傾向</p>
            <p className="mt-2 text-sm leading-relaxed text-paper-100">{r.tendency}</p>
            {r.elementNote && <p className="mt-2 text-xs text-paper-400">いまの流れは「{r.elementNote}」時期です。</p>}
          </div>
          <div className="mb-4 rounded-card border border-ink-700 bg-ink-900/70 p-5">
            <p className="text-[9px] font-bold tracking-widest text-gold-400">03 ｜ 注意点(1つだけ)</p>
            <p className="mt-2 text-sm leading-relaxed text-paper-100">気をつけるのは「{r.caution}」。これひとつで大丈夫です。</p>
          </div>
          <div className="mb-4 rounded-card border-2 border-gold-500 bg-ink-900/70 p-5 text-center">
            <p className="text-[9px] font-bold tracking-widest text-gold-400">04 ｜ 今日やるなら</p>
            <p className="mt-2 font-display text-base leading-relaxed text-paper-50">{r.action}</p>
          </div>

          {r.deep.locked ? (
            <GlassMosaic
              message="あなたの行動特性と「合わない環境」は、まだここには表示されていません。"
              ctaLabel="もっと占う"
              ctaHref="/plans"
              note="※初月500円 月額980円"
            >
              <p className="text-sm leading-relaxed">力が削られる環境はマイクロマネジメント型の——そして、行動特性としては——</p>
            </GlassMosaic>
          ) : (
            <div className="rounded-card border border-gold-500/40 bg-gold-500/5 p-5">
              <p className="text-[9px] font-bold tracking-widest text-gold-400">DEEP ｜ 行動特性と合わない環境</p>
              <ul className="mt-2 space-y-1">
                {r.deep.behaviors.map((b) => (<li key={b} className="text-xs text-paper-200">・{b}</li>))}
              </ul>
              <p className="mt-3 text-xs leading-relaxed text-paper-100">避けたい環境: <b className="text-paper-50">{r.deep.ngEnvironment}</b></p>
            </div>
          )}

          <ShareRow text={`${r.name}の本質、当たってた気がする — 糸町の少年`} />
          <FloatingCTA label="会員登録して、続きを占う" href="/auth/signup?from=/self" />
        </div>
      )}
          <AffSlot />
    </div>
  );
}

"use client";

/**
 * 「自分のこと」総合鑑定ページ(要件⑤ 2026-07-08で全面刷新)
 * 構成: 占える内容 → 入力 → 結果サンプル → 診断開始
 * 結果: 10セクション(本質/現在の運勢/恋愛運/仕事運/金運/健康運/人間関係/未来/行動指針/締め)。
 * 4占術+天気(気圧)を統合。深掘り(行動特性・合わない環境)はサブスク限定(既存ペイウォール維持)。
 */
import { useEffect, useState } from "react";
import { saveFortuneInput, loadFortuneInput } from "@/lib/fortune-input";
import { GlassMosaic, ScrollProgress, ShareRow, FloatingCTA, AffSlot, DramaticLoading, withMinimumDuration, PrimaryButton } from "@/components/ui-common";
import { track } from "@/lib/track-client";

interface Sections {
  essence: { personality: string; talent: string; strength: string; weakness: string; thinking: string };
  currentFortune: { situation: string; flow: string; caution: string; wind: string };
  love: { now: string; future: string; caution: string };
  work: { now: string; turningPoint: string; successPoint: string };
  // 05以降は非登録者にはサーバーから送られない(登録で解放・2026-07-08 3段階化)
  money?: { now: string; nearFuture: string; caution: string };
  health?: { physical: string; mental: string; improvement: string };
  relationships?: { now: string; cautionPerson: string; compatibility: string };
  future?: { flow: string; months: string; year: string; turningPoint: string };
  action?: { do: string; avoid: string; boost: string; concrete: string };
  closing?: string;
}

interface Reading {
  name: string;
  tier: "guest" | "member" | "paid";
  sections: Sections;
  memberLocked: boolean; // 非登録: 05〜10が未開放
  wave: number;
  elementNote: string | null;
  deep: { locked: true } | { locked: false; behaviors: string[]; ngEnvironment: string };
}

const MENU = [
  ["あなたの本質", "性格・才能・強み・弱み・思考パターン"],
  ["現在の運勢", "いまの状況、運気の流れ、追い風・逆風"],
  ["恋愛運・仕事運・金運", "現在から未来へ、それぞれの流れと転機"],
  ["健康運・人間関係", "体と心のコンディション、注意人物と相性"],
  ["未来", "数ヶ月先・一年先・重要な転機"],
  ["行動指針", "今やるべきこと・避けること・具体的アクション"],
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
      // 位置情報は任意: 取れれば天気(気圧)をコンディション面へ反映、拒否/失敗でも鑑定は進む
      const coords = await new Promise<{ lat: number; lon: number } | null>((resolve) => {
        if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
          () => resolve(null),
          { timeout: 3000 }
        );
      });
      const data = await withMinimumDuration(
        fetch("/api/self/reading", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, birthDate, ...(coords ?? {}) }),
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
            <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="mb-4 block h-12 w-full min-w-0 appearance-none rounded-xl border border-ink-700 bg-ink-950 px-4 text-sm leading-none text-paper-100 outline-none focus:border-gold-500" style={{ colorScheme: "dark", WebkitAppearance: "none" }} />
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
          <Section no="01" title="あなたの本質" rows={[
            ["性格", r.sections.essence.personality],
            ["才能", r.sections.essence.talent],
            ["強み", r.sections.essence.strength],
            ["弱み", r.sections.essence.weakness],
            ["思考パターン", r.sections.essence.thinking],
          ]} />
          <Section no="02" title="現在の運勢" rows={[
            ["いまの状況", r.sections.currentFortune.situation],
            ["運気の流れ", r.sections.currentFortune.flow],
            ["今注意すべきこと", r.sections.currentFortune.caution],
            ["追い風・逆風", r.sections.currentFortune.wind],
          ]} />
          <Section no="03" title="恋愛運" rows={[
            ["現在", r.sections.love.now],
            ["未来", r.sections.love.future],
            ["気を付けること", r.sections.love.caution],
          ]} />
          <Section no="04" title="仕事運" rows={[
            ["現在", r.sections.work.now],
            ["転機", r.sections.work.turningPoint],
            ["成功ポイント", r.sections.work.successPoint],
          ]} />
          {r.memberLocked && (
            <div className="mb-4">
              <GlassMosaic
                message={`ここから先(金運・健康運・人間関係・未来・行動指針)は、無料の会員登録で全部読めます。${r.name}さんの続き、ちゃんと用意してあります。`}
                ctaLabel="無料登録して続きを読む"
                ctaHref="/auth/signup?from=/self"
                note="※登録は無料・30秒で完了"
              >
                <p className="text-sm leading-relaxed">金運はいま動き出しの手前——そして{r.name}さんの一年先には——</p>
              </GlassMosaic>
            </div>
          )}
          {r.sections.money && (
          <Section no="05" title="金運" rows={[
            ["現在", r.sections.money.now],
            ["近未来", r.sections.money.nearFuture],
            ["注意点", r.sections.money.caution],
          ]} />
          )}
          {r.sections.health && (
          <Section no="06" title="健康運" rows={[
            ["体調面", r.sections.health.physical],
            ["精神面", r.sections.health.mental],
            ["生活改善ポイント", r.sections.health.improvement],
          ]} />
          )}
          {r.sections.relationships && (
          <Section no="07" title="人間関係" rows={[
            ["現在", r.sections.relationships.now],
            ["注意人物", r.sections.relationships.cautionPerson],
            ["相性", r.sections.relationships.compatibility],
          ]} />
          )}
          {r.sections.future && (
          <Section no="08" title="未来" rows={[
            ["今後の流れ", r.sections.future.flow],
            ["数ヶ月先", r.sections.future.months],
            ["一年先", r.sections.future.year],
            ["重要な転機", r.sections.future.turningPoint],
          ]} />
          )}
          {r.sections.action && (
          <div className="mb-4 rounded-card border-2 border-gold-500 bg-ink-900/70 p-5">
            <p className="text-[9px] font-bold tracking-widest text-gold-400">09 ｜ 行動指針</p>
            <dl className="mt-2 space-y-2.5">
              {([["今やるべきこと", r.sections.action.do], ["避けるべきこと", r.sections.action.avoid], ["運気を上げる行動", r.sections.action.boost], ["具体的アクション", r.sections.action.concrete]] as const).map(([label, text]) => (
                <div key={label}>
                  <dt className="text-[10px] font-bold text-gold-300">{label}</dt>
                  <dd className="mt-0.5 text-sm leading-relaxed text-paper-50">{text}</dd>
                </div>
              ))}
            </dl>
          </div>
          )}
          {r.sections.closing && (
          <div className="mb-4 rounded-card border border-gold-500/40 bg-gold-500/5 p-5">
            <p className="text-[9px] font-bold tracking-widest text-gold-400">10 ｜ 糸町の少年から</p>
            <p className="mt-2 text-sm leading-relaxed text-paper-100">{r.sections.closing}</p>
          </div>
          )}

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

function Section({ no, title, rows }: { no: string; title: string; rows: readonly (readonly [string, string])[] }) {
  return (
    <div className="mb-4 rounded-card border border-ink-700 bg-ink-900/70 p-5">
      <p className="text-[9px] font-bold tracking-widest text-gold-400">{no} ｜ {title}</p>
      <dl className="mt-2 space-y-2.5">
        {rows.map(([label, text]) => (
          <div key={label}>
            <dt className="text-[10px] font-bold text-paper-500">{label}</dt>
            <dd className="mt-0.5 text-sm leading-relaxed text-paper-100">{text}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

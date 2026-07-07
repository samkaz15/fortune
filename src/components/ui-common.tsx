"use client";

/**
 * UI仕様v5の共通コンポーネント群(2026-07-06)
 * - GlassMosaic: 有料コンテンツのモザイク(CSS blur + glass。黒モザイク禁止)
 * - ScrollProgress: 結果画面のスクロール率プログレスバー
 * - FloatingCTA: 全診断共通の追従ボタン(余白付きFloating Button)
 * - ShareRow: SNS共有(Instagram/X/TikTok/LINE)。Web Share API+各インテント
 */
import { useEffect, useState, memo } from "react";
import Link from "next/link";

export function GlassMosaic({
  children,
  message,
  ctaLabel,
  ctaHref,
  note,
}: {
  children: React.ReactNode;
  message: string;
  ctaLabel: string;
  ctaHref: string;
  note?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-card border border-ink-700" style={{ minHeight: 190 }}>
      <div className="select-none p-5 blur-[8px]" aria-hidden>
        {children}
      </div>
      {/* glass effect(黒モザイク禁止): 半透明+backdrop-blurの磨りガラス */}
      <div className="absolute inset-0 flex flex-col items-center justify-end bg-ink-950/35 p-5 text-center backdrop-blur-[2px]">
        <p className="mb-3 text-[11px] font-bold leading-relaxed text-paper-100">{message}</p>
        <Link
          href={ctaHref}
          className="w-full rounded-full bg-gold-500 py-3 text-xs font-bold text-ink-950 shadow-[0_4px_0_#8a6b25] active:translate-y-1"
        >
          {ctaLabel}
        </Link>
        {note && <p className="mt-2 text-[10px] text-paper-400">{note}</p>}
      </div>
    </div>
  );
}

export function ScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setP(max > 0 ? Math.min(100, Math.round((h.scrollTop / max) * 100)) : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div className="fixed inset-x-0 top-0 z-50 h-[3px] bg-transparent">
      <div className="h-full bg-gradient-to-r from-gold-500 to-gold-400 transition-[width] duration-150" style={{ width: `${p}%` }} />
    </div>
  );
}

export function FloatingCTA({ label, href, note }: { label: string; href: string; note?: string }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 mx-auto max-w-md px-6">
      <Link
        href={href}
        className="pointer-events-auto block rounded-full bg-gold-500 py-3.5 text-center text-sm font-bold text-ink-950 shadow-[0_8px_24px_-6px_rgba(217,166,46,.55),0_4px_0_#8a6b25] active:translate-y-1"
      >
        {label}
      </Link>
      {note && <p className="pointer-events-none mt-1.5 text-center text-[10px] text-paper-400">{note}</p>}
    </div>
  );
}

export function ShareRow({ text, title }: { text: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? window.location.href : "";
  const enc = encodeURIComponent;
  async function nativeShare() {
    try {
      if (navigator.share) await navigator.share({ title: title ?? "糸町の少年", text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* キャンセルは無視 */
    }
  }
  return (
    <div className="mt-4">
      <p className="mb-2 text-center text-[10px] font-bold tracking-widest text-paper-500">SHARE ｜ 結果をシェア</p>
      <div className="flex justify-center gap-2">
        <a href={`https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`} target="_blank" rel="noreferrer" className="rounded-full border border-ink-700 px-4 py-2 text-[11px] font-bold text-paper-200">X</a>
        <a href={`https://social-plugins.line.me/lineit/share?url=${enc(url)}&text=${enc(text)}`} target="_blank" rel="noreferrer" className="rounded-full border border-ink-700 px-4 py-2 text-[11px] font-bold text-paper-200">LINE</a>
        {/* Instagram/TikTokは共有URLスキームが無いためネイティブ共有(アプリ選択)で対応 */}
        <button onClick={nativeShare} className="rounded-full border border-ink-700 px-4 py-2 text-[11px] font-bold text-paper-200">Instagram / TikTok</button>
      </div>
      {copied && <p className="mt-1 text-center text-[10px] text-gold-400">リンクをコピーしました</p>}
    </div>
  );
}

/**
 * アフィリエイト枠(UI仕様v5): 余白のみ確保・実装なし。
 * 上下40px余白、サイズ固定せず(横長/カード/画像/テキスト全対応の柔軟枠)。
 * サブスク導線を妨げない位置にのみ配置すること。
 */
/**
 * アフィリエイト枠(UI仕様v5): 余白のみ確保・実装なし。
 * 上下40px余白、サイズ固定せず(横長/カード/画像/テキスト全対応の柔軟枠)。
 * サブスク導線を妨げない位置にのみ配置すること。
 *
 * React.memoでラップ(監査Phase1 High対応 2026-07-07): label(文字列)のみに依存する
 * 純粋な表示コンポーネントで、全10ページ以上で繰り返し使われるため対象に選定。
 */
export const AffSlot = memo(function AffSlot({ label = "AD SLOT" }: { label?: string }) {
  return (
    <div className="my-10 flex min-h-[100px] w-full items-center justify-center rounded-2xl border border-dashed border-ink-700/40 text-[9px] tracking-[0.25em] text-ink-600">
      {label}
    </div>
  );
});

/**
 * 演出ローディング(監査Phase1 Critical対応 2026-07-07 再実装)。
 *
 * 元仕様(docs/design/06_conversion/conversion_spec.md §5): 3秒・3段階テキスト+
 * 目標勾配効果によるCVR施策。2026-07-07の速度改善時に誤って600msへ短縮してしまい、
 * self/love/workでは元々未実装だった。今回、CEO指示(最低2秒保証・API遅延時は
 * 応答後すぐ遷移)に合わせて再設計し、self/love/work/reportの4ページで共通化する。
 *
 * このコンポーネント自体は「与えられた時間だけメッセージを自動で切り替えて表示する」
 * 純粋な表示部品。実際の最低表示時間の制御(API応答が早くても待つ/遅ければ待たない)は
 * 呼び出し側のrun()関数が担う(withMinimumDuration参照)。
 */
export function DramaticLoading({
  messages,
  totalMs = 2000,
  accentClassName = "border-t-gold-500",
}: {
  /** 表示するメッセージ(2〜3個推奨)。ページごとに実際の処理内容に即した文言にする(事実でない演出文言は使わない) */
  messages: string[];
  /** 全メッセージを表示しきるまでの合計時間(ms)。呼び出し側の最低保証時間と合わせる */
  totalMs?: number;
  /** スピナーのアクセント色クラス。ページ固有の視覚アイデンティティ(例: loveページのrose)を維持するため上書き可能 */
  accentClassName?: string;
}) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (messages.length <= 1) return;
    const perStep = totalMs / messages.length;
    const timers = messages.slice(1).map((_, i) => setTimeout(() => setStep(i + 1), perStep * (i + 1)));
    return () => timers.forEach(clearTimeout);
  }, [messages, totalMs]);

  return (
    <div className="flex flex-col items-center gap-5 pt-32">
      <div className={`h-16 w-16 animate-spin rounded-full border-2 border-ink-700 ${accentClassName}`} />
      <p className="animate-pulse text-sm text-paper-200">{messages[Math.min(step, messages.length - 1)]}</p>
    </div>
  );
}

/**
 * 「最低表示時間を保証しつつ、API応答が遅ければ待たずに結果を返す」実行ラッパー。
 * - API応答が速い(例: 200ms) → 残り時間だけ待ってから解決(最低minMs秒は演出を見せる)
 * - API応答が遅い(例: 4000ms) → 追加待機なしで即座に解決(取得後すぐ遷移)
 * self/love/work/reportのrun()関数から共通で呼び出す。
 */
export async function withMinimumDuration<T>(task: Promise<T>, minMs = 2000): Promise<T> {
  const startedAt = Date.now();
  const result = await task;
  const elapsed = Date.now() - startedAt;
  if (elapsed < minMs) {
    await new Promise((resolve) => setTimeout(resolve, minMs - elapsed));
  }
  return result;
}

/**
 * プライマリCTAボタン(監査Phase2 Medium対応 2026-07-07新設)。
 * 「灯籠の金」の疑似立体シャドウ(shadow-[0_4px_0_#8a6b25]+押下でtranslate-y)は
 * self/love/work/report等9箇所に個別コピペされており、将来の一括変更が困難だった。
 * hrefがあればLinkとして、なければbuttonとして振る舞う(既存の呼び出しパターンを両対応)。
 */
export function PrimaryButton({
  children,
  href,
  onClick,
  disabled,
  size = "md",
  textSize,
  className = "",
}: {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** md=py-3.5(主要フォーム送信ボタン) / sm=py-3(結果画面内のCTA) */
  size?: "md" | "sm";
  /** サイズ既定のフォントサイズ(md=text-sm/sm=text-xs)を上書きしたい場合に指定 */
  textSize?: "text-xs" | "text-sm";
  className?: string;
}) {
  const py = size === "md" ? "py-3.5" : "py-3";
  const resolvedTextSize = textSize ?? (size === "md" ? "text-sm" : "text-xs");
  const base = `w-full rounded-full bg-gold-500 ${py} text-center ${resolvedTextSize} font-bold text-ink-950 shadow-[0_4px_0_#8a6b25] active:translate-y-1 active:shadow-none disabled:opacity-40 ${className}`;
  if (href) {
    return (
      <Link href={href} className={base}>
        {children}
      </Link>
    );
  }
  return (
    <button onClick={onClick} disabled={disabled} className={base}>
      {children}
    </button>
  );
}

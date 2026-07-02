"use client";

/**
 * IA設計書の「診断結果を未ログインでも閲覧可にしバイラル資産にする」方針を実装するUI。
 * Web Share APIが使える環境ではネイティブシェア、使えない場合はURLコピーにフォールバックする。
 */
export function ShareButtons({ resultId }: { resultId: string }) {
  async function handleShare() {
    const url = `${window.location.origin}/result/${resultId}`;
    const text = "今日の運勢を占ってもらった。#糸町の少年";

    if (navigator.share) {
      await navigator.share({ url, text });
    } else {
      await navigator.clipboard.writeText(url);
      alert("URLをコピーしたよ");
    }
  }

  return (
    <button
      onClick={handleShare}
      className="w-full rounded-full border border-gold-500/60 py-3 text-center text-sm font-bold text-gold-400"
    >
      シェアする
    </button>
  );
}

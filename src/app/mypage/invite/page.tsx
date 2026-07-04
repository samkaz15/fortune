"use client";

import { useEffect, useState } from "react";

interface ReferralData {
  referralCode: string;
  inviteUrl: string;
  invitedCount: number;
  pointBalance: number;
}

/** CL20: マイページ配下の「友達を招待」画面(IA設計書⑨の設計位置通り) */
export default function InviteFriendPage() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/referral")
      .then(async (res) => {
        if (res.status === 401) {
          setError("ログインが必要だよ。");
          return null;
        }
        return res.json();
      })
      .then((d) => d && setData(d));
  }, []);

  async function copyLink() {
    if (!data) return;
    if (navigator.share) {
      await navigator.share({
        url: data.inviteUrl,
        text: "「糸町の少年」で占ってもらってるんだけど、このリンクから登録すると2人ともポイントもらえるよ",
      });
      return;
    }
    await navigator.clipboard.writeText(data.inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (error) return <p className="pt-8 text-center text-sm text-paper-400">{error}</p>;
  if (!data) return <p className="pt-8 text-center text-sm text-paper-400">読み込み中…</p>;

  return (
    <div className="flex flex-col gap-5 px-5 pt-4">
      <h1 className="font-display text-lg text-paper-50">友達を招待</h1>

      <div className="rounded-card border border-torii-500/40 bg-ink-900/60 p-5 text-center">
        <p className="text-sm leading-relaxed text-paper-200">
          友達がこのリンクから登録すると、
          <br />
          あなたにも友達にも
          <span className="font-bold text-gold-400">質問1回分のポイント</span>
          が入ります。
        </p>
        <div className="mt-4 rounded-full border border-ink-700 bg-ink-950 px-4 py-2 text-xs text-paper-400">
          {data.inviteUrl}
        </div>
        <button
          onClick={copyLink}
          className="mt-3 w-full rounded-full bg-gold-500 py-3 text-sm font-bold text-ink-950"
        >
          {copied ? "コピーしたよ" : "リンクをシェアする"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-card border border-ink-700 bg-ink-900/40 p-4 text-center">
          <p className="text-[11px] text-paper-400">これまでに招待した人</p>
          <p className="mt-1 font-display text-lg text-gold-400">{data.invitedCount}人</p>
        </div>
        <div className="rounded-card border border-ink-700 bg-ink-900/40 p-4 text-center">
          <p className="text-[11px] text-paper-400">ポイント残高</p>
          <p className="mt-1 font-display text-lg text-gold-400">{data.pointBalance}</p>
        </div>
      </div>
    </div>
  );
}

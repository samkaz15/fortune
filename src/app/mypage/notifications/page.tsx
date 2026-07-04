"use client";

import { useEffect, useState } from "react";

/**
 * 画面遷移設計書「通知設定」の実装(CL17で高度化)。
 * プッシュ通知ON/OFFと、95点通知のしきい値をユーザーが変更できる。
 */
export default function NotificationSettingsPage() {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [threshold, setThreshold] = useState(95);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/notifications/settings")
      .then(async (res) => {
        if (res.status === 401) {
          setError("ログインが必要だよ。");
          return null;
        }
        return res.json();
      })
      .then((d) => {
        if (d) {
          setPushEnabled(d.pushEnabled);
          setThreshold(d.scoreThreshold);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function save(next: { pushEnabled?: boolean; scoreThreshold?: number }) {
    setSaved(false);
    const res = await fetch("/api/notifications/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  if (loading) return <p className="pt-8 text-center text-sm text-paper-400">読み込み中…</p>;
  if (error) return <p className="pt-8 text-center text-sm text-paper-400">{error}</p>;

  return (
    <div className="flex flex-col gap-4 px-5 pt-4">
      <h1 className="font-display text-lg text-paper-50">通知設定</h1>

      <button
        onClick={() => {
          const next = !pushEnabled;
          setPushEnabled(next);
          save({ pushEnabled: next });
        }}
        className="flex items-center justify-between rounded-card border border-ink-700 bg-ink-900/40 p-4"
      >
        <span className="text-sm text-paper-200">プッシュ通知</span>
        <span className={`text-sm font-bold ${pushEnabled ? "text-gold-400" : "text-paper-600"}`}>
          {pushEnabled ? "ON" : "OFF"}
        </span>
      </button>

      <div className="rounded-card border border-ink-700 bg-ink-900/40 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-paper-200">運気通知のしきい値</span>
          <span className="text-sm font-bold text-gold-400">{threshold}点以上</span>
        </div>
        <input
          type="range"
          min={80}
          max={100}
          step={1}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          onMouseUp={() => save({ scoreThreshold: threshold })}
          onTouchEnd={() => save({ scoreThreshold: threshold })}
          className="w-full accent-gold-500"
        />
        <p className="mt-2 text-xs text-paper-600">
          運気がこの点数以上の日だけ、通知が届きます。特別な日だけ知りたいなら高めがおすすめ。
        </p>
      </div>

      {saved && <p className="text-center text-xs text-gold-400">保存したよ</p>}

      <LineLinkSection />
    </div>
  );
}

/**
 * CL22(簡略版): LINE連携は自前のOAuth/Webhook実装ではなく、
 * 外部の公式LINEアカウントへ <a href> で誘導するだけの方式に変更(2026-07-03決定)。
 * LINE Developersでのチャネル開設が不要になり、実装コストがゼロに近い。
 * 面談チケット(CEO2)の案内も同じ公式LINEアカウントに一本化される。
 */
function LineLinkSection() {
  const lineUrl = process.env.NEXT_PUBLIC_LINE_OFFICIAL_URL;

  return (
    <div className="rounded-card border border-ink-700 bg-ink-900/40 p-4">
      <p className="mb-1 text-sm text-paper-200">公式LINE</p>
      <p className="mb-3 text-xs text-paper-600">
        友だち追加すると、運気のいい日のお知らせや面談の案内もLINEで受け取れます。
      </p>
      {lineUrl ? (
        <a
          href={lineUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full rounded-full border border-gold-500/50 py-2.5 text-center text-xs font-bold text-gold-400"
        >
          公式LINEを友だち追加する
        </a>
      ) : (
        <p className="text-center text-xs text-paper-600">(公式LINEのURLは準備中です)</p>
      )}
    </div>
  );
}

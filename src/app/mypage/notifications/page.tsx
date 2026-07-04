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

function LineLinkSection() {
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);

  async function issueCode() {
    setIssuing(true);
    try {
      const res = await fetch("/api/line/link", { method: "POST" });
      if (res.ok) {
        const d = await res.json();
        setLinkCode(d.linkCode);
      }
    } finally {
      setIssuing(false);
    }
  }

  return (
    <div className="rounded-card border border-ink-700 bg-ink-900/40 p-4">
      <p className="mb-1 text-sm text-paper-200">LINE連携</p>
      <p className="mb-3 text-xs text-paper-600">
        公式LINEと連携すると、運気のいい日の通知をLINEでも受け取れます。
      </p>
      {linkCode ? (
        <div className="text-center">
          <p className="mb-1 text-xs text-paper-400">公式LINEのトークにこのコードを送ってね(10分有効)</p>
          <p className="font-display text-2xl tracking-[0.3em] text-gold-400">{linkCode}</p>
        </div>
      ) : (
        <button
          onClick={issueCode}
          disabled={issuing}
          className="w-full rounded-full border border-gold-500/50 py-2.5 text-xs font-bold text-gold-400 disabled:opacity-40"
        >
          連携コードを発行する
        </button>
      )}
    </div>
  );
}

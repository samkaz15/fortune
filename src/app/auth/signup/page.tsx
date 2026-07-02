"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    password: "",
    displayName: "",
    familyName: "",
    givenName: "",
    birthDate: "",
    birthTime: "",
    gender: "unspecified",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error === "EMAIL_TAKEN" ? "このメールアドレスは登録済みです。" : "登録に失敗しました。");
      return;
    }
    router.push("/mypage");
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8 pb-8">
      <div>
        <h1 className="font-display text-lg text-paper-50">新規登録</h1>
        <p className="mt-1 text-xs text-paper-400">占いに使うので、正しい生年月日を入力してね。</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="ニックネーム">
          <input
            required
            value={form.displayName}
            onChange={(e) => update("displayName", e.target.value)}
            className="input"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="姓">
            <input required value={form.familyName} onChange={(e) => update("familyName", e.target.value)} className="input" />
          </Field>
          <Field label="名">
            <input required value={form.givenName} onChange={(e) => update("givenName", e.target.value)} className="input" />
          </Field>
        </div>
        <Field label="生年月日">
          <input
            type="date"
            required
            value={form.birthDate}
            onChange={(e) => update("birthDate", e.target.value)}
            className="input"
          />
        </Field>
        <Field label="出生時間(わかれば)">
          <input type="time" value={form.birthTime} onChange={(e) => update("birthTime", e.target.value)} className="input" />
        </Field>
        <Field label="メールアドレス">
          <input type="email" required value={form.email} onChange={(e) => update("email", e.target.value)} className="input" />
        </Field>
        <Field label="パスワード(8文字以上)">
          <input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            className="input"
          />
        </Field>

        {error && <p className="text-xs text-torii-500">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-full bg-gold-500 py-3 text-sm font-bold text-ink-950 disabled:opacity-40"
        >
          登録する
        </button>
      </form>

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 9999px;
          border: 1px solid #2a2a52;
          background: #1e1e3d;
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          color: #f7f3e9;
          outline: none;
        }
        .input:focus-visible {
          border-color: #d9a62e;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-paper-400">{label}</span>
      {children}
    </label>
  );
}

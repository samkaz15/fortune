"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { track } from "@/lib/track-client";
import { loadFortuneInput } from "@/lib/fortune-input";
import { BirthDateSelect } from "@/components/BirthDateSelect";

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralCode = searchParams.get("ref") ?? undefined;
  // 占い画面からの遷移元(要件⑥)。オープンリダイレクト防止のため内部パスのみ許可
  const fromParam = searchParams.get("from");
  const returnTo = fromParam && /^\/(?!\/)/.test(fromParam) ? fromParam : "/mypage";
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

  useEffect(() => {
    // 占い画面で入力済みの名前・生年月日を引き継いでプレフィル(要件⑥: 体験を途切れさせない)
    const saved = loadFortuneInput();
    if (saved) {
      const raw = saved.name.replace(/[\s\u3000]+/g, " ").trim();
      const [family, ...rest] = raw.split(" ");
      setForm((prev) => ({
        ...prev,
        familyName: prev.familyName || (rest.length > 0 ? family : raw.slice(0, 1)),
        givenName: prev.givenName || (rest.length > 0 ? rest.join("") : raw.slice(1)),
        birthDate: prev.birthDate || saved.birthDate,
      }));
    }
    track("signup_started", { hasReferral: Boolean(referralCode) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      body: JSON.stringify({ ...form, referralCode }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error === "EMAIL_TAKEN" ? "このメールアドレスは登録済みです。" : "登録に失敗しました。");
      return;
    }
    router.push(returnTo);
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
          <BirthDateSelect value={form.birthDate} onChange={(v) => update("birthDate", v)} />
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

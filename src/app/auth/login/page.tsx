"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      setError("メールアドレスかパスワードが違うみたい。");
      return;
    }
    router.push("/mypage");
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <h1 className="font-display text-lg text-paper-50">ログイン</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="メールアドレス"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-full border border-ink-700 bg-ink-900 px-4 py-3 text-sm text-paper-50 outline-none focus-visible:border-gold-500"
        />
        <input
          type="password"
          required
          placeholder="パスワード"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-full border border-ink-700 bg-ink-900 px-4 py-3 text-sm text-paper-50 outline-none focus-visible:border-gold-500"
        />
        {error && <p className="text-xs text-torii-500">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-gold-500 py-3 text-sm font-bold text-ink-950 disabled:opacity-40"
        >
          ログイン
        </button>
      </form>
      <p className="text-center text-xs text-paper-400">
        アカウントがまだの方は{" "}
        <Link href="/auth/signup" className="text-gold-400 underline">
          新規登録
        </Link>
      </p>
    </div>
  );
}

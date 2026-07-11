"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, User, Menu, X } from "lucide-react";

/**
 * 共通Header(CEO要求 2026-07-05: 右上に必ずハンバーガーメニューを設置)。
 * 左: TOPはロゴ / それ以外は戻るボタン。
 * 右: ハンバーガー(実装済み機能の一覧ドロワー) + ログインアイコン。
 */

const MENU: { href: string; label: string; note?: string }[] = [
  { href: "/", label: "ホーム", note: "今日は何をみる？" },
  { href: "/report", label: "今日の運勢", note: "今日・今週・今月・来月" },
  { href: "/self", label: "自分のこと", note: "本来の性格・強み・今日の行動" },
  { href: "/love", label: "恋愛・相性占い", note: "ふたりの関係を整理する" },
  { href: "/work", label: "仕事・キャリア占い", note: "働き方の本質と中長期の流れ" },
  { href: "/calendar", label: "風水カレンダー", note: "あなたの開運日と注意日" },
  { href: "/auction", label: "トークション", note: "電話占いオークション" },
  { href: "/shrines", label: "縁のある神社", note: "今日の運気に合う参拝先" },
  { href: "/plans", label: "プラン・お支払い" },
  { href: "/mypage", label: "マイページ" },
  { href: "/mypage/notifications", label: "通知設定" },
  { href: "/legal/terms", label: "利用規約" },
  { href: "/legal/privacy", label: "プライバシーポリシー" },
  { href: "/legal/tokushoho", label: "特定商取引法に基づく表記" },
  { href: "/support", label: "お問い合わせ・サポート", note: "公式LINEでご案内します" },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const isTop = pathname === "/";
  const [open, setOpen] = useState(false);
  // 実セッション状態(CEO要求 2026-07-07: 人マークはログイン時マイページへ+設定画像/頭文字を表示)
  const [me, setMe] = useState<{ loggedIn: boolean; displayName: string | null; avatar: string | null }>({ loggedIn: false, displayName: null, avatar: null });
  useEffect(() => {
    // 体感速度改善(2026-07-07): セッション中はキャッシュを即時表示し、裏で最新化。
    // ページ遷移ごとの待ちを無くす(stale-while-revalidate)
    const cached = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("me") : null;
    if (cached) {
      try { setMe(JSON.parse(cached)); } catch { /* noop */ }
    }
    const load = () =>
      fetch("/api/auth/me")
        .then((r) => r.json())
        .then((d) => {
          setMe(d);
          try { sessionStorage.setItem("me", JSON.stringify(d)); } catch { /* noop */ }
        })
        .catch(() => {});
    load();
    window.addEventListener("avatar-updated", load);
    return () => window.removeEventListener("avatar-updated", load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const isLoggedIn = me.loggedIn;

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 mx-auto flex h-14 max-w-md items-center justify-between bg-ink-950/80 px-4 backdrop-blur">
        {isTop ? (
          <Link href="/" className="font-display text-lg tracking-wide text-gold-400">
            錦糸町の少年
          </Link>
        ) : (
          <button
            onClick={() => router.back()}
            aria-label="前の画面に戻る"
            className="flex h-9 w-9 items-center justify-center rounded-full text-paper-200 hover:bg-ink-800"
          >
            <ChevronLeft size={22} />
          </button>
        )}

        <div className="flex items-center gap-2">
          <Link
            href={isLoggedIn ? "/mypage" : "/auth/login"}
            aria-label={isLoggedIn ? "マイページ" : "ログイン"}
            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-ink-800 text-paper-200"
          >
            {me.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={me.avatar} alt="" className="h-full w-full object-cover" />
            ) : isLoggedIn && me.displayName ? (
              <span className="font-display text-sm text-gold-400">{me.displayName.slice(0, 1)}</span>
            ) : (
              <User size={18} />
            )}
          </Link>
          <button
            onClick={() => setOpen(true)}
            aria-label="メニューを開く"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-800 text-paper-200"
          >
            <Menu size={18} />
          </button>
        </div>
      </header>

      {/* ドロワー(実装済み機能の一覧) */}
      {open && (
        <div className="fixed inset-0 z-50" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <nav
            className="absolute right-0 top-0 h-full w-72 overflow-y-auto border-l border-ink-700 bg-ink-950 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-bold text-gold-400">メニュー</p>
              <button onClick={() => setOpen(false)} aria-label="閉じる" className="flex h-8 w-8 items-center justify-center rounded-full text-paper-300 hover:bg-ink-800">
                <X size={18} />
              </button>
            </div>
            <ul className="space-y-1">
              {MENU.map((m) => (
                <li key={m.href}>
                  <Link
                    href={m.href}
                    onClick={() => setOpen(false)}
                    className={`block rounded-xl px-3 py-2.5 transition hover:bg-ink-800 ${pathname === m.href ? "bg-ink-800" : ""}`}
                  >
                    <span className="block text-[13px] font-bold text-paper-100">{m.label}</span>
                    {m.note && <span className="block text-[10px] text-paper-500">{m.note}</span>}
                  </Link>
                </li>
              ))}
            </ul>
            <button
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
                setOpen(false);
                window.location.href = "/";
              }}
              className="mt-4 w-full rounded-xl border border-ink-700 px-3 py-2.5 text-left text-[13px] font-bold text-paper-400 hover:bg-ink-800"
            >
              ログアウト
            </button>
          </nav>
        </div>
      )}
    </>
  );
}

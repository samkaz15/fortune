"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, User, Menu, X } from "lucide-react";

/**
 * 共通Header(CEO要求 2026-07-05: 右上に必ずハンバーガーメニューを設置)。
 * 左: TOPはロゴ / それ以外は戻るボタン。
 * 右: ハンバーガー(実装済み機能の一覧ドロワー) + ログインアイコン。
 */

const MENU: { href: string; label: string; note?: string }[] = [
  { href: "/", label: "ホーム", note: "今日は何をみる？" },
  { href: "/report", label: "今日のレポート", note: "毎朝の意思決定レポート" },
  { href: "/consult", label: "相談チャット", note: "糸町の少年と話す(1日5回無料)" },
  { href: "/calendar", label: "風水カレンダー", note: "あなたの開運日と注意日" },
  { href: "/auction", label: "トークション", note: "電話占いオークション" },
  { href: "/shrines", label: "縁のある神社", note: "今日の運気に合う参拝先" },
  { href: "/news", label: "お知らせ" },
  { href: "/plans", label: "プラン・お支払い" },
  { href: "/mypage", label: "マイページ" },
  { href: "/settings/notifications", label: "通知設定" },
  { href: "/legal/terms", label: "利用規約" },
  { href: "/legal/privacy", label: "プライバシーポリシー" },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const isTop = pathname === "/";
  const isLoggedIn = false; // TODO: 認証セッションから取得する
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 mx-auto flex h-14 max-w-md items-center justify-between bg-ink-950/80 px-4 backdrop-blur">
        {isTop ? (
          <Link href="/" className="font-display text-lg tracking-wide text-gold-400">
            糸町の少年
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
            className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-800 text-paper-200"
          >
            <User size={18} />
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
          </nav>
        </div>
      )}
    </>
  );
}

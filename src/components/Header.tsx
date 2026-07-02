"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, User } from "lucide-react";

/**
 * 画面遷移設計書 ④共通UI「Header」の実装。
 * 左：TOPはロゴ、それ以外は戻るボタン固定。
 * 右：ログイン状態アイコン（未ログイン/ログイン済みで出し分け）。
 * ※ isLoggedIn は現状ダミー。認証実装(CL未着手分)で差し替える。
 */
export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const isTop = pathname === "/";
  const isLoggedIn = false; // TODO: 認証セッションから取得する

  return (
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

      <Link
        href={isLoggedIn ? "/mypage" : "/auth/login"}
        aria-label={isLoggedIn ? "マイページ" : "ログイン"}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-800 text-paper-200"
      >
        <User size={18} />
      </Link>
    </header>
  );
}

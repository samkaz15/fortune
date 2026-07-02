"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageCircle, Bell, User } from "lucide-react";

/**
 * 画面遷移設計書 Level1（メイン画面）を担う4タブ固定ナビ。
 * ここは絶対にタブ数を増やさない設計原則（設計書⑨参照）。
 * AIチャット相談導入時のみ5タブ化を検討する。
 */
const TABS = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/consult", label: "占い相談", icon: MessageCircle },
  { href: "/news", label: "お知らせ", icon: Bell },
  { href: "/mypage", label: "マイページ", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="メインナビゲーション"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto flex h-16 max-w-md items-stretch border-t border-ink-700 bg-ink-950/95 backdrop-blur"
    >
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-1 flex-col items-center justify-center gap-1 text-[11px]"
          >
            <Icon
              size={20}
              className={active ? "text-gold-400" : "text-paper-600"}
              strokeWidth={active ? 2.4 : 1.8}
            />
            <span className={active ? "text-gold-400" : "text-paper-600"}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 下部ナビ(マスターデザイン=LP index.htmlの.bnavに完全統一 / CEO指示 2026-07-07)。
 * アイコン・余白・サイズ・色・角丸・選択状態までLPと同一仕様。
 * 全画面共通コンポーネント(layout.tsxで一括使用。今後の新画面も自動で同一ナビ)。
 */
const TABS = [
  { href: "/", label: "ホーム", icon: "⌂" },
  { href: "/consult", label: "占い相談", icon: "💬" },
  { href: "/news", label: "お知らせ", icon: "🔔" },
  { href: "/mypage", label: "マイページ", icon: "👤" },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed bottom-0 left-1/2 z-40 grid w-full max-w-md -translate-x-1/2 grid-cols-4 border-t"
      style={{
        background: "rgba(10,18,27,.92)",
        backdropFilter: "blur(10px)",
        borderColor: "#243A50",
        padding: "8px 0 max(10px, env(safe-area-inset-bottom))",
      }}
    >
      {TABS.map(({ href, label, icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-[3px] text-[9px] font-extrabold no-underline"
            style={{ color: active ? "#D9B45C" : "#7C8DA0" }}
          >
            <i className="not-italic text-[17px] leading-none">{icon}</i>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

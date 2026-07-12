"use client";

/**
 * HeroImage (2026-07-12): レポートのヒーロー画像。
 * Gemini生成10枚(public/character/hero/)をスコア×時間帯で出し分け、
 * 未配置・読み込み失敗時は既存のreport_hero.jpgへ自動フォールバックする。
 * 画像は1枚ずつ追加していけばその分だけ出し分けが有効になる(全10枚必須ではない)。
 */
import { useState } from "react";
import { selectHeroImage, HERO_FALLBACK } from "@/lib/hero-image";

export function HeroImage({ score, dateKey }: { score: number; dateKey: string }) {
  const [src, setSrc] = useState(() => selectHeroImage(score, dateKey));
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="錦糸町の少年"
      onError={() => src !== HERO_FALLBACK && setSrc(HERO_FALLBACK)}
      className="mb-3 h-36 w-full rounded-card border border-ink-700 object-cover shadow-lantern"
      style={{ objectPosition: "center 30%" }}
    />
  );
}

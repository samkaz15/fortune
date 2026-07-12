"use client";

/**
 * SakuraPetals (2026-07-12 CEO指示: 診断結果で花びらが舞う演出)
 *
 * - 純CSSアニメーション(JSタイマー不使用)。pointer-events: none で操作を邪魔しない
 * - 花びらの初期配置はハードコード配列(SSR/CSRのハイドレーション不一致を避けるため
 *   Math.random()をレンダー中に使わない)
 * - prefers-reduced-motion: reduce の環境では表示しない(アクセシビリティ)
 * - durationMs経過後は自動でアンマウント(演出は「結果が出た瞬間」だけ。読む邪魔をしない)
 */
import { useEffect, useState } from "react";

interface PetalConfig {
  left: number; // 開始位置(%)
  delay: number; // 落下開始遅延(s)
  duration: number; // 落下時間(s)
  size: number; // px
  drift: number; // 横揺れ幅(px)
  rotate: number; // 回転方向(deg/loop)
}

// 疑似ランダムだが固定の配置(ハイドレーション安全)
const PETALS: PetalConfig[] = [
  { left: 4, delay: 0.0, duration: 7.2, size: 12, drift: 42, rotate: 320 },
  { left: 12, delay: 1.1, duration: 8.4, size: 9, drift: -34, rotate: -280 },
  { left: 21, delay: 0.4, duration: 6.6, size: 14, drift: 51, rotate: 360 },
  { left: 30, delay: 1.8, duration: 9.0, size: 10, drift: -46, rotate: 300 },
  { left: 38, delay: 0.7, duration: 7.8, size: 13, drift: 38, rotate: -340 },
  { left: 47, delay: 2.2, duration: 8.8, size: 8, drift: -29, rotate: 260 },
  { left: 55, delay: 0.2, duration: 7.0, size: 15, drift: 47, rotate: -300 },
  { left: 63, delay: 1.5, duration: 8.2, size: 11, drift: -41, rotate: 330 },
  { left: 71, delay: 0.9, duration: 6.9, size: 12, drift: 35, rotate: -270 },
  { left: 79, delay: 2.0, duration: 9.2, size: 9, drift: -49, rotate: 290 },
  { left: 87, delay: 0.5, duration: 7.5, size: 13, drift: 44, rotate: -350 },
  { left: 94, delay: 1.3, duration: 8.0, size: 10, drift: -37, rotate: 310 },
];

export function SakuraPetals({ durationMs = 9000 }: { durationMs?: number }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), durationMs);
    return () => clearTimeout(t);
  }, [durationMs]);

  if (!visible) return null;

  return (
    <div aria-hidden className="petals-overlay pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {PETALS.map((p, i) => (
        <span
          key={i}
          className="petal"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.85,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            // CSS変数で個体差(横揺れ・回転)を渡す
            ["--drift" as string]: `${p.drift}px`,
            ["--rotate" as string]: `${p.rotate}deg`,
          }}
        />
      ))}
      <style jsx>{`
        .petal {
          position: absolute;
          top: -24px;
          border-radius: 80% 0 80% 0; /* 花びら形 */
          background: linear-gradient(135deg, #ffd7e6 0%, #ffaec9 55%, #ff8fb3 100%);
          opacity: 0.85;
          animation-name: petal-fall;
          animation-timing-function: linear;
          animation-iteration-count: 1;
          animation-fill-mode: forwards;
          box-shadow: 0 0 6px rgba(255, 175, 200, 0.35);
        }
        @keyframes petal-fall {
          0% {
            transform: translate3d(0, -3vh, 0) rotate(0deg);
            opacity: 0;
          }
          8% {
            opacity: 0.9;
          }
          50% {
            transform: translate3d(var(--drift), 50vh, 0) rotate(calc(var(--rotate) / 2));
          }
          92% {
            opacity: 0.8;
          }
          100% {
            transform: translate3d(calc(var(--drift) * -0.6), 104vh, 0) rotate(var(--rotate));
            opacity: 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .petals-overlay {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

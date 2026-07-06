"use client";

import { useEffect } from "react";

/**
 * 天の川背景 + 控えめな流れ星（UX5/6/7 本実装で共通利用）。
 * 流れ星は画面端のみ・7〜16秒間隔・小さく（視界の邪魔をしない設計）。
 */
export function MilkyWayBackground() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    function spawn() {
      if (stopped) return;
      const s = document.createElement("span");
      s.className = "shoot-star";
      const edgeLeft = Math.random() < 0.5;
      const startX = edgeLeft ? Math.random() * 18 : 68 + Math.random() * 20;
      const startY = Math.random() * 26;
      const dx = 10 + Math.random() * 8;
      const dy = dx * (0.3 + Math.random() * 0.15);
      const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
      s.style.left = `${startX}vw`;
      s.style.top = `${startY}vh`;
      s.style.setProperty("--dx", `${dx}vw`);
      s.style.setProperty("--dy", `${dy}vh`);
      s.style.setProperty("--ang", `${ang}deg`);
      s.style.animation = `shootAcross ${1.3 + Math.random() * 0.5}s ease-in forwards`;
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 2200);
      timer = setTimeout(spawn, 7000 + Math.random() * 9000);
    }
    timer = setTimeout(spawn, 3000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <>
      <div className="mw-sky" />
      <div className="mw-band" />
      <style jsx global>{`
        .mw-sky {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          background-image: radial-gradient(1px 1px at 16% 22%, rgba(255, 255, 255, 0.6), transparent 55%),
            radial-gradient(1.5px 1.5px at 78% 14%, rgba(214, 226, 255, 0.7), transparent 55%),
            radial-gradient(1px 1px at 44% 54%, rgba(214, 226, 255, 0.5), transparent 55%),
            radial-gradient(1px 1px at 88% 66%, rgba(255, 255, 255, 0.45), transparent 55%),
            radial-gradient(1px 1px at 30% 82%, rgba(255, 244, 214, 0.5), transparent 55%);
          animation: mwtw 6s ease-in-out infinite;
        }
        .mw-band {
          position: fixed;
          inset: -15% -20%;
          pointer-events: none;
          z-index: 0;
          background: linear-gradient(
            115deg,
            transparent 32%,
            rgba(110, 130, 200, 0.07) 44%,
            rgba(190, 170, 220, 0.11) 50%,
            rgba(110, 130, 200, 0.07) 56%,
            transparent 68%
          );
          filter: blur(26px);
        }
        @keyframes mwtw {
          0%,
          100% {
            opacity: 0.85;
          }
          50% {
            opacity: 0.4;
          }
        }
        .shoot-star {
          position: fixed;
          top: 0;
          left: 0;
          width: 52px;
          height: 1px;
          z-index: 0;
          pointer-events: none;
          background: linear-gradient(90deg, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.55));
          border-radius: 99px;
          opacity: 0;
        }
        @keyframes shootAcross {
          0% {
            opacity: 0;
            transform: translate(0, 0) rotate(var(--ang));
          }
          10% {
            opacity: 0.55;
          }
          100% {
            opacity: 0;
            transform: translate(var(--dx), var(--dy)) rotate(var(--ang));
          }
        }
      `}</style>
    </>
  );
}

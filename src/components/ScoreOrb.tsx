/**
 * このプロダクトの signature element(frontend-designスキルでいう"サイン")。
 * 「今日の運気」を月の満ち欠けに見立てた発光オーブで表現する。
 * TOP・診断結果・マイページなど、スコアが登場する箇所で一貫して使い、
 * 「糸町の少年といえばこの円」という視覚的な記名性を作る。
 */
export function ScoreOrb({ score, size = 120 }: { score: number; size?: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const glowOpacity = 0.25 + (clamped / 100) * 0.55;

  return (
    <div
      className="relative flex items-center justify-center rounded-full"
      style={{ width: size, height: size }}
    >
      <div
        className="absolute inset-0 rounded-full blur-2xl"
        style={{
          background: `radial-gradient(circle, rgba(217,166,46,${glowOpacity}) 0%, rgba(217,166,46,0) 70%)`,
        }}
        aria-hidden
      />
      <div
        className="relative flex h-full w-full items-center justify-center rounded-full border border-gold-500/40 bg-ink-900"
        style={{
          background: `conic-gradient(#D9A62E ${clamped}%, #2A2A52 ${clamped}% 100%)`,
        }}
      >
        <div className="flex h-[82%] w-[82%] flex-col items-center justify-center rounded-full bg-ink-950">
          <span className="font-display text-2xl text-gold-400">{clamped}</span>
          <span className="text-[10px] text-paper-400">今日の運気</span>
        </div>
      </div>
    </div>
  );
}

/**
 * クライアント側(Reactコンポーネント・LP静的HTML)から計測イベントを送信する薄いヘルパー。
 * /api/analytics/track を叩くだけ。失敗してもUIをブロックしない(fire-and-forget)。
 * (計測基盤 2026-07-07・Marketing-083)
 */
export function track(name: string, props?: Record<string, unknown>): void {
  try {
    fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, props }),
      keepalive: true, // ページ遷移直前でも送信を試みる
    }).catch(() => {});
  } catch {
    /* noop */
  }
}

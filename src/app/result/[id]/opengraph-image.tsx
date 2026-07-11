import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";

/**
 * GET /result/[id]/opengraph-image
 * 診断結果ごとのブランド化されたOGP画像を動的生成する(シェア機能拡充・2026-07-07・Marketing-008)。
 * SNSシェア時のサムネイル品質が口コミの質を左右する最重要施策(docs/marketing/05_Referral.md参照)。
 * Next.js App Routerの規約ファイル(opengraph-image)として配置すると、
 * 該当ページのOGPメタタグに自動で接続される。
 */
export const runtime = "nodejs";
export const alt = "錦糸町の少年 診断結果";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage({ params }: { params: { id: string } }) {
  const result = await prisma.fortuneResult.findUnique({
    where: { id: params.id },
    select: { summary: true, scoreOverall: true },
  });

  const score = result?.scoreOverall ?? null;
  // summaryは長文のため、シェア画像には最初の一文だけを抜粋(表示崩れ防止)
  const headline = result?.summary ? result.summary.split(/[。、]/)[0] : "今日の運勢を占ってもらった";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(120% 140% at 50% 0%, #2a2a52 0%, #1e1e3d 45%, #101026 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, color: "#D9A62E", letterSpacing: 8, marginBottom: 16 }}>錦糸町の少年</div>
        {score !== null ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 220,
              height: 220,
              borderRadius: "50%",
              border: "10px solid #D9A62E",
              marginBottom: 24,
            }}
          >
            <div style={{ display: "flex", fontSize: 72, color: "#F7F3E9", fontWeight: 700 }}>{score}</div>
          </div>
        ) : null}
        <div
          style={{
            display: "flex",
            fontSize: 36,
            color: "#F7F3E9",
            maxWidth: 900,
            textAlign: "center",
            lineHeight: 1.5,
            padding: "0 40px",
          }}
        >
          {headline}
        </div>
        <div style={{ display: "flex", marginTop: 32, fontSize: 22, color: "#847C9C" }}>錦糸町の少年 — AI占い</div>
      </div>
    ),
    { ...size }
  );
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  // CL29: キャッシュ/CDN強化。静的アセットはエッジ/ブラウザで長期キャッシュし、
  // オリジン(Next.jsサーバー)への到達自体を減らす(GM10「エッジ活用」準拠)。
  async headers() {
    return [
      {
        source: "/character/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, s-maxage=604800, immutable" }],
      },
      {
        source: "/api/health",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;

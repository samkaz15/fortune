import type { Config } from "tailwindcss";

// ==== 糸町の少年 デザイントークン ====
// コンセプト:「大丈夫。必ずうまくいく！」
// 夜の社(やしろ)の静けさ × 灯りのあたたかさ、をモチーフにした配色。
// 汎用的な"AI生成っぽい"クリーム×テラコッタ、黒×蛍光グリーンは意図的に避けている。

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 背景：夜の社の空気感（真っ黒ではなく藍〜紫寄りの深色）
        ink: {
          950: "#101026",
          900: "#15152F",
          800: "#1E1E3D",
          700: "#2A2A52",
        },
        // アクセント：灯籠の金
        gold: {
          400: "#E4BE5C",
          500: "#D9A62E",
          600: "#B8871E",
        },
        // アクセント：鳥居の朱
        torii: {
          500: "#C1443C",
          600: "#A5342D",
        },
        // テキスト
        paper: {
          50: "#F7F3E9",
          200: "#E8E1D2",
          400: "#B9B2C4",
          600: "#847C9C",
        },
      },
      fontFamily: {
        display: ["var(--font-shippori)", "serif"],
        body: ["var(--font-zenkaku)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        card: "20px",
      },
      boxShadow: {
        lantern: "0 0 40px -8px rgba(217, 166, 46, 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;

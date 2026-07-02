import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // 夜の会場（藍）
        night: {
          950: "#03122A",
          900: "#04182F",
          800: "#072341",
          700: "#0C2E52",
          600: "#143A63",
        },
        // クラフト紙
        kraft: {
          DEFAULT: "#EED2AC",
          deep: "#DDBE90",
          light: "#F6E4C4",
          paper: "#FBF0DA",
        },
        fes: {
          red: "#C4372A",
          "red-deep": "#93221A",
          teal: "#1F7E6B",
          "teal-deep": "#145A4C",
          gold: "#E8A93B",
          "gold-deep": "#B97F1D",
          indigo: "#22335C",
          ink: "#3A2E2A",
        },
      },
      boxShadow: {
        // 紙を重ねた二重影（段差 + 落ち影）
        paper: "0 2px 0 rgba(0,0,0,.25), 0 8px 16px rgba(0,0,0,.3)",
        "paper-sm": "0 1px 0 rgba(0,0,0,.2), 0 4px 8px rgba(0,0,0,.25)",
        "paper-lg": "0 3px 0 rgba(0,0,0,.25), 0 14px 28px rgba(0,0,0,.35)",
        "paper-press": "0 1px 0 rgba(0,0,0,.2), 0 2px 4px rgba(0,0,0,.25)",
        // 提灯の灯りグロー
        glow: "0 0 18px rgba(255,170,80,.55), 0 0 44px rgba(255,140,50,.25)",
      },
      fontFamily: {
        hand: ["var(--font-yomogi)", "cursive"],
        maru: ["var(--font-zen-maru)", "sans-serif"],
        body: ["var(--font-noto-sans)", "sans-serif"],
      },
      borderRadius: {
        paper: "14px",
      },
    },
  },
  plugins: [],
};
export default config;

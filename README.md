# Substack 夏祭り (summer-fes2026-2)

紙工作（ペーパークラフト）調・夜の祭り会場デザインの夏祭りポータル。
デザインリニューアル版（旧: summer-fes2026）。

## スタック
- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- 静的ページのみ（現時点）。ゲームは Canvas 実装を順次移植予定

## 開発
```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

## 構成
- `src/app/page.tsx` — トップ（ヒーロー/ミニゲーム/ポスター/屋台/スケジュール/フッター）
- `src/app/{ring-toss,shooting,goldfish}/` — ゲームルート（現状プレースホルダ）
- `src/components/` — PaperCard / Lantern / Firework / sections/*
- `public/art/` — デザインモックから切り出した装飾素材

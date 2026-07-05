import type { MetadataRoute } from "next";

/**
 * PWA マニフェスト（/manifest.webmanifest として自動配信・<link rel="manifest"> も自動付与）。
 * ホーム画面に追加したときのアプリ名・アイコン・起動画面の色を定義する。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "オカンとSubstack夏祭り",
    short_name: "夏祭り",
    description:
      "つながる、遊ぶ、つくる。ポスターを投稿したり、屋台を出したり、ミニゲームで遊んだり、みんなで楽しむオンラインの夏祭り。",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf6ea",
    theme_color: "#072341",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

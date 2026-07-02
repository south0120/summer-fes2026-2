import type { Metadata, Viewport } from "next";
import { Yomogi, Zen_Maru_Gothic, Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const yomogi = Yomogi({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-yomogi",
  display: "swap",
  preload: false,
});

const zenMaru = Zen_Maru_Gothic({
  weight: ["400", "700", "900"],
  subsets: ["latin"],
  variable: "--font-zen-maru",
  display: "swap",
  preload: false,
});

const notoSans = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-noto-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Substack 夏祭り",
  description:
    "つながる、遊ぶ、つくる。ポスターを投稿したり、屋台を出したり、ミニゲームで遊んだり、みんなで楽しむオンラインの夏祭りへようこそ！",
};

export const viewport: Viewport = {
  themeColor: "#072341",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${yomogi.variable} ${zenMaru.variable} ${notoSans.variable} font-body antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

import Link from "next/link";
import Header from "@/components/sections/Header";
import Footer from "@/components/sections/Footer";
import Leaderboard from "@/components/game/Leaderboard";
import type { GameKey } from "@/lib/scores";

export const metadata = { title: "ランキング | Substack 夏祭り" };

// Header の認証状態を毎リクエスト反映する（各ランキングはクライアント側で取得）
export const dynamic = "force-dynamic";

const GAMES: GameKey[] = [
  "shooting",
  "shooting-3d",
  "ring-toss",
  "goldfish",
  "yoyo",
  "cotton-candy",
  "whack",
  "castella",
];

export default function RankingsPage() {
  return (
    <>
      <Header />
      <main>
        <section className="paper-grain border-b-4 border-night-900/30 bg-kraft py-9 text-fes-ink">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div>
              <h1 className="font-maru text-2xl font-black text-fes-indigo">
                ランキング
              </h1>
              <p className="mt-2 font-maru text-xs font-bold leading-5 text-fes-ink/70">
                各ミニゲームの上位スコアをまとめてチェック！ ログインしてスコアを登録すると、あなたの名前もここに並びます。
              </p>
            </div>

            {/* 各ゲームのランキングを横並び（モバイルは縦積み） */}
            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {GAMES.map((g) => (
                <Leaderboard key={g} game={g} />
              ))}
            </div>

            <p className="mt-8 text-center font-maru text-xs font-bold text-fes-ink/70">
              スコアはゲームをプレイして登録できます。{" "}
              <Link
                href="/#games"
                className="font-black text-fes-indigo underline underline-offset-2 hover:text-fes-red"
              >
                ミニゲームで遊ぶ
              </Link>
            </p>

            <p className="mt-6 text-center">
              <Link
                href="/"
                className="font-maru text-xs font-black text-fes-indigo hover:underline"
              >
                ‹ 会場にもどる
              </Link>
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

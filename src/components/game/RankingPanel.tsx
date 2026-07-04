"use client";

import { useEffect, useRef, useState } from "react";
import Leaderboard from "@/components/game/Leaderboard";
import ScoreSubmit from "@/components/game/ScoreSubmit";
import {
  GAME_LABELS,
  SCORE_SUBMITTED_EVENT,
  type GameKey,
  type ScoreSubmittedDetail,
} from "@/lib/scores";

/**
 * ゲームページ下部の常駐ランキングパネル。
 * - 「ランキングを見る」トグルで Leaderboard を開閉
 * - score なしの ScoreSubmit を常時 mount して、ログイン復帰後の
 *   pending スコア自動登録を受け持つ（リザルト画面はリロード後に出ないため）
 * - pending 自動登録が完了したら自動でパネルを開いてスクロールする
 */
export default function RankingPanel({ game }: { game: GameKey }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onSubmitted = (e: Event) => {
      const detail = (e as CustomEvent<ScoreSubmittedDetail>).detail;
      if (detail?.game === game && detail.source === "pending") {
        setOpen(true);
        panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    window.addEventListener(SCORE_SUBMITTED_EVENT, onSubmitted);
    return () => window.removeEventListener(SCORE_SUBMITTED_EVENT, onSubmitted);
  }, [game]);

  return (
    <section
      ref={panelRef}
      className="mx-auto w-full max-w-lg px-4 pb-10"
      aria-label={`${GAME_LABELS[game]}のランキング`}
    >
      {/* pending 自動登録（完了時のみ「登録完了！」を表示） */}
      <ScoreSubmit game={game} />

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="torn mt-3 w-full border-2 border-kraft/60 bg-night-800/80 px-4 py-2.5 font-maru text-sm font-black text-kraft transition-colors hover:text-kraft-paper"
      >
        🏆 ランキングを{open ? "とじる" : "見る"}
      </button>
      {open && (
        <div className="mt-3">
          <Leaderboard game={game} />
        </div>
      )}
    </section>
  );
}

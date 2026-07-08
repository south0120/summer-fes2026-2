"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchTopScores,
  GAME_LABELS,
  SCORE_SUBMITTED_EVENT,
  type GameKey,
  type ScoreRow,
  type ScoreSubmittedDetail,
} from "@/lib/scores";

const MEDALS = ["🥇", "🥈", "🥉"] as const;

/**
 * ゲーム別ランキング TOP4（5位以降は非表示）。
 * mount 時に取得し、ScoreSubmit の登録完了イベント（同じゲーム分）で再取得する。
 */
export default function Leaderboard({ game }: { game: GameKey }) {
  const [rows, setRows] = useState<ScoreRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setRows(await fetchTopScores(game, 4));
    } catch {
      setError("ランキングを取得できませんでした。");
    }
  }, [game]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onSubmitted = (e: Event) => {
      const detail = (e as CustomEvent<ScoreSubmittedDetail>).detail;
      if (!detail || detail.game === game) void load();
    };
    window.addEventListener(SCORE_SUBMITTED_EVENT, onSubmitted);
    return () => window.removeEventListener(SCORE_SUBMITTED_EVENT, onSubmitted);
  }, [game, load]);

  return (
    <div className="torn-2 border-[3px] border-fes-indigo/25 bg-kraft-paper p-3 text-left shadow-paper-sm">
      <p className="text-center font-maru text-sm font-black text-fes-indigo">
        🏆 {GAME_LABELS[game]}ランキング
      </p>
      {error ? (
        <p className="mt-2 text-center font-maru text-xs font-bold text-fes-red">
          {error}
        </p>
      ) : rows === null ? (
        <p className="mt-2 text-center font-maru text-xs font-bold text-fes-ink/50">
          よみこみ中…
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-2 text-center font-maru text-xs font-bold text-fes-ink/60">
          まだスコアがありません
        </p>
      ) : (
        <ol className="mt-2 space-y-1">
          {rows.map((row, i) => (
            <li
              key={`${i}-${row.name}-${row.score}`}
              className={`flex items-center gap-2 rounded-md px-2 py-1 font-maru text-xs font-bold text-fes-ink ${
                i < 3 ? "bg-kraft" : ""
              }`}
            >
              <span
                className="w-6 shrink-0 text-center font-black"
                aria-label={`${i + 1}位`}
              >
                {i < 3 ? MEDALS[i] : `${i + 1}`}
              </span>
              <span className="min-w-0 flex-1 truncate">{row.name}</span>
              <span className="shrink-0 font-black text-fes-red">
                {row.score}
                <span className="ml-0.5 text-[10px] text-fes-ink/60">点</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

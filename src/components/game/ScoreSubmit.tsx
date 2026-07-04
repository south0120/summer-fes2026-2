"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  clearPendingScore,
  getSuggestedName,
  readPendingScore,
  stashPendingScore,
  submitScore,
  SCORE_SUBMITTED_EVENT,
  type GameKey,
  type ScoreSubmittedDetail,
} from "@/lib/scores";

type ScoreSubmitProps = {
  game: GameKey;
  /**
   * 登録するスコア。リザルト画面では必須。
   * 省略時（ゲームページ常駐用）は「ログイン復帰後の pending 自動登録」だけを担当する。
   */
  score?: number;
};

function dispatchSubmitted(detail: ScoreSubmittedDetail): void {
  window.dispatchEvent(
    new CustomEvent<ScoreSubmittedDetail>(SCORE_SUBMITTED_EVENT, { detail }),
  );
}

/**
 * スコア登録 UX 一式。
 * - ログイン済み: なまえ入力（ポスターhandle / メールから prefill）→ 登録
 * - 未ログイン: スコアを localStorage に stash → /login?next=/<game> へ
 * - mount 時: このゲームの pending スコアがあり、かつログイン済みなら自動登録して「登録完了！」
 */
export default function ScoreSubmit({ game, score }: ScoreSubmitProps) {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [doneScore, setDoneScore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pendingHandledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      setLoggedIn(user !== null);
      if (!user) return;

      // ログイン復帰後の自動登録（このゲーム分の pending のみ）
      const pending = readPendingScore();
      if (pending && pending.game === game && !pendingHandledRef.current) {
        pendingHandledRef.current = true;
        clearPendingScore(); // 二重登録防止のため先に消す
        try {
          const autoName = (await getSuggestedName()) || "名無しさん";
          await submitScore(game, autoName, pending.score);
          if (!cancelled) setDoneScore(pending.score);
          dispatchSubmitted({ game, source: "pending" });
        } catch (e) {
          if (!cancelled) {
            setError(
              e instanceof Error ? e.message : "スコアを登録できませんでした。",
            );
          }
        }
        return;
      }

      const suggested = await getSuggestedName();
      if (!cancelled) setName(suggested);
    })();
    return () => {
      cancelled = true;
    };
  }, [game]);

  const handleLoginToRegister = () => {
    if (typeof score !== "number") return;
    stashPendingScore(game, score);
    window.location.assign(`/login?next=${encodeURIComponent(`/${game}`)}`);
  };

  const handleSubmit = async () => {
    if (typeof score !== "number" || submitting) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError("なまえを入力してください。");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await submitScore(game, trimmed, score);
      setDoneScore(score);
      dispatchSubmitted({ game, source: "manual" });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "スコアを登録できませんでした。",
      );
    }
    setSubmitting(false);
  };

  /* 登録完了 */
  if (doneScore !== null) {
    return (
      <div className="torn-2 border-[3px] border-fes-teal/40 bg-kraft-paper p-3 text-center shadow-paper-sm">
        <p className="font-maru text-sm font-black text-fes-teal">
          登録完了！ 🎐
        </p>
        <p className="mt-0.5 font-maru text-xs font-bold text-fes-ink/70">
          {doneScore}点をランキングに登録しました
        </p>
      </div>
    );
  }

  /* ページ常駐モード（score なし）: pending 処理以外は何も出さない */
  if (typeof score !== "number") {
    return error ? (
      <p className="rounded-lg border-2 border-fes-red/40 bg-kraft-paper px-3 py-2 font-maru text-xs font-bold text-fes-red">
        {error}
      </p>
    ) : null;
  }

  /* 認証確認中 */
  if (loggedIn === null) {
    return (
      <p className="text-center font-maru text-xs font-bold text-fes-ink/50">
        …
      </p>
    );
  }

  /* 未ログイン: stash してログインへ */
  if (!loggedIn) {
    return (
      <div className="text-center">
        <button
          type="button"
          onClick={handleLoginToRegister}
          className="w-full rounded-full border-2 border-fes-indigo bg-kraft-paper px-4 py-2 font-maru text-sm font-black text-fes-indigo shadow-paper-sm transition-transform hover:-translate-y-0.5"
        >
          🏮 ログインしてスコアを登録
        </button>
        <p className="mt-1.5 font-maru text-[10px] font-bold text-fes-ink/60">
          ログイン後、このスコアは自動で登録されます
        </p>
      </div>
    );
  }

  /* ログイン済み: なまえ + 登録ボタン */
  return (
    <div className="torn-2 border-[3px] border-fes-indigo/25 bg-kraft-paper p-3 shadow-paper-sm">
      <label
        htmlFor={`score-name-${game}`}
        className="block text-left font-maru text-xs font-black text-fes-indigo"
      >
        なまえ（ランキングに載ります）
      </label>
      <input
        id={`score-name-${game}`}
        type="text"
        value={name}
        maxLength={24}
        onChange={(e) => setName(e.target.value)}
        placeholder="なまえ"
        className="mt-1.5 w-full rounded-lg border-2 border-fes-ink/25 bg-kraft px-3 py-2 font-maru text-sm font-bold text-fes-ink placeholder:text-fes-ink/40 focus:border-fes-indigo focus:outline-none"
      />
      {error && (
        <p
          role="alert"
          className="mt-1.5 font-maru text-[11px] font-bold text-fes-red"
        >
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="mt-2 w-full rounded-full border-2 border-fes-red-deep bg-fes-red px-4 py-2 font-maru text-sm font-black text-kraft-paper shadow-paper-sm transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
      >
        {submitting ? "登録中…" : "スコアを登録"}
      </button>
    </div>
  );
}

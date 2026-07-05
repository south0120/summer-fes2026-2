"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  /** 対象投稿の posters.id（uuid） */
  postId: string;
  /** サーバー側で取得した初期件数 */
  initialCount: number;
  /** サーバー側で取得した「自分が押しているか」 */
  initialLiked: boolean;
  className?: string;
};

/**
 * いいねボタン（ハート）。
 * - ログイン必須・1 人 1 回（likes テーブルの (post_id,user_id) 主キーで保証）。
 * - もう一度押すと自分の行を消してトグル解除。
 * - 未ログインで押したら /login?next=<現在パス> へ誘導。
 * - 楽観更新（先に UI を更新し、失敗したらロールバック）。
 */
export default function LikeButton({
  postId,
  initialCount,
  initialLiked,
  className,
}: Props) {
  const router = useRouter();
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(initialLiked);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        const next =
          typeof window !== "undefined"
            ? window.location.pathname + window.location.search
            : "/";
        router.push(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      const nextLiked = !liked;
      // 楽観更新
      setLiked(nextLiked);
      setCount((c) => Math.max(0, c + (nextLiked ? 1 : -1)));

      try {
        if (nextLiked) {
          const { error } = await supabase
            .from("likes")
            .insert({ post_id: postId, user_id: user.id });
          // 23505 = 一意制約違反（既に押していた）は成功扱い
          if (error && error.code !== "23505") throw error;
        } else {
          const { error } = await supabase
            .from("likes")
            .delete()
            .eq("post_id", postId)
            .eq("user_id", user.id);
          if (error) throw error;
        }
      } catch {
        // 失敗したらロールバック
        setLiked(!nextLiked);
        setCount((c) => Math.max(0, c - (nextLiked ? 1 : -1)));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={liked}
      aria-label={liked ? "いいねを取り消す" : "いいねする"}
      className={`flex shrink-0 items-center gap-0.5 font-maru text-[10px] font-black leading-none transition-transform hover:scale-110 disabled:opacity-60 ${
        liked ? "text-fes-red" : "text-fes-ink/45"
      } ${className ?? ""}`}
    >
      <span aria-hidden>{liked ? "♥" : "♡"}</span> {count}
    </button>
  );
}

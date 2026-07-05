import { createClient } from "@/lib/supabase/server";

/** 1 つの投稿（posters.id）に対するいいねの状態。
 *  count = いいね件数（likes テーブルの実データ）
 *  likedByMe = ログイン中ユーザーが既に押しているか */
export type LikeInfo = { count: number; likedByMe: boolean };

/**
 * 実投稿（posters.id = uuid）の配列に対して、いいね件数と
 * 「自分が押したか」をまとめて返す（サーバー側・server component から呼ぶ）。
 *
 * - likes.public read ポリシーにより件数はログイン不要で数えられる。
 * - likedByMe は cookie セッションの現在ユーザーで判定する（未ログインなら常に false）。
 * - SEED（DB 外のデモカード）には id が無いので渡さない。渡された未知 id は count 0 で返る。
 */
export async function getLikeInfo(
  postIds: string[],
): Promise<Record<string, LikeInfo>> {
  const result: Record<string, LikeInfo> = {};
  // 重複を除いた実 id だけ対象にする
  const ids = Array.from(new Set(postIds.filter(Boolean)));
  for (const id of ids) result[id] = { count: 0, likedByMe: false };
  if (ids.length === 0) return result;

  const supabase = createClient();

  const [{ data: rows }, { data: auth }] = await Promise.all([
    supabase.from("likes").select("post_id, user_id").in("post_id", ids),
    supabase.auth.getUser(),
  ]);

  const myId = auth?.user?.id ?? null;
  for (const r of (rows ?? []) as { post_id: string; user_id: string }[]) {
    const info = result[r.post_id];
    if (!info) continue;
    info.count += 1;
    if (myId && r.user_id === myId) info.likedByMe = true;
  }
  return result;
}

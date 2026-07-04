import { createClient } from "@/lib/supabase/client";

/** ミニゲームの識別子（scores.game カラムの値 = 各ゲームのルート名） */
export type GameKey = "shooting" | "ring-toss" | "goldfish";

export const GAME_LABELS: Record<GameKey, string> = {
  shooting: "射的",
  "ring-toss": "輪投げ",
  goldfish: "金魚すくい",
};

export type ScoreRow = { name: string; score: number };

/** スコア登録完了をページ内の他コンポーネント（Leaderboard等）へ知らせるイベント名 */
export const SCORE_SUBMITTED_EVENT = "sf:score-submitted";

export type ScoreSubmittedDetail = {
  game: GameKey;
  /** pending = ログイン復帰後の自動登録 / manual = リザルト画面からの手動登録 */
  source: "pending" | "manual";
};

/** 指定ゲームの上位スコアを取得（score降順 → 同点は先着順） */
export async function fetchTopScores(
  game: GameKey,
  limit = 10,
): Promise<ScoreRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scores")
    .select("name, score")
    .eq("game", game)
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: { name: string; score: number }) => ({
    name: String(row.name ?? ""),
    score: Number(row.score ?? 0),
  }));
}

/** スコアを登録する。未ログインなら throw（RLS 的にも user_id = auth.uid() が必須） */
export async function submitScore(
  game: GameKey,
  name: string,
  score: number,
): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("スコア登録にはログインが必要です。");
  const { error } = await supabase.from("scores").insert({
    user_id: user.id,
    game,
    name,
    score,
  });
  if (error) throw new Error(error.message);
}

/**
 * なまえ欄の初期値。
 * ログインユーザーの最新ポスターの handle → 無ければメールのローカル部 → 空文字。
 */
export async function getSuggestedName(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "";
  const { data } = await supabase
    .from("posters")
    .select("handle")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);
  const handle = data?.[0]?.handle;
  if (typeof handle === "string" && handle.trim() !== "") return handle.trim();
  return user.email?.split("@")[0] ?? "";
}

/* ---------------- 未ログイン時の「登録待ちスコア」stash ---------------- */

const PENDING_KEY = "sf_pending_score";

export type PendingScore = { game: GameKey; score: number };

function isGameKey(v: unknown): v is GameKey {
  return v === "shooting" || v === "ring-toss" || v === "goldfish";
}

/** ログイン前に出たスコアを localStorage に退避（ログイン復帰後に自動登録する） */
export function stashPendingScore(game: GameKey, score: number): void {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ game, score }));
  } catch {
    // private mode 等で localStorage が使えない場合は諦める（致命的ではない）
  }
}

export function readPendingScore(): PendingScore | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { game, score } = parsed as { game?: unknown; score?: unknown };
    if (isGameKey(game) && typeof score === "number" && Number.isFinite(score)) {
      return { game, score };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearPendingScore(): void {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // 消せなくても readPendingScore 側のバリデーションで実害なし
  }
}

/* eslint-disable @next/next/no-img-element */
import { redirect } from "next/navigation";
import { isAuthed, getAdminPath, getAdminSupabase } from "@/lib/admin";
import { logout } from "../actions";
import DeletePostButton from "./DeletePostButton";
import RestorePostButton from "./RestorePostButton";

export const metadata = { title: "管理ダッシュボード", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type PosterRow = {
  id: string;
  user_id: string | null;
  kind: string | null;
  title: string | null;
  handle: string | null;
  image_path: string;
  description: string | null;
  created_at: string;
  deleted_at: string | null;
};

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border-2 border-fes-ink/10 bg-white/70 p-4">
      <div className="font-maru text-xs font-bold text-fes-ink/60">{label}</div>
      <div className="mt-1 font-maru text-2xl font-black text-fes-indigo">{value}</div>
      {sub && <div className="mt-0.5 font-maru text-[11px] font-bold text-fes-ink/50">{sub}</div>}
    </div>
  );
}

export default async function AdminDashboard() {
  if (!isAuthed()) {
    const slug = getAdminPath();
    redirect(slug ? `/${slug}` : "/");
  }

  const supabase = getAdminSupabase();

  const [postersRes, likesRes, scoresRes, profilesRes] = await Promise.all([
    supabase
      .from("posters")
      .select(
        "id, user_id, kind, title, handle, image_path, description, created_at, deleted_at",
      )
      .order("created_at", { ascending: false }),
    supabase.from("likes").select("post_id, user_id"),
    supabase.from("scores").select("game, score, name, user_id"),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
  ]);

  const posters = (postersRes.data ?? []) as PosterRow[];
  // 表示中（deleted_at is null）と 非表示中（論理削除済み）に分ける
  const activePosters = posters.filter((p) => !p.deleted_at);
  const hiddenPosters = posters.filter((p) => p.deleted_at);
  const likes = (likesRes.data ?? []) as { post_id: string; user_id: string }[];
  const scores = (scoresRes.data ?? []) as {
    game: string;
    score: number;
    name: string | null;
    user_id: string | null;
  }[];
  const profileCount = profilesRes.count ?? 0;

  const postCount = activePosters.length;
  const likeTotal = likes.length;

  // いいね人気TOP
  const likeByPost = new Map<string, number>();
  for (const l of likes) likeByPost.set(l.post_id, (likeByPost.get(l.post_id) ?? 0) + 1);
  const titleById = new Map<string, PosterRow>(
    posters.map((p) => [p.id, p] as [string, PosterRow]),
  );
  const popular = Array.from(likeByPost.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({ post: titleById.get(id), count }));

  // ゲーム別プレイ数・最高スコア
  const gameLabels: Record<string, string> = {
    shooting: "射的",
    "ring-toss": "輪投げ",
    goldfish: "金魚すくい",
  };
  const gameAgg = new Map<string, { plays: number; top: number }>();
  for (const s of scores) {
    const g = gameAgg.get(s.game) ?? { plays: 0, top: 0 };
    g.plays += 1;
    g.top = Math.max(g.top, Number(s.score ?? 0));
    gameAgg.set(s.game, g);
  }

  // ユニーク参加者（投稿・いいね・スコアした人の user_id 集合）
  const participantIds = new Set<string>();
  for (const p of posters) if (p.user_id) participantIds.add(p.user_id);
  for (const l of likes) if (l.user_id) participantIds.add(l.user_id);
  for (const s of scores) if (s.user_id) participantIds.add(s.user_id);

  const imgUrl = (path: string) =>
    supabase.storage.from("posters").getPublicUrl(path).data.publicUrl;

  return (
    <main className="min-h-screen bg-kraft px-4 py-8 text-fes-ink">
      <div className="mx-auto max-w-5xl">
        {/* ヘッダー */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-maru text-2xl font-black text-fes-indigo">管理ダッシュボード</h1>
            <p className="mt-1 font-maru text-xs font-bold text-fes-ink/60">
              Substack 夏祭り の運営用。アクセス解析の確認と、投稿の非表示・復活ができます。
            </p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="shrink-0 rounded-full border-2 border-fes-ink/25 bg-white px-4 py-2 font-maru text-xs font-black text-fes-ink/70 hover:bg-fes-ink/5"
            >
              ログアウト
            </button>
          </form>
        </div>

        {/* GA導線 */}
        <a
          href="https://analytics.google.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block rounded-full border-2 border-fes-indigo/30 bg-white px-4 py-2 font-maru text-xs font-black text-fes-indigo hover:bg-fes-indigo/5"
        >
          Google アナリティクス（アクセス解析）を開く ↗
        </a>

        {/* 集計 */}
        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="投稿" value={postCount} />
          <Stat label="いいね総数" value={likeTotal} />
          <Stat label="参加者（ユニーク）" value={participantIds.size} sub={`登録ユーザー ${profileCount}`} />
        </section>

        {/* いいね人気TOP */}
        <section className="mt-6">
          <h2 className="font-maru text-lg font-black text-fes-indigo">いいね人気TOP</h2>
          {popular.length === 0 ? (
            <p className="mt-2 font-maru text-xs font-bold text-fes-ink/50">まだいいねがありません。</p>
          ) : (
            <ol className="mt-2 space-y-1">
              {popular.map((r, i) => (
                <li key={i} className="flex items-center gap-2 font-maru text-sm font-bold text-fes-ink">
                  <span className="w-5 text-fes-red">{i + 1}</span>
                  <span className="truncate">{r.post?.title ?? "（削除済み）"}</span>
                  <span className="text-fes-ink/50">{r.post?.handle ?? ""}</span>
                  <span className="ml-auto shrink-0 text-fes-red">♥ {r.count}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* ゲーム */}
        <section className="mt-6">
          <h2 className="font-maru text-lg font-black text-fes-indigo">ミニゲーム</h2>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Object.entries(gameLabels).map(([key, label]) => {
              const g = gameAgg.get(key) ?? { plays: 0, top: 0 };
              return <Stat key={key} label={label} value={`${g.plays} プレイ`} sub={`最高 ${g.top}`} />;
            })}
          </div>
        </section>

        {/* 投稿一覧＋非表示（論理削除） */}
        <section className="mt-8">
          <h2 className="font-maru text-lg font-black text-fes-indigo">
            投稿の管理（{activePosters.length}件）
          </h2>
          <p className="mt-1 font-maru text-[11px] font-bold text-fes-ink/50">
            不適切な投稿はここから非表示にできます。非表示にしても削除はされず、下の「非表示中」から復活できます。
          </p>
          <div className="mt-3 space-y-2">
            {activePosters.length === 0 && (
              <p className="font-maru text-xs font-bold text-fes-ink/50">まだ投稿がありません。</p>
            )}
            {activePosters.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-xl border-2 border-fes-ink/10 bg-white/70 p-2"
              >
                <img
                  src={imgUrl(p.image_path)}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-md border border-fes-ink/15 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-maru text-sm font-black text-fes-ink">
                      {p.title ?? "（無題）"}
                    </span>
                  </div>
                  <div className="truncate font-maru text-[11px] font-bold text-fes-ink/55">
                    {p.handle ?? ""} ・{" "}
                    {new Date(p.created_at).toLocaleString("ja-JP", {
                      timeZone: "Asia/Tokyo",
                    })}
                  </div>
                </div>
                <DeletePostButton id={p.id} title={p.title ?? "この投稿"} />
              </div>
            ))}
          </div>
        </section>

        {/* 非表示中（論理削除済み）＋復活 */}
        {hiddenPosters.length > 0 && (
          <section className="mt-8">
            <h2 className="font-maru text-lg font-black text-fes-indigo">
              非表示中（{hiddenPosters.length}件）
            </h2>
            <p className="mt-1 font-maru text-[11px] font-bold text-fes-ink/50">
              マイページや管理画面から非表示にした投稿です。データは残っているので「復活」で表示に戻せます。
            </p>
            <div className="mt-3 space-y-2">
              {hiddenPosters.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl border-2 border-fes-ink/10 bg-fes-ink/[0.03] p-2"
                >
                  <img
                    src={imgUrl(p.image_path)}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-md border border-fes-ink/15 object-cover opacity-60"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-maru text-sm font-black text-fes-ink/70">
                        {p.title ?? "（無題）"}
                      </span>
                    </div>
                    <div className="truncate font-maru text-[11px] font-bold text-fes-ink/45">
                      {p.handle ?? ""}
                      {p.deleted_at
                        ? ` ・非表示 ${new Date(p.deleted_at).toLocaleString("ja-JP", {
                            timeZone: "Asia/Tokyo",
                          })}`
                        : ""}
                    </div>
                  </div>
                  <RestorePostButton id={p.id} title={p.title ?? "この投稿"} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

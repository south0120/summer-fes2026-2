import Link from "next/link";
import { redirect } from "next/navigation";
import Header from "@/components/sections/Header";
import Footer from "@/components/sections/Footer";
import { createClient } from "@/lib/supabase/server";
import { GAME_LABELS, type GameKey } from "@/lib/scores";
import UsernameForm from "./UsernameForm";
import MyPosters, { type MyPoster } from "./MyPosters";

export const metadata = { title: "マイページ | Substack 夏祭り" };

// 認証状態・profiles・scores を毎リクエスト取得する
export const dynamic = "force-dynamic";

type HistoryRow = {
  game: string;
  score: number;
  created_at: string;
};

function gameLabel(game: string): string {
  return GAME_LABELS[game as GameKey] ?? game;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function MyPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/mypage");
  }

  // 表示名の正本は profiles.username。テーブル未作成/行なしでも落ちないように
  // フォールバック（メールのローカル部）を用意する。
  let username = user.email?.split("@")[0] ?? "";
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("user_id", user.id)
      .maybeSingle();
    if (typeof profile?.username === "string" && profile.username.trim() !== "") {
      username = profile.username;
    }
  } catch {
    // profiles 未整備でもページは表示する
  }

  let history: HistoryRow[] = [];
  try {
    const { data } = await supabase
      .from("scores")
      .select("game, score, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    history = (data ?? []).map((row: HistoryRow) => ({
      game: String(row.game ?? ""),
      score: Number(row.score ?? 0),
      created_at: String(row.created_at ?? ""),
    }));
  } catch {
    // 取得に失敗しても 0 件表示にフォールバック
  }

  // 自分が投稿したポスター / 屋台（管理・削除用）
  let myPosters: MyPoster[] = [];
  try {
    const { data } = await supabase
      .from("posters")
      .select("id, kind, title, handle, image_path, likes, created_at")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50);
    myPosters = (data ?? []).map((row) => ({
      id: String(row.id),
      kind: row.kind === "stall" ? "stall" : "poster",
      title: String(row.title ?? ""),
      handle: String(row.handle ?? ""),
      likes: Number(row.likes ?? 0),
      img: supabase.storage.from("posters").getPublicUrl(row.image_path).data
        .publicUrl,
    }));
  } catch {
    // 取得に失敗しても 0 件表示にフォールバック
  }

  return (
    <>
      <Header />
      <main className="flex min-h-dvh items-start justify-center px-4 py-12">
        <div className="torn paper-grain w-full max-w-md border-[3px] border-kraft-paper/90 bg-kraft p-7 text-fes-ink shadow-paper-lg sm:p-9">
          <p className="font-maru text-sm font-bold text-fes-red">🏮 マイページ</p>
          <h1 className="mt-1 font-maru text-2xl font-black text-fes-indigo">
            {username} さんの縁側
          </h1>
          <p className="mt-2 font-maru text-xs font-bold leading-5 text-fes-ink/70">
            ユーザーネームの変更と、遊んだ記録の確認ができます。
          </p>

          <section className="mt-6">
            <h2 className="font-maru text-sm font-black text-fes-indigo">
              ユーザーネームを変更する
            </h2>
            <UsernameForm userId={user.id} initialUsername={username} />
          </section>

          <section className="mt-8">
            <h2 className="font-maru text-sm font-black text-fes-indigo">
              自分の投稿
            </h2>
            <p className="mt-1 font-maru text-[11px] font-bold leading-5 text-fes-ink/60">
              貼り出したポスター・屋台を削除できます。
            </p>
            <MyPosters posters={myPosters} />
          </section>

          <section className="mt-8">
            <h2 className="font-maru text-sm font-black text-fes-indigo">
              遊んだ履歴
            </h2>
            {history.length === 0 ? (
              <div className="torn-2 mt-3 border-[3px] border-fes-teal/40 bg-kraft-paper p-4 shadow-paper-sm">
                <p className="font-maru text-xs font-bold leading-5 text-fes-ink/70">
                  まだ遊んだ記録がありません。
                </p>
                <p className="mt-1.5">
                  <Link
                    href="/#games"
                    className="font-maru text-xs font-black text-fes-indigo underline underline-offset-2"
                  >
                    ミニゲームで遊びにいく →
                  </Link>
                </p>
              </div>
            ) : (
              <ul className="mt-3 divide-y divide-fes-ink/15">
                {history.map((row, i) => (
                  <li
                    key={`${row.created_at}-${i}`}
                    className="flex items-baseline justify-between gap-3 py-2"
                  >
                    <span className="font-maru text-sm font-black text-fes-ink">
                      {gameLabel(row.game)}
                    </span>
                    <span className="font-maru text-sm font-black text-fes-red">
                      {row.score.toLocaleString("ja-JP")} 点
                    </span>
                    <span className="shrink-0 font-maru text-[11px] font-bold text-fes-ink/60">
                      {formatDate(row.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="mt-8 text-center">
            <Link
              href="/"
              className="font-maru text-xs font-black text-fes-indigo hover:underline"
            >
              ‹ 会場にもどる
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}

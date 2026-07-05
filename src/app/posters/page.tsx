/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import Header from "@/components/sections/Header";
import Footer from "@/components/sections/Footer";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "みんなのポスター | Substack 夏祭り" };

// 認証状態（Header）と投稿ポスターを毎リクエスト取得する
export const dynamic = "force-dynamic";

// 投稿がまだ 1 件もないときに掲示板が空にならないよう、デモ用の種ポスターを残す
const SEED = [
  { img: "/art/poster-1.png", title: "夏の夜の読書会", handle: "@book_and_coffee", likes: 128 },
  { img: "/art/poster-2.png", title: "海辺の音楽祭", handle: "@umi_music", likes: 96 },
  { img: "/art/poster-3.png", title: "怪談ナイト", handle: "@kaidan_library", likes: 77 },
  { img: "/art/poster-4.png", title: "浴衣で語ろう会", handle: "@yukata_talk", likes: 64 },
  { img: "/art/poster-5.png", title: "夏のまんぷく屋台めぐり", handle: "@manpuku_notes", likes: 53 },
  { img: "/art/poster-6.png", title: "ZINEマーケット", handle: "@zine_lab", likes: 41 },
] as const;

type Poster = {
  img: string;
  title: string;
  handle: string;
  likes: number;
};

export default async function PostersPage() {
  const supabase = createClient();

  let posters: Poster[] = [];
  try {
    const { data } = await supabase
      .from("posters")
      .select("title, handle, likes, image_path")
      .eq("kind", "poster")
      .order("created_at", { ascending: false })
      .limit(200);

    if (data && data.length > 0) {
      posters = data.map((row) => ({
        img: supabase.storage.from("posters").getPublicUrl(row.image_path).data
          .publicUrl,
        title: row.title,
        handle: row.handle,
        likes: row.likes,
      }));
    }
  } catch {
    // Supabase 未設定・接続失敗時はデモポスターにフォールバック
  }

  if (posters.length === 0) {
    posters = [...SEED];
  }

  return (
    <>
      <Header />
      <main>
        <section className="paper-grain border-b-4 border-night-900/30 bg-kraft py-9 text-fes-ink">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            {/* 見出しと投稿導線 */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="font-maru text-2xl font-black text-fes-indigo">
                  みんなのポスター
                </h1>
                <p className="mt-2 font-maru text-xs font-bold leading-5 text-fes-ink/70">
                  夏祭りのテーマで投稿されたポスターがぜんぶ並ぶ掲示板です。あなたの一枚も、ぜひ飾ってください。
                </p>
              </div>
              <Link
                href="/posters/new"
                className="shrink-0 self-start rounded-full border-2 border-fes-red-deep bg-fes-red px-5 py-2 font-maru text-sm font-black text-kraft-paper shadow-paper-press transition-transform hover:-translate-y-0.5 sm:self-auto"
              >
                ポスターを投稿する ›
              </Link>
            </div>

            {/* ポスターグリッド */}
            <div className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {posters.map((p, i) => (
                <figure
                  key={`${p.handle}-${i}`}
                  className={`rounded-lg border-[3px] border-kraft-paper bg-kraft-paper p-1.5 shadow-paper-sm ${
                    i % 2 === 0 ? "tilt-l" : "tilt-r"
                  }`}
                >
                  <img
                    src={p.img}
                    alt={`ポスター: ${p.title}`}
                    className="w-full rounded-sm border border-fes-ink/15"
                  />
                  <figcaption className="flex items-center justify-between px-1 pt-1.5">
                    <span className="truncate font-maru text-[10px] font-bold text-fes-ink/75">
                      {p.handle}
                    </span>
                    <span className="ml-1 flex shrink-0 items-center gap-0.5 font-maru text-[10px] font-black text-fes-red">
                      <span aria-hidden>♥</span> {p.likes}
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>

            <p className="mt-8 text-center">
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

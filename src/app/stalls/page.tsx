/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import Header from "@/components/sections/Header";
import Footer from "@/components/sections/Footer";
import LikeButton from "@/components/LikeButton";
import { createClient } from "@/lib/supabase/server";
import { getLikeInfo } from "@/lib/likes";

export const metadata = { title: "バーチャル屋台 | Substack 夏祭り" };

// 認証状態（Header）と投稿屋台を毎リクエスト取得する
export const dynamic = "force-dynamic";

type Stall = {
  id?: string;
  img: string;
  title: string;
  handle: string;
  likes: number;
  link: string;
  description?: string;
};

// 投稿がまだ 1 件もないときに通りが空にならないよう、デモ用の種屋台を残す
const SEED: Stall[] = [
  { img: "/art/stall-coffee.png", title: "喫茶ストーリーズ", handle: "@coffee_stories", likes: 112, link: "", description: "物語と一杯の珈琲を、あなたに。" },
  { img: "/art/stall-zakka.png", title: "ことば雑貨店", handle: "@kotoba_zakka", likes: 89, link: "", description: "言葉から生まれた雑貨を並べています。" },
  { img: "/art/stall-crystal.png", title: "星よみ水晶堂", handle: "@hoshi_crystal", likes: 76, link: "", description: "星と水晶で、今夜の運勢を占います。" },
  { img: "/art/stall-game.png", title: "レトロゲーム横丁", handle: "@retro_yokocho", likes: 68, link: "", description: "懐かしの名作で遊べる横丁です。" },
  { img: "/art/stall-camera.png", title: "写真館ひこうき雲", handle: "@hikoukigumo_photo", likes: 57, link: "", description: "夏の一瞬を、写真に閉じ込めて。" },
  { img: "/art/stall-art.png", title: "アトリエ金魚", handle: "@atelier_kingyo", likes: 44, link: "", description: "金魚モチーフの小さな作品展。" },
];

export default async function StallsPage() {
  const supabase = createClient();

  let stalls: Stall[] = [];
  try {
    const { data } = await supabase
      .from("posters")
      .select("id, description, title, handle, likes, image_path, link")
      .eq("kind", "stall")
      .order("created_at", { ascending: false })
      .limit(200);

    if (data && data.length > 0) {
      stalls = data.map((row) => ({
        id: row.id,
        img: supabase.storage.from("posters").getPublicUrl(row.image_path).data
          .publicUrl,
        title: row.title,
        handle: row.handle,
        likes: row.likes,
        link: row.link ?? "",
        description: row.description ?? undefined,
      }));
    }
  } catch {
    // Supabase 未設定・接続失敗時はデモ屋台にフォールバック
  }

  if (stalls.length === 0) {
    stalls = [...SEED];
  }

  const ids = stalls.filter((s) => s.id).map((s) => s.id!) as string[];
  const likeInfo = await getLikeInfo(ids);

  return (
    <>
      <Header />
      <main>
        <section className="paper-grain border-b-4 border-night-900/30 bg-kraft py-9 text-fes-ink">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            {/* 見出しと出店導線 */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="font-maru text-2xl font-black text-fes-indigo">
                  バーチャル屋台
                </h1>
                <p className="mt-2 font-maru text-xs font-bold leading-5 text-fes-ink/70">
                  クリエイターたちの屋台がずらりと並ぶ通りです。気になる屋台をのぞいて、Substackの作品も楽しんでください。
                </p>
              </div>
              <Link
                href="/stalls/new"
                className="shrink-0 self-start rounded-full border-2 border-fes-red-deep bg-fes-red px-5 py-2 font-maru text-sm font-black text-kraft-paper shadow-paper-press transition-transform hover:-translate-y-0.5 sm:self-auto"
              >
                屋台を出す ›
              </Link>
            </div>

            {/* 屋台グリッド */}
            <div className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {stalls.map((s, i) => (
                <figure
                  key={`${s.handle}-${i}`}
                  className={`rounded-lg border-[3px] border-kraft-paper bg-kraft-paper p-1.5 shadow-paper-sm ${
                    i % 2 === 0 ? "tilt-l" : "tilt-r"
                  }`}
                >
                  <img
                    src={s.img}
                    alt={`屋台: ${s.title}`}
                    className="w-full rounded-sm border border-fes-ink/15"
                  />
                  <figcaption className="px-1 pt-1.5">
                    <div className="flex items-center justify-between">
                      <span className="truncate font-maru text-[10px] font-bold text-fes-ink/75">
                        {s.handle}
                      </span>
                      {s.id ? (
                        <LikeButton
                          postId={s.id}
                          initialCount={likeInfo[s.id]?.count ?? 0}
                          initialLiked={likeInfo[s.id]?.likedByMe ?? false}
                        />
                      ) : (
                        <span className="ml-1 flex shrink-0 items-center gap-0.5 font-maru text-[10px] font-black text-fes-red">
                          <span aria-hidden>♥</span> {s.likes}
                        </span>
                      )}
                    </div>
                    {s.description && (
                      <p className="mt-1 line-clamp-2 font-maru text-[10px] font-bold leading-4 text-fes-ink/70">
                        {s.description}
                      </p>
                    )}
                    {s.link && (
                      <a
                        href={s.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block font-maru text-[10px] font-black text-fes-indigo hover:underline"
                      >
                        リンクを見る ↗
                      </a>
                    )}
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

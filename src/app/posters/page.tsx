/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import Header from "@/components/sections/Header";
import Footer from "@/components/sections/Footer";
import LikeButton from "@/components/LikeButton";
import { createClient } from "@/lib/supabase/server";
import { getLikeInfo } from "@/lib/likes";

export const metadata = { title: "屋台・ポスター | Substack 夏祭り" };

// 認証状態（Header）と投稿を毎リクエスト取得する
export const dynamic = "force-dynamic";

type Post = {
  id?: string;
  img: string;
  title: string;
  handle: string;
  likes: number;
  link?: string;
  description?: string;
};

// 投稿がまだ 1 件もないときに掲示板が空にならないよう、デモ用の種投稿を残す
const SEED: Post[] = [
  { img: "/art/poster-1.png", title: "夏の夜の読書会", handle: "@book_and_coffee", likes: 128, description: "縁側でひらく、静かな夜の読書会。" },
  { img: "/art/stall-coffee.png", title: "喫茶ストーリーズ", handle: "@coffee_stories", likes: 112, description: "物語と一杯の珈琲を、あなたに。" },
  { img: "/art/poster-2.png", title: "海辺の音楽祭", handle: "@umi_music", likes: 96, description: "波音に合わせて、夏の名曲を。" },
  { img: "/art/stall-zakka.png", title: "ことば雑貨店", handle: "@kotoba_zakka", likes: 89, description: "言葉から生まれた雑貨を並べています。" },
  { img: "/art/poster-3.png", title: "怪談ナイト", handle: "@kaidan_library", likes: 77, description: "ひんやり背すじが凍る、夜の怪談会。" },
  { img: "/art/stall-crystal.png", title: "星よみ水晶堂", handle: "@hoshi_crystal", likes: 76, description: "星と水晶で、今夜の運勢を占います。" },
  { img: "/art/stall-game.png", title: "レトロゲーム横丁", handle: "@retro_yokocho", likes: 68, description: "懐かしの名作で遊べる横丁です。" },
  { img: "/art/poster-4.png", title: "浴衣で語ろう会", handle: "@yukata_talk", likes: 64, description: "浴衣を着て、ゆるっと語らう夜。" },
  { img: "/art/stall-camera.png", title: "写真館ひこうき雲", handle: "@hikoukigumo_photo", likes: 57, description: "夏の一瞬を、写真に閉じ込めて。" },
  { img: "/art/poster-5.png", title: "夏のまんぷく屋台めぐり", handle: "@manpuku_notes", likes: 53, description: "食べ歩きで巡る、屋台グルメ案内。" },
  { img: "/art/stall-art.png", title: "アトリエ金魚", handle: "@atelier_kingyo", likes: 44, description: "金魚モチーフの小さな作品展。" },
  { img: "/art/poster-6.png", title: "ZINEマーケット", handle: "@zine_lab", likes: 41, description: "手づくりの小冊子が集まる一箱古本市。" },
];

export default async function PostersPage() {
  const supabase = createClient();

  let posts: Post[] = [];
  try {
    const { data } = await supabase
      .from("posters")
      .select("id, description, title, handle, likes, image_path, link")
      .order("created_at", { ascending: false })
      .limit(200);

    if (data && data.length > 0) {
      posts = data.map((row) => ({
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
    // Supabase 未設定・接続失敗時はデモ投稿にフォールバック
  }

  if (posts.length === 0) {
    posts = [...SEED];
  }

  const ids = posts.filter((p) => p.id).map((p) => p.id!) as string[];
  const likeInfo = await getLikeInfo(ids);

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
                  屋台・ポスター
                </h1>
                <p className="mt-2 font-maru text-xs font-bold leading-5 text-fes-ink/70">
                  みんなの投稿がぜんぶ並ぶ掲示板です。気になる一枚からSubstackものぞいてみてください。あなたの一枚も、ぜひ飾ってください。
                </p>
              </div>
              <Link
                href="/posters/new"
                className="shrink-0 self-start rounded-full border-2 border-fes-red-deep bg-fes-red px-5 py-2 font-maru text-sm font-black text-kraft-paper shadow-paper-press transition-transform hover:-translate-y-0.5 sm:self-auto"
              >
                投稿する ›
              </Link>
            </div>

            {/* 投稿グリッド */}
            <div className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {posts.map((p, i) => (
                <figure
                  key={`${p.handle}-${i}`}
                  className={`rounded-lg border-[3px] border-kraft-paper bg-kraft-paper p-1.5 shadow-paper-sm ${
                    i % 2 === 0 ? "tilt-l" : "tilt-r"
                  }`}
                >
                  <img
                    src={p.img}
                    alt={`投稿: ${p.title}`}
                    className="w-full rounded-sm border border-fes-ink/15"
                  />
                  <figcaption className="px-1 pt-1.5">
                    <div className="flex items-center justify-between">
                      <span className="truncate font-maru text-[10px] font-bold text-fes-ink/75">
                        {p.handle}
                      </span>
                      {p.id ? (
                        <LikeButton
                          postId={p.id}
                          initialCount={likeInfo[p.id]?.count ?? 0}
                          initialLiked={likeInfo[p.id]?.likedByMe ?? false}
                        />
                      ) : (
                        <span className="ml-1 flex shrink-0 items-center gap-0.5 font-maru text-[10px] font-black text-fes-red">
                          <span aria-hidden>♥</span> {p.likes}
                        </span>
                      )}
                    </div>
                    {p.description && (
                      <p className="mt-1 line-clamp-2 font-maru text-[10px] font-bold leading-4 text-fes-ink/70">
                        {p.description}
                      </p>
                    )}
                    {p.link && (
                      <a
                        href={p.link}
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

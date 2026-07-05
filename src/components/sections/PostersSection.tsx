/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import LikeButton from "@/components/LikeButton";
import { createClient } from "@/lib/supabase/server";
import { getLikeInfo } from "@/lib/likes";

type Poster = {
  id?: string;
  img: string;
  title: string;
  handle: string;
  likes: number;
  description?: string;
};

// 投稿がまだ 1 件もないときに掲示板が空にならないよう、デモ用の種ポスターを残す
const SEED: Poster[] = [
  { img: "/art/poster-1.png", title: "夏の夜の読書会", handle: "@book_and_coffee", likes: 128, description: "縁側でひらく、静かな夜の読書会。" },
  { img: "/art/poster-2.png", title: "海辺の音楽祭", handle: "@umi_music", likes: 96, description: "波音に合わせて、夏の名曲を。" },
  { img: "/art/poster-3.png", title: "怪談ナイト", handle: "@kaidan_library", likes: 77, description: "ひんやり背すじが凍る、夜の怪談会。" },
  { img: "/art/poster-4.png", title: "浴衣で語ろう会", handle: "@yukata_talk", likes: 64, description: "浴衣を着て、ゆるっと語らう夜。" },
  { img: "/art/poster-5.png", title: "夏のまんぷく屋台めぐり", handle: "@manpuku_notes", likes: 53, description: "食べ歩きで巡る、屋台グルメ案内。" },
  { img: "/art/poster-6.png", title: "ZINEマーケット", handle: "@zine_lab", likes: 41, description: "手づくりの小冊子が集まる一箱古本市。" },
];

export default async function PostersSection() {
  const supabase = createClient();

  let posters: Poster[] = [];
  try {
    const { data } = await supabase
      .from("posters")
      .select("id, description, title, handle, likes, image_path")
      .eq("kind", "poster")
      .order("created_at", { ascending: false })
      .limit(24);

    if (data && data.length > 0) {
      posters = data.map((row) => ({
        id: row.id,
        img: supabase.storage.from("posters").getPublicUrl(row.image_path).data
          .publicUrl,
        title: row.title,
        handle: row.handle,
        likes: row.likes,
        description: row.description ?? undefined,
      }));
    }
  } catch {
    // Supabase 未設定・接続失敗時はデモポスターにフォールバック
  }

  if (posters.length === 0) {
    posters = [...SEED];
  }

  const ids = posters.filter((p) => p.id).map((p) => p.id!) as string[];
  const likeInfo = await getLikeInfo(ids);

  return (
    <section
      id="posters"
      className="paper-grain border-b-4 border-night-900/30 bg-kraft py-9 text-fes-ink"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:px-6 lg:flex-row lg:items-center">
        {/* セクションラベル */}
        <div className="shrink-0 lg:w-52">
          <h2 className="font-maru text-2xl font-black text-fes-indigo">
            みんなのポスター
          </h2>
          <Link
            href="/posters"
            className="mt-1 inline-block font-maru text-sm font-black text-fes-red hover:underline"
          >
            もっと見る ›
          </Link>
          <p className="mt-2 font-maru text-xs font-bold leading-5 text-fes-ink/70">
            夏祭りのテーマで投稿されたポスターをチェックしよう！
          </p>
        </div>

        {/* ポスターカード（モバイルは横スクロール） */}
        <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-6 lg:overflow-visible">
          {posters.map((p, i) => (
            <figure
              key={`${p.handle}-${i}`}
              className={`w-36 shrink-0 snap-start rounded-lg border-[3px] border-kraft-paper bg-kraft-paper p-1.5 shadow-paper-sm lg:w-auto ${
                i % 2 === 0 ? "tilt-l" : "tilt-r"
              }`}
            >
              <img
                src={p.img}
                alt={`ポスター: ${p.title}`}
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
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

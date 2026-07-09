/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import PaperCard from "../PaperCard";

const GAMES = [
  {
    title: "輪 投 げ",
    desc: "ねらって投げて高得点をめざそう！",
    icon: "/art/game-rings.png",
    href: "/ring-toss",
  },
  {
    title: "射 的",
    desc: "的をねらって景品をゲット！",
    icon: "/art/game-rifle.png",
    href: "/shooting",
  },
  {
    title: "射的 3D",
    desc: "立体の的を本格3Dでねらいうち！",
    icon: "/art/game-rifle.png",
    href: "/shooting-3d",
  },
  {
    title: "金魚すくい",
    desc: "ポイですくって金魚をゲット！",
    icon: "/art/game-bowl.png",
    href: "/goldfish",
  },
  {
    title: "ヨーヨーすくい",
    desc: "こよりが切れる前にすくえ！金ヨーヨーで高得点！",
    icon: "/art/game-yoyo.png",
    href: "/yoyo",
  },
  {
    title: "わたあめ",
    desc: "ぐるぐる巻いてふわふわに育てよう！",
    icon: "/art/game-cotton-candy.png",
    href: "/cotton-candy",
  },
  {
    title: "たぬき叩き",
    desc: "たぬきをぽこぽこ！お邪魔キャラに気をつけて！",
    icon: "/art/game-whack.png",
    href: "/whack",
  },
  {
    title: "ベビーカステラ",
    desc: "きつね色になったら返す！焦げる前にタップ！",
    icon: "/art/game-castella.png",
    href: "/castella",
  },
  {
    title: "ベーコンエッグたい焼き",
    desc: "卵をど真ん中に！きつね色で取り出そう！",
    icon: "/art/game-taiyaki.png",
    href: "/taiyaki",
  },
  {
    title: "たまごわけ",
    desc: "斑点はウズラ・無地はひよこ！見分けて仕分けろ！",
    icon: "/art/game-tamagowake.png",
    href: "/tamagowake",
  },
] as const;

export default function GamesSection() {
  return (
    <section id="games" className="relative border-y-4 border-kraft/30 bg-night-900/70 py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 sm:px-6 lg:flex-row lg:items-stretch">
        {/* セクションラベル */}
        <div className="torn-2 flex shrink-0 flex-col items-center justify-center gap-3 border-[3px] border-dashed border-kraft/70 bg-night-800/80 px-8 py-5 lg:w-52">
          <p className="text-center font-maru text-xl font-black leading-9 text-kraft-paper">
            ミニゲームで
            <br />
            遊ぼう！
          </p>
          {/* ランキングは PC ではラベル内に。スマホでは「先に空のランキングが目立つ」のを避けるため
              カードの下（下記 lg:hidden リンク）に回す。 */}
          <Link
            href="/rankings"
            className="hidden rounded-full border-2 border-kraft/60 bg-night-900/60 px-4 py-1.5 font-maru text-xs font-black text-kraft-paper transition-colors hover:text-fes-gold lg:inline-block"
          >
            🏆 ランキング
          </Link>
        </div>

        {/* ゲームカード：ポスター風の縦カードをグリッドで並べる。
            スマホ2列 → タブレット3列 → PC4列（ゲームが増えても折り返して並ぶ）。 */}
        <div className="grid w-full min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {GAMES.map((g, i) => (
            <PaperCard
              key={g.href}
              torn={i % 2 === 0 ? 1 : 2}
              className={`flex flex-col items-center p-3 pb-4 text-center ${i % 2 === 0 ? "tilt-l" : "tilt-r"}`}
            >
              <img
                src={g.icon}
                alt=""
                className="pointer-events-none h-20 w-20 object-contain sm:h-24 sm:w-24"
              />
              <h3 className="mt-1 font-maru text-base font-black tracking-wide text-fes-indigo sm:text-lg">
                {g.title}
              </h3>
              <p className="mt-1 font-maru text-[11px] font-bold leading-4 text-fes-ink/75">
                {g.desc}
              </p>
              <Link
                href={g.href}
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border-2 border-fes-red-deep bg-fes-red px-4 py-1.5 font-maru text-xs font-black text-kraft-paper shadow-paper-sm transition-transform hover:-translate-y-0.5"
              >
                遊ぶ
                <span aria-hidden className="flex h-4 w-4 items-center justify-center rounded-full bg-kraft-paper text-[9px] text-fes-red">
                  ▶
                </span>
              </Link>
            </PaperCard>
          ))}
        </div>

        {/* スマホ専用: ランキング導線はゲームの「下」に置く（先に目立たせない） */}
        <Link
          href="/rankings"
          className="self-center rounded-full border-2 border-kraft/60 bg-night-900/60 px-6 py-2 font-maru text-xs font-black text-kraft-paper transition-colors hover:text-fes-gold lg:hidden"
        >
          🏆 ランキングを見る
        </Link>
      </div>
    </section>
  );
}

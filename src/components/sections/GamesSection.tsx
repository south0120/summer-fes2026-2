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
    title: "金魚すくい",
    desc: "ポイですくって金魚をゲット！",
    icon: "/art/game-bowl.png",
    href: "/goldfish",
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
          <Link
            href="/rankings"
            className="rounded-full border-2 border-kraft/60 bg-night-900/60 px-4 py-1.5 font-maru text-xs font-black text-kraft-paper transition-colors hover:text-fes-gold"
          >
            🏆 ランキング
          </Link>
        </div>

        {/* ゲームカード
            モバイル: 縦積み。PC(sm以上): 横1列。ゲームが少ないうちは伸びて横幅いっぱいに、
            増えたら折り返さず横スクロール（basis + grow + shrink-0 + overflow-x-auto）。 */}
        <div className="flex w-full min-w-0 flex-col gap-5 sm:-mx-1 sm:flex-row sm:overflow-x-auto sm:px-1 sm:pb-2">
          {GAMES.map((g, i) => (
            <PaperCard
              key={g.href}
              torn={i % 2 === 0 ? 1 : 2}
              className={`relative overflow-hidden p-4 pb-5 sm:shrink-0 sm:grow sm:basis-[280px] sm:snap-start ${i % 2 === 0 ? "tilt-l" : "tilt-r"}`}
            >
              <img
                src={g.icon}
                alt=""
                className="pointer-events-none absolute -right-2 bottom-0 w-28 sm:w-24 lg:w-28"
              />
              <h3 className="font-maru text-2xl font-black tracking-wider text-fes-indigo">
                {g.title}
              </h3>
              <p className="mt-2 max-w-[60%] font-maru text-xs font-bold leading-5 text-fes-ink/80">
                {g.desc}
              </p>
              <Link
                href={g.href}
                className="mt-4 inline-flex items-center gap-1.5 rounded-full border-2 border-fes-red-deep bg-fes-red px-5 py-1.5 font-maru text-sm font-black text-kraft-paper shadow-paper-sm transition-transform hover:-translate-y-0.5"
              >
                遊ぶ
                <span aria-hidden className="flex h-4 w-4 items-center justify-center rounded-full bg-kraft-paper text-[9px] text-fes-red">
                  ▶
                </span>
              </Link>
            </PaperCard>
          ))}
        </div>
      </div>
    </section>
  );
}

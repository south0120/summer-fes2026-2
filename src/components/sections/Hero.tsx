/* eslint-disable @next/next/no-img-element */
import Lantern from "../Lantern";
import Firework from "../Firework";

/** 提灯の電線（ヒーロー上部） */
function LanternString() {
  const lanterns = [
    { size: 40, color: "red", swing: "fast" },
    { size: 30, color: "orange", swing: "slow" },
    { size: 46, color: "red", swing: "slow" },
    { size: 32, color: "orange", swing: "fast" },
    { size: 42, color: "red", swing: "slow" },
    { size: 30, color: "orange", swing: "fast" },
    { size: 46, color: "red", swing: "fast" },
    { size: 34, color: "orange", swing: "slow" },
    { size: 40, color: "red", swing: "slow" },
  ] as const;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0" aria-hidden>
      {/* 電線 */}
      <svg
        className="absolute inset-x-0 top-2 h-10 w-full"
        preserveAspectRatio="none"
        viewBox="0 0 100 10"
      >
        <path
          d="M0,2 Q25,9 50,4 T100,3"
          fill="none"
          stroke="rgba(238,210,172,.4)"
          strokeWidth="0.35"
        />
      </svg>
      <div className="flex justify-between px-[3%] pt-3 sm:px-[5%]">
        {lanterns.map((l, i) => (
          <Lantern
            key={i}
            size={l.size}
            color={l.color}
            swing={l.swing}
            className={i % 3 === 1 ? "hidden sm:inline-flex" : ""}
          />
        ))}
      </div>
    </div>
  );
}

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pb-16 pt-20 sm:pt-24">
      <LanternString />

      {/* 花火（背景の装飾） */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <Firework size={110} color="#E8A93B" className="absolute left-[6%] top-[8%] opacity-70" />
        <Firework size={70} color="#DD6B4F" delay={1} className="absolute left-[24%] top-[20%] opacity-60" />
        <Firework size={90} color="#7FB5A8" delay={2} className="absolute right-[8%] top-[6%] opacity-60" />
        <Firework size={64} color="#E8A93B" delay={3} className="absolute right-[28%] top-[16%] opacity-50" />
        <Firework size={54} color="#DD6B4F" delay={2} className="absolute left-[46%] top-[4%] opacity-45" />
      </div>

      {/* 左: やぐらの切り絵 */}
      <img
        src="/art/hero-yagura.png"
        alt=""
        className="pointer-events-none absolute -left-6 top-24 hidden w-[24vw] max-w-[360px] lg:block"
      />
      {/* 右: 柴犬の屋台 */}
      <img
        src="/art/hero-stall.png"
        alt=""
        className="pointer-events-none absolute -right-4 top-40 hidden w-[20vw] max-w-[300px] lg:block"
      />
      {/* 右中央: 夏祭りうちわ */}
      <img
        src="/art/hero-uchiwa.png"
        alt=""
        className="pointer-events-none absolute right-[19%] top-16 hidden w-[11vw] max-w-[170px] xl:block"
      />

      {/* 中央コンテンツ */}
      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-4 text-center">
        <img src="/art/tagline.png" alt="つながる、遊ぶ、つくる。" className="w-52 sm:w-60" />
        <h1 className="mt-1">
          <img
            src="/art/title-plaque.png"
            alt="Substack 夏祭り"
            className="w-full max-w-[620px]"
          />
        </h1>
        <p className="mt-4 max-w-xl font-maru text-sm font-bold leading-7 text-kraft sm:text-base">
          ポスターを投稿したり、屋台を出したり、ミニゲームで遊んだり、
          <br className="hidden sm:block" />
          みんなで楽しむ、オンラインの夏祭りへようこそ！
        </p>

        {/* CTA プレート */}
        <div className="mt-8 flex flex-col items-stretch gap-4 sm:flex-row">
          <a
            href="#posters"
            className="torn group flex items-center gap-3 border-[3px] border-kraft-paper/90 bg-fes-red px-5 py-3.5 text-left shadow-paper transition-transform hover:-translate-y-1"
          >
            <span className="torn-2 flex h-11 w-11 shrink-0 items-center justify-center border-2 border-fes-red-deep bg-kraft-paper text-xl">
              📮
            </span>
            <span>
              <span className="block font-maru text-lg font-black text-kraft-paper">
                ポスターを投稿
              </span>
              <span className="block font-maru text-xs font-bold text-kraft-light/90">
                あなたのイベントや作品を紹介！
              </span>
            </span>
          </a>
          <a
            href="#stalls"
            className="torn-2 group flex items-center gap-3 border-[3px] border-kraft-paper/90 bg-fes-teal px-5 py-3.5 text-left shadow-paper transition-transform hover:-translate-y-1"
          >
            <span className="torn flex h-11 w-11 shrink-0 items-center justify-center border-2 border-fes-teal-deep bg-kraft-paper text-xl">
              ⛩️
            </span>
            <span>
              <span className="block font-maru text-lg font-black text-kraft-paper">
                屋台を出す
              </span>
              <span className="block font-maru text-xs font-bold text-kraft-light/90">
                オリジナルの屋台を開こう！
              </span>
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}

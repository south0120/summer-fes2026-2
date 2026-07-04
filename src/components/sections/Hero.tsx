/* eslint-disable @next/next/no-img-element */
import Firework from "@/components/Firework";

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      {/* 一枚絵の背景（夜の会場ジオラマ）
          390px では横が大きくクロップされるため、右寄せ（柴犬+屋台）で構図を保つ */}
      <img
        src="/art/hero-bg.webp"
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-[82%_78%] sm:object-[center_78%]"
      />
      {/* 下端を夜色へなじませる + 中央の文字の可読性を確保する薄い暗幕 */}
      <div
        className="absolute inset-0"
        aria-hidden
        style={{
          background:
            "linear-gradient(180deg, rgba(3,18,42,.42) 0%, rgba(3,18,42,.06) 30%, rgba(3,18,42,.2) 60%, rgba(3,18,42,.7) 100%)",
        }}
      />

      {/* 上空の小さな打ち上げ花火（背景一枚絵の花火と重ならない空きスペースに薄く）
          モバイルは背景クロップで花火が既に密なので出さない */}
      <div
        className="hero-rise hero-rise-d3 pointer-events-none absolute inset-0 hidden sm:block"
        aria-hidden
      >
        <Firework
          size={60}
          color="#E8A93B"
          className="absolute left-[12%] top-[18%] opacity-40"
        />
        <Firework
          size={44}
          color="#F6E4C4"
          delay={2}
          className="absolute left-[30%] top-[6%] opacity-30"
        />
        <Firework
          size={40}
          color="#E8A93B"
          delay={1}
          className="absolute right-[5%] top-[38%] opacity-30"
        />
      </div>

      {/* 中央コンテンツ（ヒーローは画面の約55%の高さ・縦センター） */}
      <div className="relative mx-auto flex min-h-[54svh] max-w-3xl flex-col items-center justify-center px-4 py-8 text-center sm:min-h-[58svh] sm:py-10">
        <img
          src="/art/tagline.png"
          alt="つながる、遊ぶ、つくる。"
          className="hero-rise w-48 drop-shadow-[0_3px_6px_rgba(0,0,0,.5)] sm:w-56"
        />
        <h1 className="hero-rise hero-rise-d1 mt-2 w-full">
          <img
            src="/art/title-logo.webp"
            alt="Substack 夏祭り"
            className="hero-float mx-auto w-full max-w-[520px] drop-shadow-[0_10px_24px_rgba(0,0,0,.5)] sm:max-w-[720px]"
          />
        </h1>
        <p
          className="hero-rise hero-rise-d2 mt-4 max-w-xl font-maru text-sm font-bold leading-7 text-kraft-paper sm:text-base"
          style={{ textShadow: "0 2px 8px rgba(3,18,42,.9), 0 0 2px rgba(3,18,42,.9)" }}
        >
          ポスターを投稿したり、屋台を出したり、ミニゲームで遊んだり、
          <br className="hidden sm:block" />
          みんなで楽しむ、オンラインの夏祭りへようこそ！
        </p>

        {/* CTA プレート（モバイルは幅いっぱいに広げてタップ領域を確保） */}
        <div className="hero-rise hero-rise-d3 mt-7 flex w-full max-w-sm flex-col items-stretch gap-4 sm:w-auto sm:max-w-none sm:flex-row">
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

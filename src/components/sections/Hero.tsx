/* eslint-disable @next/next/no-img-element */

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      {/* 一枚絵の背景（夜の会場ジオラマ） */}
      <img
        src="/art/hero-bg.webp"
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-[center_78%]"
      />
      {/* 下端を夜色へなじませる + 中央の文字の可読性を確保する薄い暗幕 */}
      <div
        className="absolute inset-0"
        aria-hidden
        style={{
          background:
            "linear-gradient(180deg, rgba(3,18,42,.42) 0%, rgba(3,18,42,.05) 30%, rgba(3,18,42,.12) 62%, rgba(3,18,42,.66) 100%)",
        }}
      />

      {/* 中央コンテンツ */}
      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-4 pb-16 pt-12 text-center sm:pb-20 sm:pt-14">
        <img
          src="/art/tagline.png"
          alt="つながる、遊ぶ、つくる。"
          className="w-48 drop-shadow-[0_3px_6px_rgba(0,0,0,.5)] sm:w-56"
        />
        <h1 className="mt-2">
          <img
            src="/art/title-logo.webp"
            alt="Substack 夏祭り"
            className="w-full max-w-[440px] drop-shadow-[0_10px_24px_rgba(0,0,0,.45)] sm:max-w-[500px]"
          />
        </h1>
        <p
          className="mt-4 max-w-xl font-maru text-sm font-bold leading-7 text-kraft-paper sm:text-base"
          style={{ textShadow: "0 2px 8px rgba(3,18,42,.9), 0 0 2px rgba(3,18,42,.9)" }}
        >
          ポスターを投稿したり、屋台を出したり、ミニゲームで遊んだり、
          <br className="hidden sm:block" />
          みんなで楽しむ、オンラインの夏祭りへようこそ！
        </p>

        {/* CTA プレート */}
        <div className="mt-7 flex flex-col items-stretch gap-4 sm:flex-row">
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

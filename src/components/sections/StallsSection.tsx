/* eslint-disable @next/next/no-img-element */
const STALLS = [
  { name: "喫茶ストーリーズ", handle: "@story_jpn", visitors: 94, icon: "/art/stall-coffee.png", awning: "stripe-awning-red" },
  { name: "雑貨と文具のお店", handle: "@zakka_note", visitors: 96, icon: "/art/stall-zakka.png", awning: "stripe-awning-blue" },
  { name: "占いの館と星まつり", handle: "@hoshi_uranai", visitors: 89, icon: "/art/stall-crystal.png", awning: "stripe-awning-green" },
  { name: "レトロゲーム横丁", handle: "@retro_game_jp", visitors: 73, icon: "/art/stall-game.png", awning: "stripe-awning-yellow" },
  { name: "写真と旅の屋台", handle: "@tabi_camera", visitors: 67, icon: "/art/stall-camera.png", awning: "stripe-awning-red" },
  { name: "創作イラスト屋台", handle: "@sousaku_illust", visitors: 59, icon: "/art/stall-art.png", awning: "stripe-awning-blue" },
] as const;

export default function StallsSection() {
  return (
    <section
      id="stalls"
      className="paper-grain border-b-4 border-night-900/40 bg-kraft-light py-9 text-fes-ink"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:px-6 lg:flex-row lg:items-center">
        {/* セクションラベル */}
        <div className="shrink-0 lg:w-52">
          <h2 className="font-maru text-2xl font-black text-fes-indigo">
            バーチャル屋台
          </h2>
          <a
            href="#stalls"
            className="mt-1 inline-block font-maru text-sm font-black text-fes-red hover:underline"
          >
            もっと見る ›
          </a>
          <p className="mt-2 font-maru text-xs font-bold leading-5 text-fes-ink/70">
            クリエイターたちの屋台をのぞいて、作品やコンテンツを楽しもう！
          </p>
        </div>

        {/* 屋台カード（モバイルは横スクロール） */}
        <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-6 lg:overflow-visible">
          {STALLS.map((s, i) => (
            <div
              key={s.handle}
              className={`w-44 shrink-0 snap-start overflow-hidden rounded-lg border-[3px] border-kraft-paper bg-kraft-paper shadow-paper-sm lg:w-auto ${
                i % 2 === 0 ? "tilt-r" : "tilt-l"
              }`}
            >
              {/* テントの屋根 */}
              <div className={`${s.awning} h-5 border-b-2 border-fes-ink/20`} aria-hidden />
              <div className="relative p-2.5 pb-2">
                <h3 className="font-maru text-sm font-black leading-5 text-fes-indigo">
                  {s.name}
                </h3>
                <p className="mt-0.5 font-maru text-[10px] font-bold text-fes-ink/65">
                  {s.handle}
                </p>
                <p className="mt-0.5 font-maru text-[10px] font-black text-fes-teal">
                  <span aria-hidden>👤</span> {s.visitors}人
                </p>
                <div className="mt-1 flex items-end justify-between">
                  <img src={s.icon} alt="" className="h-12 w-14 object-contain" />
                  <a
                    href="#stalls"
                    className="rounded-full border-2 border-fes-red-deep bg-fes-red px-3 py-1 font-maru text-[11px] font-black text-kraft-paper shadow-paper-press transition-transform hover:-translate-y-0.5"
                  >
                    のぞく
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

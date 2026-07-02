/* eslint-disable @next/next/no-img-element */
const EVENTS = [
  { time: "18:00", title: "オープニングセレモニー", note: "", emoji: "🏮" },
  { time: "19:00", title: "盆踊りタイム", note: "みんなで踊ろう！", emoji: "🎵" },
  { time: "20:00", title: "花火大会", note: "（オンライン）", emoji: "✨" },
  { time: "21:00", title: "怪談ライブ", note: "ひんやり話会", emoji: "👻" },
  { time: "22:00", title: "ミニゲーム大会", note: "景品あり！", emoji: "🎯" },
  { time: "23:00", title: "エンディング", note: "また会おう！", emoji: "🐕" },
] as const;

export default function ScheduleSection() {
  return (
    <section id="schedule" className="seigaiha relative bg-night-900/80 py-9">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:px-6 lg:flex-row lg:items-center">
        {/* セクションラベル */}
        <div className="shrink-0 lg:w-52">
          <h2 className="font-maru text-2xl font-black text-kraft-paper">
            スケジュール
          </h2>
          <p className="mt-2 font-maru text-xs font-bold leading-5 text-kraft/80">
            タイムテーブルをチェックしよう！
          </p>
        </div>

        {/* タイムテーブル（モバイルは横スクロール） */}
        <div className="-mx-4 flex snap-x gap-3.5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-6 lg:overflow-visible">
          {EVENTS.map((e, i) => (
            <div
              key={e.time}
              className={`${i % 2 === 0 ? "torn tilt-l" : "torn-2 tilt-r"} w-36 shrink-0 snap-start border-2 border-dashed border-kraft/60 bg-night-800/90 p-3 shadow-paper-sm lg:w-auto`}
            >
              <p className="font-maru text-lg font-black text-fes-gold">{e.time}</p>
              <p className="mt-1 font-maru text-sm font-black leading-5 text-kraft-paper">
                {e.title}
                <span aria-hidden className="ml-1">{e.emoji}</span>
              </p>
              {e.note && (
                <p className="mt-0.5 font-maru text-[11px] font-bold text-kraft/75">
                  {e.note}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* 柴犬マスコット */}
        <img
          src="/art/mascot-shiba.png"
          alt="みんなの参加を待ってるよ！"
          className="pointer-events-none hidden w-44 shrink-0 mix-blend-lighten xl:block"
        />
      </div>
    </section>
  );
}

/* eslint-disable @next/next/no-img-element */
const LINK_COLUMNS = [
  {
    heading: "イベントについて",
    links: ["はじめに", "参加方法", "よくある質問"],
  },
  {
    heading: "コミュニティ",
    links: ["ガイドライン", "行動規範", "お問い合わせ"],
  },
  {
    heading: "リンク",
    links: ["Substackについて", "ブログ", "ヘルプセンター"],
  },
] as const;

const SNS = ["𝕏", "◎", "▶", "🎮"] as const;

export default function Footer() {
  return (
    <footer id="news" className="relative border-t-4 border-kraft/25 bg-night-950 pb-10 pt-10">
      {/* 左下の金魚 */}
      <img
        src="/art/goldfish.png"
        alt=""
        className="pointer-events-none absolute bottom-2 left-2 hidden w-24 mix-blend-lighten md:block"
      />
      <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 md:grid-cols-[1.2fr_2fr_1.4fr]">
        {/* ロゴ */}
        <div>
          <p className="font-maru text-xl font-black text-kraft-paper">
            Substack <span className="text-fes-gold">夏祭り</span>
          </p>
          <p className="mt-2 font-maru text-xs font-bold leading-5 text-kraft/60">
            つながる、遊ぶ、つくる。
            <br />
            みんなでつくるクリエイターのお祭り！
          </p>
        </div>

        {/* リンク列 */}
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
          {LINK_COLUMNS.map((col) => (
            <div key={col.heading}>
              <p className="font-maru text-sm font-black text-kraft-paper">
                {col.heading}
              </p>
              <ul className="mt-2.5 space-y-2">
                {col.links.map((label) => (
                  <li key={label}>
                    <a
                      href="#help"
                      className="font-maru text-xs font-bold text-kraft/70 transition-colors hover:text-fes-gold"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* フォロー + メール登録 */}
        <div id="help">
          <p className="font-maru text-sm font-black text-kraft-paper">
            フォローして最新情報をチェック！
          </p>
          <div className="mt-2.5 flex gap-2.5">
            {SNS.map((glyph, i) => (
              <span
                key={i}
                aria-hidden
                className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-kraft/40 bg-night-800 text-sm text-kraft"
              >
                {glyph}
              </span>
            ))}
          </div>
          <div className="mt-4 flex max-w-xs overflow-hidden rounded-lg border-2 border-kraft/50 shadow-paper-sm">
            <input
              type="email"
              placeholder="メールアドレスを入力"
              className="min-w-0 flex-1 bg-kraft-paper px-3 py-2 font-maru text-xs font-bold text-fes-ink placeholder:text-fes-ink/45 focus:outline-none"
            />
            <button
              type="button"
              className="shrink-0 bg-fes-red px-4 font-maru text-xs font-black text-kraft-paper transition-colors hover:bg-fes-red-deep"
            >
              登録
            </button>
          </div>
        </div>
      </div>
      <p className="mt-10 text-center font-maru text-[11px] font-bold text-kraft/40">
        © 2026 Substack 夏祭り実行委員会 — 紙とのりでつくったオンライン会場
      </p>
    </footer>
  );
}

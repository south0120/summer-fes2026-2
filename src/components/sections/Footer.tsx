/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

const LINK_COLUMNS = [
  {
    heading: "イベントについて",
    links: [
      { label: "はじめに", href: "/about" },
      { label: "参加方法", href: "/join" },
      { label: "ランキング", href: "/rankings" },
      { label: "よくあるご質問", href: "/faq" },
    ],
  },
  {
    heading: "コミュニティ",
    links: [
      { label: "ガイドライン", href: "/guidelines" },
      { label: "行動規範・利用規約", href: "/terms" },
      { label: "お問い合わせ", href: "/contact" },
    ],
  },
] as const;

export default function Footer() {
  return (
    <footer id="news" className="relative border-t-4 border-kraft/25 bg-night-950 pb-10 pt-10">
      {/* 左下の金魚 */}
      <img
        src="/art/goldfish.png"
        alt=""
        className="pointer-events-none absolute bottom-2 left-2 hidden w-24 mix-blend-lighten md:block"
      />
      <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 md:grid-cols-[1.4fr_2fr]">
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
        <div className="grid grid-cols-2 gap-6">
          {LINK_COLUMNS.map((col) => (
            <div key={col.heading}>
              <p className="font-maru text-sm font-black text-kraft-paper">
                {col.heading}
              </p>
              <ul className="mt-2.5 space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="font-maru text-xs font-bold text-kraft/70 transition-colors hover:text-fes-gold"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-10 text-center font-maru text-[11px] font-bold text-kraft/40">
        © 2026 Substack 夏祭り実行委員会 — つながる、遊ぶ、つくる。オンラインの夏祭り
      </p>
    </footer>
  );
}

import Link from "next/link";

const NAV = [
  { label: "ホーム", href: "#top", active: true },
  { label: "ポスター", href: "#posters" },
  { label: "屋台", href: "#stalls" },
  { label: "ミニゲーム", href: "#games" },
  { label: "スケジュール", href: "#schedule" },
  { label: "お知らせ", href: "#news" },
  { label: "ヘルプ", href: "#help" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b-2 border-kraft/25 bg-night-950/90 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        {/* ロゴ */}
        <Link href="#top" className="flex shrink-0 items-center gap-2.5">
          <span
            className="flex h-9 w-8 items-center justify-center rounded-md bg-fes-red font-maru text-lg font-black text-kraft-paper shadow-paper-sm"
            aria-hidden
          >
            祭
          </span>
          <span className="font-maru text-lg font-black tracking-wide text-kraft-paper">
            Substack <span className="text-fes-gold">夏祭り</span>
          </span>
        </Link>

        {/* ナビ */}
        <nav className="mx-auto hidden items-center gap-5 lg:flex">
          {NAV.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className={`font-maru text-sm font-bold transition-colors hover:text-fes-gold ${
                item.active
                  ? "border-b-2 border-fes-gold pb-0.5 text-kraft-paper"
                  : "text-kraft/85"
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* 右側アクション */}
        <div className="ml-auto flex shrink-0 items-center gap-2.5 lg:ml-0">
          <button
            type="button"
            className="hidden rounded-lg border-2 border-kraft/50 px-3.5 py-1.5 font-maru text-sm font-bold text-kraft transition-colors hover:border-kraft hover:text-kraft-paper sm:block"
          >
            ログイン
          </button>
          <button
            type="button"
            className="rounded-lg border-2 border-fes-red-deep bg-fes-red px-3.5 py-1.5 font-maru text-sm font-bold text-kraft-paper shadow-paper-sm transition-transform hover:-translate-y-0.5"
          >
            参加する（無料）
          </button>
        </div>
      </div>
    </header>
  );
}

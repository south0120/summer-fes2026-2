import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const NAV = [
  { label: "ホーム", href: "/", active: true },
  { label: "ポスター", href: "/posters" },
  { label: "屋台", href: "/stalls" },
  { label: "ミニゲーム", href: "/#games" },
  { label: "お知らせ", href: "/#news" },
  { label: "ヘルプ", href: "/faq" },
];

export default async function Header() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
          {user ? (
            <>
              <span
                className="hidden max-w-[9rem] truncate font-maru text-xs font-bold text-kraft/85 sm:block"
                title={user.email ?? undefined}
              >
                {user.email}
              </span>
              <form action="/auth/signout" method="post" className="hidden sm:block">
                <button
                  type="submit"
                  className="rounded-lg border-2 border-kraft/50 px-3.5 py-1.5 font-maru text-sm font-bold text-kraft transition-colors hover:border-kraft hover:text-kraft-paper"
                >
                  ログアウト
                </button>
              </form>
              <Link
                href="/posters/new"
                className="rounded-lg border-2 border-fes-red-deep bg-fes-red px-3.5 py-1.5 font-maru text-sm font-bold text-kraft-paper shadow-paper-sm transition-transform hover:-translate-y-0.5"
              >
                参加する（無料）
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-lg border-2 border-kraft/50 px-3.5 py-1.5 font-maru text-sm font-bold text-kraft transition-colors hover:border-kraft hover:text-kraft-paper sm:block"
              >
                ログイン
              </Link>
              <Link
                href="/login"
                className="rounded-lg border-2 border-fes-red-deep bg-fes-red px-3.5 py-1.5 font-maru text-sm font-bold text-kraft-paper shadow-paper-sm transition-transform hover:-translate-y-0.5"
              >
                参加する（無料）
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";

type GameShellProps = {
  /** 例: "輪 投 げ" */
  title: string;
  /** タイトル横の小さい説明 */
  tagline?: string;
  /** スコア表示帯（各ゲームが自由に構成） */
  scoreboard?: ReactNode;
  /** 開始・リザルト等のオーバーレイ。null なら非表示 */
  overlay?: ReactNode;
  /** ステージ中身。data-game-stage(relative aspect-[3/4]) に absolute inset-0 で重ねる */
  children: ReactNode;
};

/**
 * ゲーム共通枠。夜の藍ステージをクラフト紙の額に入れる。
 * ステージは縦3:4固定。canvas は children 側で absolute inset-0 に敷く。
 */
export default function GameShell({
  title,
  tagline,
  scoreboard,
  overlay,
  children,
}: GameShellProps) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pb-8 pt-4">
      {/* ヘッダー行 */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/"
          className="torn-2 border-2 border-kraft/60 bg-night-800/80 px-3 py-1.5 font-maru text-xs font-black text-kraft transition-colors hover:text-kraft-paper"
        >
          ← 会場
        </Link>
        <div className="text-center">
          <h1 className="font-maru text-2xl font-black tracking-[.2em] text-kraft-paper">
            {title}
          </h1>
          {tagline && (
            <p className="font-maru text-[11px] font-bold text-kraft/75">{tagline}</p>
          )}
        </div>
        <span
          className="torn flex h-9 w-9 items-center justify-center border-2 border-fes-red-deep bg-fes-red font-maru text-sm font-black text-kraft-paper"
          aria-hidden
        >
          祭
        </span>
      </div>

      {/* スコア帯 */}
      {scoreboard && (
        <div className="torn mt-3 border-[3px] border-kraft-paper/90 bg-kraft paper-grain px-4 py-2 text-fes-ink shadow-paper-sm">
          {scoreboard}
        </div>
      )}

      {/* ステージ（縦3:4・クラフト紙の額縁） */}
      <div className="torn-2 mt-3 border-[6px] border-kraft bg-night-900 p-1 shadow-paper-lg">
        <div
          data-game-stage
          className="relative aspect-[3/4] w-full touch-none select-none overflow-hidden rounded-md"
        >
          {children}
          {overlay && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-night-950/70 p-5">
              {overlay}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

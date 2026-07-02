import Link from "next/link";
import PaperCard from "./PaperCard";

type GamePlaceholderProps = {
  title: string;
  emoji: string;
  desc: string;
};

/** ゲーム実装を載せるまでの仮ページ */
export default function GamePlaceholder({ title, emoji, desc }: GamePlaceholderProps) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <PaperCard className="max-w-md p-8 text-center">
        <p className="text-5xl" aria-hidden>
          {emoji}
        </p>
        <h1 className="mt-3 font-maru text-3xl font-black tracking-wider text-fes-indigo">
          {title}
        </h1>
        <p className="mt-3 font-maru text-sm font-bold leading-6 text-fes-ink/80">
          {desc}
        </p>
        <p className="mt-2 font-hand text-sm text-fes-ink/60">ただいま設営中…！</p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-full border-2 border-fes-red-deep bg-fes-red px-6 py-2 font-maru text-sm font-black text-kraft-paper shadow-paper-sm transition-transform hover:-translate-y-0.5"
        >
          ← 会場にもどる
        </Link>
      </PaperCard>
    </main>
  );
}

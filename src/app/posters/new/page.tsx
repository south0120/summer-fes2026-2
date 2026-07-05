import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NewPosterForm from "./NewPosterForm";

export const dynamic = "force-dynamic";

export default async function NewPosterPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="torn-2 paper-grain w-full max-w-lg border-[3px] border-kraft-paper/90 bg-kraft p-7 text-fes-ink shadow-paper-lg sm:p-9">
        <p className="font-maru text-sm font-bold text-fes-red">🎆 出展受付</p>
        <h1 className="mt-1 font-maru text-2xl font-black text-fes-indigo">
          ポスターを投稿する
        </h1>
        <p className="mt-2 font-maru text-xs font-bold leading-5 text-fes-ink/70">
          夏祭りのテーマで作ったポスターを貼り出そう！投稿するとすぐに会場に掲示されます。
        </p>

        <a
          href="https://chatgpt.com/g/g-6a45b4d042f88191864da8b7f3b05292-substackxia-ji-rigpts"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 rounded-full border-2 border-fes-indigo/30 bg-kraft-paper px-4 py-2 font-maru text-xs font-black text-fes-indigo hover:-translate-y-0.5"
        >
          🎨 AIでポスター画像をつくる（専用GPTs）↗
        </a>

        <NewPosterForm kind="poster" />

        <p className="mt-6 text-center">
          <Link
            href="/#posters"
            className="font-maru text-xs font-black text-fes-indigo hover:underline"
          >
            ‹ ポスター掲示板にもどる
          </Link>
        </p>
      </div>
    </main>
  );
}

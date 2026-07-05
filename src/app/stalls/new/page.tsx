import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NewPosterForm from "@/app/posters/new/NewPosterForm";

export const dynamic = "force-dynamic";

export default async function NewStallPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/stalls/new");
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="torn-2 paper-grain w-full max-w-lg border-[3px] border-kraft-paper/90 bg-kraft p-7 text-fes-ink shadow-paper-lg sm:p-9">
        <p className="font-maru text-sm font-bold text-fes-red">🏮 出店受付</p>
        <h1 className="mt-1 font-maru text-2xl font-black text-fes-indigo">
          屋台を出す
        </h1>
        <p className="mt-2 font-maru text-xs font-bold leading-5 text-fes-ink/70">
          屋台の画像と、関連するSubstackの投稿リンクを貼って、あなたの屋台を出しましょう。
        </p>

        <NewPosterForm kind="stall" />

        <p className="mt-6 text-center">
          <Link
            href="/#stalls"
            className="font-maru text-xs font-black text-fes-indigo hover:underline"
          >
            ‹ 屋台通りにもどる
          </Link>
        </p>
      </div>
    </main>
  );
}

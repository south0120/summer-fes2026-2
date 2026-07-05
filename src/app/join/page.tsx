import Link from "next/link";

export const metadata = { title: "参加方法 | Substack 夏祭り" };

export default function JoinPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="torn paper-grain w-full max-w-md border-[3px] border-kraft-paper/90 bg-kraft p-7 text-fes-ink shadow-paper-lg sm:p-9">
        <p className="font-maru text-sm font-bold text-fes-red">🏮 ごあんない</p>
        <h1 className="mt-1 font-maru text-2xl font-black text-fes-indigo">
          参加方法
        </h1>
        <p className="mt-2 font-maru text-xs font-bold leading-5 text-fes-ink/70">
          参加はかんたん、3ステップ。もちろんぜんぶ無料です。
        </p>

        <div className="mt-6 space-y-5">
          <section>
            <h2 className="font-maru text-sm font-black text-fes-indigo">
              ① メールアドレスでログイン
            </h2>
            <p className="mt-1.5 font-maru text-xs font-bold leading-5 text-fes-ink/80">
              <Link
                href="/login"
                className="font-black text-fes-indigo underline underline-offset-2 hover:text-fes-red"
              >
                ログインページ
              </Link>{" "}
              でメールアドレスを入力すると、ログイン用のリンク（magic link）がメールで届きます。リンクを開くだけでログイン完了。パスワードを覚える必要はありません。
            </p>
          </section>

          <section>
            <h2 className="font-maru text-sm font-black text-fes-indigo">
              ② ポスターを投稿する
            </h2>
            <p className="mt-1.5 font-maru text-xs font-bold leading-5 text-fes-ink/80">
              ログインしたら、{" "}
              <Link
                href="/posters/new"
                className="font-black text-fes-indigo underline underline-offset-2 hover:text-fes-red"
              >
                ポスター投稿ページ
              </Link>{" "}
              からあなたのポスターを飾れます。用意するのは、夏祭りテーマの画像・タイトル・ハンドル名の3つ。説明文と Substack のリンクは、お好みで添えてください。
            </p>
            <p className="mt-1.5 font-maru text-xs font-bold leading-5 text-fes-ink/80">
              投稿されたポスターは会場の掲示板に貼り出され、来場者みんなの目にとまります。
            </p>
          </section>

          <section>
            <h2 className="font-maru text-sm font-black text-fes-indigo">
              ③ ミニゲームで遊ぶ
            </h2>
            <p className="mt-1.5 font-maru text-xs font-bold leading-5 text-fes-ink/80">
              会場のミニゲームで遊んで、ランキングに挑戦しましょう。スコアは記録されるので、上位を目指すもよし、のんびり縁日気分を味わうもよし。遊び方は自由です。
            </p>
          </section>

          <section>
            <h2 className="font-maru text-sm font-black text-fes-indigo">
              こまったときは
            </h2>
            <p className="mt-1.5 font-maru text-xs font-bold leading-5 text-fes-ink/80">
              <Link
                href="/faq"
                className="font-black text-fes-indigo underline underline-offset-2 hover:text-fes-red"
              >
                よくあるご質問
              </Link>{" "}
              をのぞいてみてください。だいたいのことは、そこに書いてあります。
            </p>
          </section>
        </div>

        <p className="mt-8 text-center">
          <Link
            href="/"
            className="font-maru text-xs font-black text-fes-indigo hover:underline"
          >
            ‹ 会場にもどる
          </Link>
        </p>
      </div>
    </main>
  );
}

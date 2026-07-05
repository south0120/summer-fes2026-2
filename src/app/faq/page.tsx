import Link from "next/link";

export const metadata = { title: "よくあるご質問 | Substack 夏祭り" };

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "Q. 参加に費用はかかりますか？",
    body: [
      "かかりません。ログインも、ポスターの投稿も、ミニゲームも、すべて無料でお楽しみいただけます。",
    ],
  },
  {
    title: "Q. ログインにパスワードは必要ですか？",
    body: [
      "不要です。メールアドレスを入力すると、ログイン用のリンク（magic link）がメールで届きます。リンクを開くだけでログインできます。",
    ],
  },
  {
    title: "Q. どんなポスターを投稿できますか？",
    body: [
      "夏祭りのテーマに沿った画像をお願いしています。自作の画像、または権利をクリアした画像で、ガイドラインに沿ったものであれば大歓迎です。くわしくはガイドラインのページをご覧ください。",
    ],
  },
  {
    title: "Q. 投稿したポスターを取り下げたいときは？",
    body: [
      "現在、投稿後にご自身で削除する機能は準備中です。取り下げをご希望の場合は、お問い合わせからご連絡ください。運営で対応します。なお、ガイドラインに反する投稿は、運営側で非表示・削除する場合があります。",
    ],
  },
  {
    title: "Q. Substack 以外のリンクは貼れますか？",
    body: [
      "ポスターに添えられるリンクは、Substack の URL のみ対応しています。あなたのニュースレターへの入り口として、ぜひ活用してください。",
    ],
  },
  {
    title: "Q. ゲームのスコアはどう記録されますか？",
    body: [
      "ミニゲームで遊んだスコアは、入力した名前とともにランキングに記録されます。上位を目指して何度でも挑戦できます。",
    ],
  },
  {
    title: "Q. スマホでも遊べますか？",
    body: [
      "遊べます。会場はスマホ・タブレット・PC のどれからでもご来場いただけます。",
    ],
  },
];

export default function FaqPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="torn paper-grain w-full max-w-md border-[3px] border-kraft-paper/90 bg-kraft p-7 text-fes-ink shadow-paper-lg sm:p-9">
        <p className="font-maru text-sm font-bold text-fes-red">🏮 ごあんない</p>
        <h1 className="mt-1 font-maru text-2xl font-black text-fes-indigo">
          よくあるご質問
        </h1>
        <p className="mt-2 font-maru text-xs font-bold leading-5 text-fes-ink/70">
          みなさんからよくいただく質問をまとめました。
        </p>

        <div className="mt-6 space-y-5">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="font-maru text-sm font-black text-fes-indigo">
                {section.title}
              </h2>
              {section.body.map((line, i) => (
                <p
                  key={i}
                  className="mt-1.5 font-maru text-xs font-bold leading-5 text-fes-ink/80"
                >
                  {line}
                </p>
              ))}
            </section>
          ))}

          <section>
            <p className="font-maru text-xs font-bold leading-5 text-fes-ink/80">
              解決しないときは{" "}
              <Link
                href="/contact"
                className="font-black text-fes-indigo underline underline-offset-2 hover:text-fes-red"
              >
                お問い合わせ
              </Link>{" "}
              からご連絡ください。
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

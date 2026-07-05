import Link from "next/link";

export const metadata = { title: "お問い合わせ | Substack 夏祭り" };

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "ご連絡の方法",
    body: [
      "「Substack 夏祭り」に関するご質問・ご要望・不具合のご報告は、ページ管理人のサウスまで、Substack の DM またはコメントでご連絡ください。",
      "専用のお問い合わせフォームは、ただいま準備中です。できあがるまで、もうしばらくお待ちください。",
    ],
  },
  {
    title: "お問い合わせの前に",
    body: [
      "よくいただくご質問は「よくあるご質問」のページにまとめています。お急ぎのときほど、先にのぞいてみると早く解決するかもしれません。",
    ],
  },
  {
    title: "お返事について",
    body: [
      "このお祭りは小さな運営チームで営まれています。お返事までにお時間をいただくことがありますが、ひとつひとつ順番に読ませていただきます。気長にお待ちいただけるとうれしいです。",
    ],
  },
];

export default function ContactPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="torn paper-grain w-full max-w-md border-[3px] border-kraft-paper/90 bg-kraft p-7 text-fes-ink shadow-paper-lg sm:p-9">
        <p className="font-maru text-sm font-bold text-fes-red">🏮 ごあんない</p>
        <h1 className="mt-1 font-maru text-2xl font-black text-fes-indigo">
          お問い合わせ
        </h1>
        <p className="mt-2 font-maru text-xs font-bold leading-5 text-fes-ink/70">
          お祭りのこと、お気軽にお声がけください。
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
            <h2 className="font-maru text-sm font-black text-fes-indigo">
              サウスへ連絡する
            </h2>
            <a
              href="https://substack.com/@south0120"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-block rounded-full border-2 border-fes-red-deep bg-fes-red px-5 py-2 font-maru text-sm font-black text-kraft-paper shadow-paper-press transition-transform hover:-translate-y-0.5"
            >
              サウスの Substack を開く ↗
            </a>
          </section>

          <section>
            <p className="font-maru text-xs font-bold leading-5 text-fes-ink/80">
              →{" "}
              <Link
                href="/faq"
                className="font-black text-fes-indigo underline underline-offset-2 hover:text-fes-red"
              >
                よくあるご質問を見る
              </Link>
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

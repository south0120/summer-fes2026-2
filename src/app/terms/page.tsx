import Link from "next/link";

export const metadata = { title: "利用規約 | Substack 夏祭り" };

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "第1条（適用）",
    body: [
      "本規約は、「Substack 夏祭り」（以下「本サイト」）の利用に関する条件を定めるものです。利用者は、本サイトを利用することにより、本規約に同意したものとみなされます。",
    ],
  },
  {
    title: "第2条（禁止事項）",
    body: [
      "利用者は、本サイトの利用にあたり、次の行為をしてはなりません。",
      "・法令または公序良俗に違反する行為",
      "・第三者の権利（著作権・肖像権・プライバシー等）を侵害する行為",
      "・不正アクセス、スコアの改ざんその他本サイトの運営を妨害する行為",
      "・他の利用者が不快に感じる名前・投稿を登録する行為",
    ],
  },
  {
    title: "第3条（行動規範）",
    body: [
      "利用者は、本サイトの利用にあたり、次の行動規範を守るものとします。",
      "・他の利用者に敬意を持って交流すること",
      "・ハラスメントにあたる行為をしないこと",
      "・差別的な表現を用いないこと",
      "・運営が本サイトの円滑な運営のために行う指示・お願いに協力すること",
    ],
  },
  {
    title: "第4条（投稿物の扱い）",
    body: [
      "利用者が本サイトに投稿したポスター・スコア・名前等（以下「投稿物」）の権利は投稿者に帰属します。ただし、運営は本サイトの表示・紹介に必要な範囲で投稿物を無償で利用できるものとします。",
      "運営は、本規約に違反する投稿物を、事前の通知なく非表示または削除できるものとします。",
    ],
  },
  {
    title: "第5条（免責）",
    body: [
      "本サイトは趣味・イベント目的で運営されるものであり、その完全性・正確性・継続性を保証しません。本サイトの利用または利用不能によって生じたいかなる損害についても、運営は責任を負わないものとします。",
    ],
  },
  {
    title: "第6条（改定）",
    body: [
      "運営は、必要と判断した場合、利用者への事前の通知なく本規約を改定できるものとします。改定後の規約は、本ページに掲載した時点から効力を生じます。",
    ],
  },
];

export default function TermsPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="torn paper-grain w-full max-w-md border-[3px] border-kraft-paper/90 bg-kraft p-7 text-fes-ink shadow-paper-lg sm:p-9">
        <p className="font-maru text-sm font-bold text-fes-red">🏮 おしらせ</p>
        <h1 className="mt-1 font-maru text-2xl font-black text-fes-indigo">
          利用規約
        </h1>
        <p className="mt-2 font-maru text-xs font-bold leading-5 text-fes-ink/70">
          「Substack 夏祭り」をご利用いただく前に、以下の規約をご確認ください。
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
              制定日
            </h2>
            <p className="mt-1.5 font-maru text-xs font-bold leading-5 text-fes-ink/80">
              2026年7月4日 制定
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

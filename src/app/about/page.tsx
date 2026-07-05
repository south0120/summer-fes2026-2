import Link from "next/link";

export const metadata = { title: "はじめに | Substack 夏祭り" };

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "このお祭りについて",
    body: [
      "「Substack 夏祭り」は、Substack のクリエイターが集まってつくる、オンラインのお祭り会場です。紙とのりで工作したような、ペーパークラフトの夜祭りの世界に、提灯がゆれて花火があがります。",
      "だれかが用意した完成品のイベントではなく、参加するみんなのポスターや遊んだ記録が少しずつ会場を賑やかにしていく、「みんなでつくるお祭り」です。",
    ],
  },
  {
    title: "できること",
    body: [
      "・ポスターを飾る — 夏祭りテーマの画像を投稿して、掲示板にあなたのポスターを貼り出せます。Substack のリンクを添えれば、お祭りがあなたのニュースレターの入り口にもなります。",
      "・ミニゲームで遊ぶ — 会場のミニゲームで、縁日気分をひとしきり楽しめます。",
      "・ランキングに挑戦 — ゲームのスコアはランキングに記録されます。名前を残して、夏の思い出をひとつ増やしてください。",
    ],
  },
  {
    title: "参加は無料",
    body: [
      "参加に費用は一切かかりません。メールアドレスがあればログインでき、パスワードも不要です。浴衣も下駄もいりません。気が向いたときに、ふらっと立ち寄ってください。",
      "参加のくわしい手順は「参加方法」のページにまとめています。",
    ],
  },
];

export default function AboutPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="torn paper-grain w-full max-w-md border-[3px] border-kraft-paper/90 bg-kraft p-7 text-fes-ink shadow-paper-lg sm:p-9">
        <p className="font-maru text-sm font-bold text-fes-red">🏮 ごあんない</p>
        <h1 className="mt-1 font-maru text-2xl font-black text-fes-indigo">
          はじめに
        </h1>
        <p className="mt-2 font-maru text-xs font-bold leading-5 text-fes-ink/70">
          ようこそ、「Substack 夏祭り」へ。ここは紙とのりでつくった、オンラインのお祭り会場です。
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
              さっそく参加してみたい方は{" "}
              <Link
                href="/join"
                className="font-black text-fes-indigo underline underline-offset-2 hover:text-fes-red"
              >
                参加方法
              </Link>{" "}
              をご覧ください。
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

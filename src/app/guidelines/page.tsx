import Link from "next/link";

export const metadata = { title: "ガイドライン | Substack 夏祭り" };

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "みんなが気持ちよく楽しむために",
    body: [
      "このお祭りは、Substack のクリエイターと読者が集まる、みんなの会場です。ここに来た人が「来てよかったな」と思って帰れるように、以下のことを心にとめてご参加ください。",
    ],
  },
  {
    title: "投稿してよいもの",
    body: [
      "・ご自身で制作した画像",
      "・利用する権利をきちんとクリアした画像",
      "・夏祭りのテーマに沿った、みんなで見て楽しめるポスター",
    ],
  },
  {
    title: "してはいけないこと",
    body: [
      "・他者を傷つける表現、攻撃的・差別的な内容の投稿",
      "・他者の著作権・肖像権など、権利を侵害する画像の投稿",
      "・宣伝の連投などのスパム行為",
      "・他のクリエイターや運営へのなりすまし",
      "これらが確認された投稿は、事前の通知なく非表示・削除する場合があります。",
    ],
  },
  {
    title: "困ったら",
    body: [
      "気になる投稿を見つけたときや、判断に迷うことがあったときは、ひとりで抱えこまずにお問い合わせのページから運営までご相談ください。",
    ],
  },
];

export default function GuidelinesPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="torn paper-grain w-full max-w-md border-[3px] border-kraft-paper/90 bg-kraft p-7 text-fes-ink shadow-paper-lg sm:p-9">
        <p className="font-maru text-sm font-bold text-fes-red">🏮 おしらせ</p>
        <h1 className="mt-1 font-maru text-2xl font-black text-fes-indigo">
          ガイドライン
        </h1>
        <p className="mt-2 font-maru text-xs font-bold leading-5 text-fes-ink/70">
          「Substack 夏祭り」をみんなで楽しむための、コミュニティの心得です。
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
              詳しい規約は{" "}
              <Link
                href="/terms"
                className="font-black text-fes-indigo underline underline-offset-2 hover:text-fes-red"
              >
                利用規約
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

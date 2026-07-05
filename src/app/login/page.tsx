"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  // ログイン後の戻り先（オープンリダイレクト防止のためサイト内パスのみ許可）
  const rawNext = searchParams.get("next");
  const nextPath = rawNext && rawNext.startsWith("/") ? rawNext : null;

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // ユーザーネームは任意。初めての方が入れると表示名になり、2回目以降は空欄でOK
    // （既存ユーザーの表示名は magic-link 仕様上ここでは上書きされない）。
    const trimmedUsername = username.trim();
    if (trimmedUsername.length > 20) {
      setError("ユーザーネームは20文字以内で入力してください。");
      return;
    }
    const trimmed = email.trim();
    if (!trimmed) {
      setError("メールアドレスを入力してください。");
      return;
    }
    setSending(true);
    setError(null);
    const supabase = createClient();
    // 常に ?next= を付けておく（メールテンプレートが {{ .RedirectTo }} の後ろに
    // &token_hash=... を連結する前提のため、クエリ文字列を必ず開始しておく）
    const emailRedirectTo = `${location.origin}/auth/callback?next=${encodeURIComponent(nextPath ?? "/")}`;
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        // 入力があるときだけ user_metadata に載せる（新規ユーザー作成時に表示名として使う）
        ...(trimmedUsername ? { data: { username: trimmedUsername } } : {}),
        emailRedirectTo,
      },
    });
    setSending(false);
    if (otpError) {
      setError(`メールを送信できませんでした：${otpError.message}`);
      return;
    }
    setSent(true);
  }

  return (
    <div className="torn paper-grain w-full max-w-md border-[3px] border-kraft-paper/90 bg-kraft p-7 text-fes-ink shadow-paper-lg sm:p-9">
      <p className="font-maru text-sm font-bold text-fes-red">🏮 受付はこちら</p>
      <h1 className="mt-1 font-maru text-2xl font-black text-fes-indigo">
        参加する／ログイン
      </h1>
      <p className="mt-2 font-maru text-xs font-bold leading-5 text-fes-ink/70">
        メールアドレスにログイン用のリンクをお送りします。パスワードは不要です。
        初めての方はユーザーネーム（表示名）も決めてください。
      </p>

      {sent ? (
        <div className="torn-2 mt-6 border-[3px] border-fes-teal/40 bg-kraft-paper p-4 shadow-paper-sm">
          <p className="font-maru text-base font-black text-fes-teal">
            確認メールを送りました 🎐
          </p>
          <p className="mt-1.5 font-maru text-xs font-bold leading-5 text-fes-ink/70">
            {email.trim()} 宛のメールにあるリンクを開くと、ログインが完了します。
            届かない場合は迷惑メールフォルダも確認してください。
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
          {(error ?? urlError) && (
            <p
              role="alert"
              className="rounded-lg border-2 border-fes-red/40 bg-kraft-paper px-3 py-2 font-maru text-xs font-bold text-fes-red"
            >
              {error ?? `ログインできませんでした：${urlError}`}
            </p>
          )}
          <label
            htmlFor="username"
            className="font-maru text-sm font-black text-fes-indigo"
          >
            ユーザーネーム（表示名）
            <span className="ml-1 font-bold text-fes-ink/50">— 初めての方のみ</span>
          </label>
          <input
            id="username"
            type="text"
            maxLength={20}
            autoComplete="nickname"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="なつまつり太郎"
            className="rounded-lg border-2 border-fes-ink/25 bg-kraft-paper px-3.5 py-2.5 font-maru text-sm font-bold text-fes-ink placeholder:text-fes-ink/40 focus:border-fes-indigo focus:outline-none"
          />
          <p className="-mt-1 font-maru text-[11px] font-bold text-fes-ink/60">
            ランキングなどに表示される名前です（20文字まで）。2回目以降のログインは空欄でOK・変更はマイページから。
          </p>
          <label
            htmlFor="email"
            className="font-maru text-sm font-black text-fes-indigo"
          >
            メールアドレス
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="rounded-lg border-2 border-fes-ink/25 bg-kraft-paper px-3.5 py-2.5 font-maru text-sm font-bold text-fes-ink placeholder:text-fes-ink/40 focus:border-fes-indigo focus:outline-none"
          />
          <button
            type="submit"
            disabled={sending}
            className="mt-2 rounded-lg border-2 border-fes-red-deep bg-fes-red px-4 py-2.5 font-maru text-sm font-black text-kraft-paper shadow-paper-sm transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {sending ? "送信中…" : "ログインリンクを送る"}
          </button>
          <p className="mt-1 text-center font-maru text-[11px] font-bold text-fes-ink/60">
            続行すると
            <Link
              href="/terms"
              className="text-fes-indigo underline underline-offset-2"
            >
              利用規約
            </Link>
            に同意したものとみなします
          </p>
        </form>
      )}

      <p className="mt-6 text-center">
        <Link
          href="/"
          className="font-maru text-xs font-black text-fes-indigo hover:underline"
        >
          ‹ 会場にもどる
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}

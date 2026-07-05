"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  userId: string;
  initialUsername: string;
};

export default function UsernameForm({ userId, initialUsername }: Props) {
  const router = useRouter();
  const [username, setUsername] = useState(initialUsername);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed || trimmed.length > 20) {
      setMessage({
        kind: "error",
        text: "ユーザーネームは1〜20文字で入力してください。",
      });
      return;
    }
    setSaving(true);
    setMessage(null);
    const supabase = createClient();
    // upsert: 初回ログイン前後で profiles 行が未作成のユーザーでも確実に保存できる
    // （RLS で自分の user_id 行のみ insert/update 可）。
    const { error } = await supabase
      .from("profiles")
      .upsert(
        { user_id: userId, username: trimmed, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    setSaving(false);
    if (error) {
      setMessage({
        kind: "error",
        text: `保存できませんでした：${error.message}`,
      });
      return;
    }
    setUsername(trimmed);
    setMessage({ kind: "ok", text: "ユーザーネームを保存しました 🎐" });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3">
      {message && (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={`rounded-lg border-2 bg-kraft-paper px-3 py-2 font-maru text-xs font-bold ${
            message.kind === "error"
              ? "border-fes-red/40 text-fes-red"
              : "border-fes-teal/40 text-fes-teal"
          }`}
        >
          {message.text}
        </p>
      )}
      <label
        htmlFor="mypage-username"
        className="font-maru text-sm font-black text-fes-indigo"
      >
        ユーザーネーム（表示名）
      </label>
      <input
        id="mypage-username"
        type="text"
        required
        maxLength={20}
        autoComplete="nickname"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="なつまつり太郎"
        className="rounded-lg border-2 border-fes-ink/25 bg-kraft-paper px-3.5 py-2.5 font-maru text-sm font-bold text-fes-ink placeholder:text-fes-ink/40 focus:border-fes-indigo focus:outline-none"
      />
      <p className="-mt-1 font-maru text-[11px] font-bold text-fes-ink/60">
        ヘッダーやランキングに表示される名前です（1〜20文字）。
      </p>
      <button
        type="submit"
        disabled={saving}
        className="mt-1 self-start rounded-lg border-2 border-fes-red-deep bg-fes-red px-4 py-2 font-maru text-sm font-black text-kraft-paper shadow-paper-sm transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
      >
        {saving ? "保存中…" : "保存する"}
      </button>
    </form>
  );
}

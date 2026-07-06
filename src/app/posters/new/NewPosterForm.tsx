"use client";

import { useState, type FormEvent } from "react";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

const labelClass = "font-maru text-sm font-black text-fes-indigo";
const inputClass =
  "rounded-lg border-2 border-fes-ink/25 bg-kraft-paper px-3.5 py-2.5 font-maru text-sm font-bold text-fes-ink placeholder:text-fes-ink/40 focus:border-fes-indigo focus:outline-none";

function validateSubstackLink(link: string): string | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return "リンクの形式が正しくありません。https:// から始まる Substack の URL を入力してください。";
  }
  if (url.protocol !== "https:") {
    return "リンクは https:// から始まる Substack の URL のみ使えます。";
  }
  const host = url.hostname.toLowerCase();
  if (host !== "substack.com" && !host.endsWith(".substack.com")) {
    return "リンクは Substack（substack.com）の URL のみ使えます。";
  }
  return null;
}

type Kind = "poster" | "stall";

// kind ごとに変わるのは文言と遷移先だけ。フォーム項目は完全に共通
const COPY = {
  poster: {
    imageLabel: "投稿画像",
    imageError: "投稿画像を選択してください。",
    titlePlaceholder: "例：夏の夜の読書会",
    descPlaceholder: "投稿の見どころや込めた想いをどうぞ",
    submitLabel: "投稿を貼り出す 🏮",
    submittingLabel: "貼り出し中…",
    redirectTo: "/posters",
  },
  stall: {
    imageLabel: "屋台の画像",
    imageError: "屋台の画像を選択してください。",
    titlePlaceholder: "例：喫茶ストーリーズ",
    descPlaceholder: "屋台のおすすめや込めた想いをどうぞ",
    submitLabel: "屋台を出す 🏮",
    submittingLabel: "開店準備中…",
    redirectTo: "/posters",
  },
} as const;

export default function NewPosterForm({ kind = "poster" }: { kind?: Kind }) {
  const copy = COPY[kind];
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const image = formData.get("image");
    const title = String(formData.get("title") ?? "").trim();
    const handle = String(formData.get("handle") ?? "").trim();
    const link = String(formData.get("link") ?? "").trim();

    // クライアント側バリデーション
    if (!(image instanceof File) || image.size === 0) {
      setError(copy.imageError);
      return;
    }
    if (!image.type.startsWith("image/")) {
      setError("画像ファイル（PNG / JPG など）を選択してください。");
      return;
    }
    if (image.size > MAX_IMAGE_SIZE) {
      setError("画像サイズは 5MB 以下にしてください。");
      return;
    }
    if (!title) {
      setError("タイトルを入力してください。");
      return;
    }
    if (!handle) {
      setError("ハンドルネームを入力してください。");
      return;
    }
    if (link) {
      const linkError = validateSubstackLink(link);
      if (linkError) {
        setError(linkError);
        return;
      }
    }

    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/posters", {
        method: "POST",
        body: formData,
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (!res.ok || !json?.ok) {
        setError(json?.error ?? "投稿に失敗しました。時間をおいてもう一度お試しください。");
        setSubmitting(false);
        return;
      }
      // 成功: 一覧ページへ（サーバーで再取得させるためフルナビゲーション）
      window.location.assign(copy.redirectTo);
    } catch {
      setError("通信エラーが発生しました。時間をおいてもう一度お試しください。");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="kind" value={kind} />
      {error && (
        <p
          role="alert"
          className="rounded-lg border-2 border-fes-red/40 bg-kraft-paper px-3 py-2 font-maru text-xs font-bold text-fes-red"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="image" className={labelClass}>
          {copy.imageLabel} <span className="text-fes-red">＊必須</span>
        </label>
        <input
          id="image"
          name="image"
          type="file"
          accept="image/*"
          required
          className="rounded-lg border-2 border-dashed border-fes-ink/25 bg-kraft-paper px-3.5 py-3 font-maru text-xs font-bold text-fes-ink file:mr-3 file:rounded-md file:border-0 file:bg-fes-indigo file:px-3 file:py-1.5 file:font-maru file:text-xs file:font-black file:text-kraft-paper"
        />
        <p className="font-maru text-[10px] font-bold text-fes-ink/60">
          PNG / JPG など・5MB まで
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className={labelClass}>
          タイトル <span className="text-fes-red">＊必須</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={100}
          placeholder={copy.titlePlaceholder}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="handle" className={labelClass}>
          ハンドルネーム <span className="text-fes-red">＊必須</span>
        </label>
        <input
          id="handle"
          name="handle"
          type="text"
          required
          maxLength={50}
          placeholder="例：@book_and_coffee"
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className={labelClass}>
          紹介文 <span className="text-fes-ink/50">（任意）</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={500}
          placeholder={copy.descPlaceholder}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="link" className={labelClass}>
          Substack リンク <span className="text-fes-ink/50">（任意）</span>
        </label>
        <input
          id="link"
          name="link"
          type="url"
          placeholder="https://example.substack.com"
          className={inputClass}
        />
        <p className="font-maru text-[10px] font-bold text-fes-ink/60">
          substack.com の URL のみ掲載できます
        </p>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 rounded-lg border-2 border-fes-red-deep bg-fes-red px-4 py-2.5 font-maru text-sm font-black text-kraft-paper shadow-paper-sm transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
      >
        {submitting ? copy.submittingLabel : copy.submitLabel}
      </button>
    </form>
  );
}

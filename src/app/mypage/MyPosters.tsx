/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useState } from "react";

export type MyPoster = {
  id: string;
  kind: "poster" | "stall";
  title: string;
  handle: string;
  likes: number;
  img: string;
};

const KIND_LABEL: Record<MyPoster["kind"], string> = {
  poster: "ポスター",
  stall: "屋台",
};

/**
 * マイページの「自分の投稿」一覧（管理用）。
 * - 各カードに 2 段階の削除ボタン（「削除」→「本当に消す？ はい / やめる」）。
 *   window.confirm は使わず、カード内インライン確認にする。
 * - 削除成功でそのカードをローカル state から即座に取り除く（全体リロード不要）。
 * - 削除失敗はカード内に日本語のエラーを表示して再操作できるようにする。
 */
export default function MyPosters({ posters }: { posters: MyPoster[] }) {
  const [items, setItems] = useState<MyPoster[]>(posters);
  // 各カードごとの状態: 確認中フラグ・削除中フラグ・エラー文言
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});

  async function handleDelete(id: string) {
    if (busyId) return;
    setBusyId(id);
    setErrorById((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      const res = await fetch(`/api/posters/${id}`, { method: "DELETE" });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (!res.ok || !json?.ok) {
        setErrorById((prev) => ({
          ...prev,
          [id]: json?.error ?? "削除に失敗しました。時間をおいてもう一度お試しください。",
        }));
        setBusyId(null);
        return;
      }
      // 成功: リストから取り除く
      setItems((prev) => prev.filter((p) => p.id !== id));
      setConfirmingId((cur) => (cur === id ? null : cur));
    } catch {
      setErrorById((prev) => ({
        ...prev,
        [id]: "通信エラーが発生しました。時間をおいてもう一度お試しください。",
      }));
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="torn-2 mt-3 border-[3px] border-fes-teal/40 bg-kraft-paper p-4 shadow-paper-sm">
        <p className="font-maru text-xs font-bold leading-5 text-fes-ink/70">
          まだ投稿がありません。
        </p>
        <p className="mt-1.5">
          <Link
            href="/posters/new"
            className="font-maru text-xs font-black text-fes-indigo underline underline-offset-2"
          >
            ポスターを貼り出す →
          </Link>
        </p>
      </div>
    );
  }

  return (
    <ul className="mt-3 flex flex-col gap-2.5">
      {items.map((p) => {
        const confirming = confirmingId === p.id;
        const busy = busyId === p.id;
        const err = errorById[p.id];
        return (
          <li
            key={p.id}
            className="torn-2 flex flex-col gap-2 border-[3px] border-fes-ink/15 bg-kraft-paper p-2.5 shadow-paper-sm"
          >
            <div className="flex items-center gap-3">
              <img
                src={p.img}
                alt=""
                className="h-14 w-14 shrink-0 rounded-md border-2 border-fes-ink/15 object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="shrink-0 rounded-sm bg-fes-indigo px-1.5 py-0.5 font-maru text-[10px] font-black leading-none text-kraft-paper">
                    {KIND_LABEL[p.kind]}
                  </span>
                  <span className="truncate font-maru text-sm font-black text-fes-ink">
                    {p.title}
                  </span>
                </div>
                <p className="mt-0.5 truncate font-maru text-[11px] font-bold text-fes-ink/60">
                  {p.handle}・♥ {p.likes.toLocaleString("ja-JP")}
                </p>
              </div>

              {!confirming ? (
                <button
                  type="button"
                  onClick={() => setConfirmingId(p.id)}
                  disabled={busy}
                  aria-label={`「${p.title}」を削除する`}
                  className="shrink-0 rounded-md border-2 border-fes-red/50 bg-kraft px-2.5 py-1.5 font-maru text-[11px] font-black text-fes-red transition-transform hover:-translate-y-0.5 disabled:opacity-60"
                >
                  削除
                </button>
              ) : (
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="font-maru text-[11px] font-black text-fes-ink/80">
                    本当に消す？
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(p.id)}
                    disabled={busy}
                    aria-label={`「${p.title}」の削除を確定する`}
                    className="rounded-md border-2 border-fes-red-deep bg-fes-red px-2.5 py-1.5 font-maru text-[11px] font-black text-kraft-paper shadow-paper-sm transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy ? "削除中…" : "はい（削除）"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingId(null)}
                    disabled={busy}
                    aria-label="削除をやめる"
                    className="rounded-md border-2 border-fes-ink/25 bg-kraft px-2.5 py-1.5 font-maru text-[11px] font-black text-fes-ink/70 disabled:opacity-60"
                  >
                    やめる
                  </button>
                </div>
              )}
            </div>

            {err && (
              <p
                role="alert"
                className="rounded-md border-2 border-fes-red/40 bg-kraft px-2.5 py-1.5 font-maru text-[11px] font-bold text-fes-red"
              >
                {err}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

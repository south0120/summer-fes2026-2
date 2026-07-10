"use client";

import { useFormStatus } from "react-dom";
import { restorePost } from "../actions";

function Button({ title }: { title: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!confirm(`「${title}」を表示に戻します。よろしいですか？`)) {
          e.preventDefault();
        }
      }}
      className="shrink-0 rounded-full border-2 border-fes-teal bg-fes-teal px-3 py-1.5 font-maru text-[11px] font-black text-kraft-paper hover:-translate-y-0.5 disabled:opacity-60"
    >
      {pending ? "処理中…" : "復活"}
    </button>
  );
}

/** 非表示（論理削除済み）の投稿を表示に戻すボタン。 */
export default function RestorePostButton({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  return (
    <form action={restorePost}>
      <input type="hidden" name="id" value={id} />
      <Button title={title} />
    </form>
  );
}

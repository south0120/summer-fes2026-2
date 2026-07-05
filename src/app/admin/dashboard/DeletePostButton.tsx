"use client";

import { useFormStatus } from "react-dom";
import { deletePost } from "../actions";

function Button({ title }: { title: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!confirm(`「${title}」を削除します。元に戻せません。よろしいですか？`)) {
          e.preventDefault();
        }
      }}
      className="shrink-0 rounded-full border-2 border-fes-red-deep bg-fes-red px-3 py-1.5 font-maru text-[11px] font-black text-kraft-paper hover:-translate-y-0.5 disabled:opacity-60"
    >
      {pending ? "削除中…" : "削除"}
    </button>
  );
}

export default function DeletePostButton({ id, title }: { id: string; title: string }) {
  return (
    <form action={deletePost}>
      <input type="hidden" name="id" value={id} />
      <Button title={title} />
    </form>
  );
}

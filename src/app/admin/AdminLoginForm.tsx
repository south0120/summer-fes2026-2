"use client";

import { useFormState, useFormStatus } from "react-dom";
import { login, type LoginState } from "./actions";

const initial: LoginState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-4 w-full rounded-full border-2 border-fes-red-deep bg-fes-red px-5 py-2.5 font-maru text-sm font-black text-kraft-paper shadow-paper-press transition-transform hover:-translate-y-0.5 disabled:opacity-60"
    >
      {pending ? "確認中…" : "ログイン"}
    </button>
  );
}

export default function AdminLoginForm() {
  const [state, formAction] = useFormState(login, initial);

  return (
    <form action={formAction} className="mt-4">
      <label className="block font-maru text-xs font-bold text-fes-ink/70">
        パスワード
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-lg border-2 border-fes-ink/20 bg-white px-3 py-2 font-body text-sm text-fes-ink outline-none focus:border-fes-indigo"
        />
      </label>
      {state.error && (
        <p className="mt-2 font-maru text-xs font-bold text-fes-red">
          {state.error}
        </p>
      )}
      <SubmitButton />
    </form>
  );
}

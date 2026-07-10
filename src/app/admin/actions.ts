"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  verifyPassword,
  isAdminConfigured,
  isAuthed,
  startSession,
  endSession,
  getAdminPath,
  getAdminSupabase,
} from "@/lib/admin";

function adminBase(): string {
  const slug = getAdminPath();
  return slug ? `/${slug}` : "/";
}

export type LoginState = { error?: string };

/** ログイン: パスワード照合 → 成功でセッション発行しダッシュボードへ。 */
export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (!isAdminConfigured()) {
    return { error: "管理者パスワードが未設定です（Vercelのenvに設定してください）。" };
  }
  const password = String(formData.get("password") ?? "");
  if (!verifyPassword(password)) {
    // 総当り抑止のため失敗時は少し待たせる＋汎用メッセージ
    await new Promise((r) => setTimeout(r, 600));
    return { error: "パスワードが違います。" };
  }
  startSession();
  redirect(`${adminBase()}/dashboard`);
}

/** ログアウト。 */
export async function logout(): Promise<void> {
  endSession();
  redirect(adminBase());
}

/**
 * 投稿（ポスター/屋台）を非表示にする（論理削除・ソフトデリート）。
 * 認証必須・service_role で RLS バイパス。物理削除はせず deleted_at をセットするだけ。
 * DB の行・画像・いいねは残るので、あとから復活できる。
 */
export async function deletePost(formData: FormData): Promise<void> {
  if (!isAuthed()) {
    throw new Error("認証が必要です。");
  }
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("対象がありません。");

  const supabase = getAdminSupabase();
  const { error } = await supabase
    .from("posters")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error("非表示に失敗しました: " + error.message);

  revalidatePath(`${adminBase()}/dashboard`);
}

/**
 * 非表示（論理削除済み）の投稿を復活させる。認証必須・service_role。
 * deleted_at を null に戻すと、また表・一覧・投稿者のマイページに表示される。
 */
export async function restorePost(formData: FormData): Promise<void> {
  if (!isAuthed()) {
    throw new Error("認証が必要です。");
  }
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("対象がありません。");

  const supabase = getAdminSupabase();
  const { error } = await supabase
    .from("posters")
    .update({ deleted_at: null })
    .eq("id", id);
  if (error) throw new Error("復活に失敗しました: " + error.message);

  revalidatePath(`${adminBase()}/dashboard`);
}
